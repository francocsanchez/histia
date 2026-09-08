"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const node_module_1 = require("node:module");
const node_os_1 = require("node:os");
const env_1 = require("@next/env");
const runtimeRequire = (0, node_module_1.createRequire)(__filename);
const runningWithTsx = process.execArgv.join(" ").indexOf("tsx") >= 0;
if (!runningWithTsx) {
    runtimeRequire("module-alias/register");
}
const { acquireWhatsAppWorkerLease, appendWhatsAppConnectionEvent, clearWhatsAppAuthState, ensureSurveySettingsForWorker, expireNoResponseSurveys, getWhatsAppConnectionControlState, getStoredWhatsAppAuthRecords, getWorkerHealthSnapshot, markLeasesAsDeliveryUnknown, pauseSurveyDispatchAfterWhatsAppLogout, processIncomingWhatsAppMessage, releaseWhatsAppWorkerLease, removeWhatsAppAuthRecord, sendLeasedSurvey, takeNextSurveyLease, updateWhatsAppConnectionState, upsertWhatsAppAuthRecord, } = runtimeRequire("../src/services/surveys");
const { getServerEnv } = runtimeRequire("../src/lib/env");
const { extractPhoneE164FromWhatsAppKey, getWhatsAppReconnectDelayMs, getWhatsappJid, } = runtimeRequire("../src/lib/surveys");
(0, env_1.loadEnvConfig)(process.cwd());
let workerActive = true;
let socketBooting = false;
let socketConnected = false;
let workerOwnsLease = false;
let socketGeneration = 0;
let resetInProgress = false;
let currentDesiredState = "running";
let appliedResetNonce = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let authWriteQueue = Promise.resolve();
let authWriteSequence = 0;
let outboundSendQueue = Promise.resolve();
let lastOutboundAttempt = null;
let currentSocket = null;
const workerInstanceId = `${(0, node_os_1.hostname)()}:${process.pid}`;
const WORKER_LEASE_TTL_MS = 30_000;
const logger = {
    trace: (...args) => console.debug("[whatsapp-worker][trace]", ...args),
    debug: (...args) => console.debug("[whatsapp-worker][debug]", ...args),
    info: (...args) => console.info("[whatsapp-worker][info]", ...args),
    warn: (...args) => console.warn("[whatsapp-worker][warn]", ...args),
    error: (...args) => console.error("[whatsapp-worker][error]", ...args),
};
function sanitizeDetails(details) {
    if (!details) {
        return null;
    }
    return JSON.parse(JSON.stringify(details, (_, value) => {
        if (value instanceof Error) {
            return {
                name: value.name,
                message: value.message,
                stack: value.stack,
            };
        }
        return value;
    }));
}
function enqueueOutboundSend(task) {
    const result = outboundSendQueue.then(task, task);
    outboundSendQueue = result.then(() => undefined, () => undefined);
    return result;
}
async function traceEvent(input) {
    logger.info(input.message, input.details ?? {});
    try {
        await appendWhatsAppConnectionEvent({
            source: "worker",
            eventType: input.eventType,
            message: input.message,
            status: input.status,
            desiredState: input.desiredState ?? currentDesiredState,
            phoneNumber: input.phoneNumber ?? null,
            resetNonce: input.resetNonce ?? appliedResetNonce,
            generation: input.generation ?? socketGeneration,
            details: sanitizeDetails(input.details),
        });
    }
    catch (error) {
        logger.warn("no se pudo persistir el evento de WhatsApp", error);
    }
}
function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}
function getNextReconnectDelayMs() {
    const delay = getWhatsAppReconnectDelayMs(reconnectAttempt);
    reconnectAttempt += 1;
    return delay;
}
function resetReconnectBackoff() {
    reconnectAttempt = 0;
}
function scheduleReconnect() {
    if (!workerActive || !workerOwnsLease || currentDesiredState !== "running" || resetInProgress) {
        return;
    }
    const delayMs = getNextReconnectDelayMs();
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void bootSocket();
    }, delayMs);
}
function invalidateSocketGeneration() {
    socketGeneration += 1;
    socketBooting = false;
}
async function createMongoAuthState(baileys) {
    const records = await getStoredWhatsAppAuthRecords();
    const recordMap = new Map(records.map((record) => [record.key, record.value]));
    const parseStoredValue = (value) => {
        if (typeof value !== "string") {
            return value;
        }
        return JSON.parse(value, baileys.BufferJSON.reviver);
    };
    const serializeValue = (value) => JSON.stringify(value, baileys.BufferJSON.replacer);
    const enqueueAuthWrite = (label, run) => {
        const sequence = ++authWriteSequence;
        authWriteQueue = authWriteQueue
            .then(async () => {
            await run();
        })
            .catch((error) => {
            logger.error(`[whatsapp-worker] auth write failed (${label} #${sequence})`, error);
        });
        return authWriteQueue;
    };
    const creds = parseStoredValue(recordMap.get("creds")) ?? baileys.initAuthCreds();
    const keysStore = {
        get: async (type, ids) => {
            const data = {};
            for (const id of ids) {
                const value = recordMap.get(`key:${type}:${id}`);
                if (value !== undefined) {
                    data[id] = parseStoredValue(value);
                }
            }
            return data;
        },
        set: async (data) => {
            await enqueueAuthWrite("keys.set", async () => {
                for (const category of Object.keys(data)) {
                    for (const id of Object.keys(data[category])) {
                        const value = data[category][id];
                        const storageKey = `key:${category}:${id}`;
                        if (value) {
                            const serialized = serializeValue(value);
                            recordMap.set(storageKey, serialized);
                            await upsertWhatsAppAuthRecord(storageKey, serialized);
                        }
                        else {
                            recordMap.delete(storageKey);
                            await removeWhatsAppAuthRecord(storageKey);
                        }
                    }
                }
            });
        },
    };
    const authState = {
        creds,
        keys: baileys.makeCacheableSignalKeyStore(keysStore, logger),
    };
    return {
        state: authState,
        saveCreds: async () => {
            await enqueueAuthWrite("creds.update", async () => {
                const serialized = serializeValue(authState.creds);
                recordMap.set("creds", serialized);
                await upsertWhatsAppAuthRecord("creds", serialized);
            });
        },
    };
}
function discardSocket(reason) {
    clearReconnectTimer();
    invalidateSocketGeneration();
    if (currentSocket?.end) {
        try {
            currentSocket.end(new Error(reason));
        }
        catch (error) {
            logger.warn("no se pudo cerrar el socket local", error);
        }
    }
    currentSocket = null;
    socketConnected = false;
}
async function closeSessionAndClearAuth() {
    clearReconnectTimer();
    invalidateSocketGeneration();
    if (!currentSocket) {
        await clearWhatsAppAuthState();
        socketConnected = false;
        return;
    }
    try {
        await currentSocket.logout();
    }
    catch (error) {
        logger.warn("logout fallo, se limpia auth igual", error);
    }
    finally {
        currentSocket = null;
        socketConnected = false;
    }
    await clearWhatsAppAuthState();
}
async function applyTerminalDisconnect(input) {
    currentDesiredState = "stopped";
    resetReconnectBackoff();
    if (input.lastDisconnectReason === "logged_out") {
        await pauseSurveyDispatchAfterWhatsAppLogout();
    }
    await clearWhatsAppAuthState();
    await traceEvent({
        eventType: "terminal_disconnect",
        message: input.lastError,
        status: "error",
        desiredState: "stopped",
        phoneNumber: null,
        details: {
            lastDisconnectCode: input.lastDisconnectCode,
            lastDisconnectReason: input.lastDisconnectReason,
            pausedDispatch: input.lastDisconnectReason === "logged_out",
            lastOutboundAttempt,
        },
    });
    await updateWhatsAppConnectionState({
        desiredState: "stopped",
        status: "error",
        phoneNumber: null,
        qr: null,
        qrExpiresAt: null,
        lastError: input.lastError,
        lastDisconnectCode: input.lastDisconnectCode,
        lastDisconnectReason: input.lastDisconnectReason,
        disconnected: true,
        clearDisconnectRequest: true,
    });
    lastOutboundAttempt = null;
}
async function applyRequestedReset(input) {
    resetInProgress = true;
    currentDesiredState = input.desiredState;
    resetReconnectBackoff();
    const resettingToStopped = input.desiredState === "stopped";
    await traceEvent({
        eventType: "reset_started",
        message: resettingToStopped
            ? "Se inicia una desvinculacion total de la sesion de WhatsApp."
            : "Se inicia un reset total de la sesion para preparar un QR nuevo.",
        status: "disconnecting",
        desiredState: input.desiredState,
        resetNonce: input.resetNonce,
    });
    try {
        await closeSessionAndClearAuth();
        await updateWhatsAppConnectionState({
            desiredState: input.desiredState,
            status: "disconnected",
            phoneNumber: null,
            qr: null,
            qrExpiresAt: null,
            lastError: null,
            lastDisconnectCode: null,
            lastDisconnectReason: null,
            disconnected: true,
            clearDisconnectRequest: true,
        });
        appliedResetNonce = input.resetNonce;
        await traceEvent({
            eventType: "reset_completed",
            message: resettingToStopped
                ? "La sesion de WhatsApp se borro por completo y la integracion quedo detenida."
                : "El reset total de WhatsApp termino y la integracion quedo lista para generar un QR nuevo.",
            status: "disconnected",
            desiredState: input.desiredState,
            resetNonce: input.resetNonce,
        });
    }
    finally {
        resetInProgress = false;
    }
}
async function bootSocket() {
    if (socketBooting ||
        !workerActive ||
        !workerOwnsLease ||
        resetInProgress ||
        currentDesiredState !== "running") {
        return;
    }
    socketBooting = true;
    clearReconnectTimer();
    const generation = ++socketGeneration;
    try {
        await traceEvent({
            eventType: "boot_started",
            message: "Se inicia el boot del socket de WhatsApp.",
            status: "connecting",
            desiredState: "running",
            generation,
        });
        const baileys = (await import("@whiskeysockets/baileys"));
        const { state, saveCreds } = await createMongoAuthState(baileys);
        const latest = await (baileys.fetchLatestWaWebVersion?.() ?? baileys.fetchLatestBaileysVersion()).catch(() => ({
            version: [0, 0, 0],
        }));
        await updateWhatsAppConnectionState({
            desiredState: "running",
            status: "connecting",
            qr: null,
            qrExpiresAt: null,
            lastError: null,
            lastDisconnectCode: null,
            lastDisconnectReason: null,
        });
        const sock = baileys.default({
            auth: state,
            version: latest.version,
            browser: baileys.Browsers.macOS("Desktop"),
            printQRInTerminal: false,
            markOnlineOnConnect: false,
            syncFullHistory: false,
        });
        currentSocket = sock;
        sock.ev.on("creds.update", () => {
            if (generation !== socketGeneration) {
                return;
            }
            void saveCreds().catch((error) => {
                void traceEvent({
                    eventType: "creds_update_failed",
                    message: "Fallo al persistir credenciales de WhatsApp en MongoDB.",
                    status: "error",
                    desiredState: currentDesiredState,
                    generation,
                    details: {
                        error,
                    },
                });
            });
        });
        sock.ev.on("connection.update", (...args) => {
            void (async () => {
                if (generation !== socketGeneration) {
                    return;
                }
                const update = (args[0] ?? {});
                const qr = typeof update.qr === "string" ? update.qr : null;
                const connection = typeof update.connection === "string" ? update.connection : null;
                const statusCode = Number(update.lastDisconnect
                    ?.error?.output?.statusCode ?? 0);
                if (qr) {
                    if (socketConnected) {
                        await traceEvent({
                            eventType: "qr_ignored_after_connected",
                            message: "Se ignora un QR tardio porque la sesion ya estaba conectada.",
                            status: "connected",
                            desiredState: "running",
                            generation,
                            details: {
                                qrLength: qr.length,
                                connection,
                            },
                        });
                        return;
                    }
                    await traceEvent({
                        eventType: "qr_received",
                        message: "WhatsApp emitio un QR para vinculacion.",
                        status: "qr_required",
                        desiredState: "running",
                        generation,
                        details: {
                            qrLength: qr.length,
                            connection,
                        },
                    });
                    await updateWhatsAppConnectionState({
                        desiredState: "running",
                        status: "qr_required",
                        qr,
                        qrExpiresAt: new Date(Date.now() + 60_000),
                        lastError: null,
                        lastDisconnectCode: null,
                        lastDisconnectReason: null,
                    });
                }
                if (connection === "open") {
                    clearReconnectTimer();
                    resetReconnectBackoff();
                    socketConnected = true;
                    const phoneNumber = sock.user?.id?.split(":")[0] ?? sock.user?.id?.split("@")[0] ?? null;
                    await traceEvent({
                        eventType: "connection_open",
                        message: "La sesion de WhatsApp quedo conectada.",
                        status: "connected",
                        desiredState: "running",
                        phoneNumber,
                        generation,
                    });
                    await updateWhatsAppConnectionState({
                        desiredState: "running",
                        status: "connected",
                        phoneNumber,
                        qr: null,
                        qrExpiresAt: null,
                        lastError: null,
                        lastDisconnectCode: null,
                        lastDisconnectReason: null,
                        connected: true,
                        clearDisconnectRequest: true,
                    });
                }
                if (connection === "close") {
                    if (generation !== socketGeneration) {
                        return;
                    }
                    socketConnected = false;
                    currentSocket = null;
                    await traceEvent({
                        eventType: "connection_closed",
                        message: `La sesion de WhatsApp cerro la conexion con codigo ${statusCode || "desconocido"}.`,
                        status: "error",
                        desiredState: currentDesiredState,
                        generation,
                        details: {
                            statusCode,
                            connection,
                            lastOutboundAttempt,
                        },
                    });
                    if (statusCode === baileys.DisconnectReason.loggedOut) {
                        await applyTerminalDisconnect({
                            lastError: "La sesion de WhatsApp se desvinculo y requiere un nuevo QR.",
                            lastDisconnectCode: statusCode || null,
                            lastDisconnectReason: "logged_out",
                        });
                        return;
                    }
                    if (statusCode === baileys.DisconnectReason.connectionReplaced) {
                        await applyTerminalDisconnect({
                            lastError: "WhatsApp cerro la sesion porque otra instancia intento usar el mismo numero. Deja solo un worker activo y prepara un nuevo QR si hace falta.",
                            lastDisconnectCode: statusCode || null,
                            lastDisconnectReason: "connection_replaced",
                        });
                        return;
                    }
                    await updateWhatsAppConnectionState({
                        desiredState: "running",
                        status: "error",
                        lastError: `WhatsApp se desconecto (codigo ${statusCode || "desconocido"})`,
                        lastDisconnectCode: statusCode || null,
                        lastDisconnectReason: statusCode ? `code_${statusCode}` : "unknown",
                        disconnected: true,
                    });
                    scheduleReconnect();
                }
            })();
        });
        sock.ev.on("messages.upsert", (...args) => {
            void (async () => {
                if (generation !== socketGeneration) {
                    return;
                }
                const event = (args[0] ?? {});
                const messages = Array.isArray(event.messages) ? event.messages : [];
                for (const item of messages) {
                    const message = item;
                    if (message.key?.fromMe) {
                        continue;
                    }
                    const phoneE164 = extractPhoneE164FromWhatsAppKey(message.key);
                    if (!phoneE164) {
                        logger.debug("mensaje entrante ignorado por no poder resolver telefono", message.key);
                        continue;
                    }
                    await processIncomingWhatsAppMessage({
                        phoneE164,
                        message: message.message,
                        messenger: {
                            sendText: async (jid, text) => {
                                const result = await sock.sendMessage(jid, { text });
                                return {
                                    id: result.key?.id ?? `sent-${Date.now()}`,
                                };
                            },
                        },
                    });
                }
            })();
        });
    }
    catch (error) {
        if (generation !== socketGeneration) {
            return;
        }
        socketConnected = false;
        currentSocket = null;
        await updateWhatsAppConnectionState({
            desiredState: currentDesiredState,
            status: "error",
            lastError: error instanceof Error ? error.message : String(error),
            lastDisconnectCode: null,
            lastDisconnectReason: "boot_error",
        });
        await traceEvent({
            eventType: "boot_failed",
            message: "Fallo el arranque del socket de WhatsApp.",
            status: "error",
            desiredState: currentDesiredState,
            generation,
            details: {
                error,
            },
        });
        scheduleReconnect();
    }
    finally {
        if (generation === socketGeneration) {
            socketBooting = false;
        }
    }
}
async function sendPendingSurveyIfPossible() {
    if (!socketConnected || !currentSocket) {
        return;
    }
    const lease = await takeNextSurveyLease();
    if (!lease) {
        return;
    }
    try {
        lastOutboundAttempt = {
            surveyId: String(lease._id),
            campaignId: String(lease.campaignId),
            phoneE164: lease.phoneE164,
            startedAt: new Date().toISOString(),
            providerMessageId: null,
            finishedAt: null,
            outcome: "sending",
            errorMessage: null,
        };
        const sent = await enqueueOutboundSend(() => sendLeasedSurvey({
            surveyId: String(lease._id),
            trigger: "worker",
            messenger: {
                sendText: async (jid, text) => {
                    const response = await currentSocket.sendMessage(jid, { text });
                    return { id: response.key?.id ?? `sent-${Date.now()}` };
                },
            },
        }));
        lastOutboundAttempt = {
            ...lastOutboundAttempt,
            providerMessageId: sent.providerMessageId,
            finishedAt: new Date().toISOString(),
            outcome: "sent",
            errorMessage: null,
        };
    }
    catch (error) {
        lastOutboundAttempt = {
            surveyId: String(lease._id),
            campaignId: String(lease.campaignId),
            phoneE164: lease.phoneE164,
            startedAt: lastOutboundAttempt?.startedAt ?? new Date().toISOString(),
            providerMessageId: lastOutboundAttempt?.providerMessageId ?? null,
            finishedAt: new Date().toISOString(),
            outcome: "failed",
            errorMessage: error instanceof Error ? error.message : String(error),
        };
    }
}
async function workerLoop() {
    await ensureSurveySettingsForWorker();
    await markLeasesAsDeliveryUnknown();
    while (workerActive) {
        try {
            workerOwnsLease = await acquireWhatsAppWorkerLease({
                ownerId: workerInstanceId,
                ttlMs: WORKER_LEASE_TTL_MS,
            });
            if (!workerOwnsLease) {
                clearReconnectTimer();
                resetReconnectBackoff();
                await traceEvent({
                    eventType: "lease_lost",
                    message: "El worker perdio el lease de WhatsApp y libera el socket.",
                    desiredState: currentDesiredState,
                });
                discardSocket("worker lease perdida");
                await new Promise((resolve) => setTimeout(resolve, 5_000));
                continue;
            }
            const connectionControl = await getWhatsAppConnectionControlState();
            currentDesiredState = connectionControl.desiredState;
            if (appliedResetNonce === null) {
                appliedResetNonce =
                    connectionControl.status === "disconnecting" ? connectionControl.resetNonce - 1 : connectionControl.resetNonce;
                await traceEvent({
                    eventType: "control_state_loaded",
                    message: "El worker cargo el estado inicial de control de WhatsApp.",
                    status: connectionControl.status,
                    desiredState: connectionControl.desiredState,
                    phoneNumber: connectionControl.phoneNumber,
                    resetNonce: appliedResetNonce,
                    details: {
                        lastError: connectionControl.lastError,
                        lastDisconnectCode: connectionControl.lastDisconnectCode,
                        lastDisconnectReason: connectionControl.lastDisconnectReason,
                    },
                });
            }
            if (connectionControl.resetNonce !== appliedResetNonce) {
                await applyRequestedReset({
                    desiredState: connectionControl.desiredState,
                    resetNonce: connectionControl.resetNonce,
                });
            }
            if (currentDesiredState === "stopped") {
                clearReconnectTimer();
                resetReconnectBackoff();
                if (currentSocket || socketConnected || socketBooting) {
                    discardSocket("worker detenido por desiredState=stopped");
                }
            }
            else if (!currentSocket && !socketBooting && !resetInProgress) {
                await bootSocket();
            }
            await expireNoResponseSurveys();
            await sendPendingSurveyIfPossible();
        }
        catch (error) {
            logger.error("fallo el loop del worker", error);
            await traceEvent({
                eventType: "worker_loop_error",
                message: "Fallo el loop principal del worker de WhatsApp.",
                desiredState: currentDesiredState,
                details: {
                    error,
                },
            });
        }
        await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
}
function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", (chunk) => {
            body += chunk.toString();
        });
        request.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            }
            catch (error) {
                reject(error);
            }
        });
        request.on("error", reject);
    });
}
async function dispatchManualSurvey(surveyId) {
    if (!socketConnected ||
        !currentSocket ||
        !workerOwnsLease ||
        currentDesiredState !== "running") {
        throw new Error("WhatsApp no esta listo para enviar la encuesta");
    }
    const sent = await enqueueOutboundSend(() => sendLeasedSurvey({
        surveyId,
        trigger: "manual",
        messenger: {
            sendText: async (jid, text) => {
                const response = await currentSocket.sendMessage(jid, { text });
                return { id: response.key?.id ?? `sent-${Date.now()}` };
            },
        },
    }));
    return sent;
}
function startHealthServer() {
    const env = getServerEnv();
    const port = env.WHATSAPP_WORKER_PORT ?? 3010;
    const strictHealthPort = process.env.NODE_ENV === "production";
    const server = (0, node_http_1.createServer)((request, response) => {
        void (async () => {
            try {
                if (request.method === "POST" && request.url === "/send-survey") {
                    if (!socketConnected ||
                        !currentSocket ||
                        !workerOwnsLease ||
                        currentDesiredState !== "running") {
                        response.writeHead(409, { "Content-Type": "application/json" });
                        response.end(JSON.stringify({
                            ok: false,
                            releaseLease: true,
                            error: "WhatsApp no esta listo para enviar",
                        }));
                        return;
                    }
                    const body = await readJsonBody(request);
                    const surveyId = typeof body.surveyId === "string" ? body.surveyId : "";
                    if (!surveyId) {
                        response.writeHead(400, { "Content-Type": "application/json" });
                        response.end(JSON.stringify({ ok: false, releaseLease: true, error: "surveyId es obligatorio" }));
                        return;
                    }
                    try {
                        const data = await dispatchManualSurvey(surveyId);
                        response.writeHead(200, { "Content-Type": "application/json" });
                        response.end(JSON.stringify({ ok: true, data }));
                    }
                    catch (error) {
                        response.writeHead(500, { "Content-Type": "application/json" });
                        response.end(JSON.stringify({
                            ok: false,
                            releaseLease: false,
                            error: error instanceof Error ? error.message : String(error),
                        }));
                    }
                    return;
                }
                const snapshot = await getWorkerHealthSnapshot();
                response.writeHead(200, { "Content-Type": "application/json" });
                response.end(JSON.stringify({ ok: true, ...snapshot }));
            }
            catch (error) {
                response.writeHead(500, { "Content-Type": "application/json" });
                response.end(JSON.stringify({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                }));
            }
        })();
    });
    server.on("error", (error) => {
        if (error.code === "EADDRINUSE" && !strictHealthPort) {
            console.warn(`[whatsapp-worker] puerto ${port} ya esta en uso; en desarrollo se continua sin health server local`);
            return;
        }
        throw error;
    });
    server.listen(port, "0.0.0.0", () => {
        console.log(`[whatsapp-worker] health server escuchando en ${port}`);
    });
    return server;
}
async function main() {
    startHealthServer();
    await workerLoop();
}
function shutdown(signal) {
    workerActive = false;
    clearReconnectTimer();
    resetReconnectBackoff();
    discardSocket(`shutdown ${signal}`);
    void releaseWhatsAppWorkerLease(workerInstanceId);
    console.log(`[whatsapp-worker] cerrando por ${signal}`);
}
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
void main().catch((error) => {
    console.error("[whatsapp-worker] error fatal", error);
    process.exit(1);
});
