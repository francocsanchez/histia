"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("module-alias/register");
const node_http_1 = require("node:http");
const node_os_1 = require("node:os");
const env_1 = require("@next/env");
const surveys_1 = require("@/services/surveys");
const env_2 = require("@/lib/env");
const surveys_2 = require("@/lib/surveys");
(0, env_1.loadEnvConfig)(process.cwd());
let workerActive = true;
let socketBooting = false;
let socketConnected = false;
let workerOwnsLease = false;
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
async function createMongoAuthState(baileys) {
    const records = await (0, surveys_1.getStoredWhatsAppAuthRecords)();
    const recordMap = new Map(records.map((record) => [record.key, record.value]));
    const parseStoredValue = (value) => {
        if (typeof value !== "string") {
            return value;
        }
        return JSON.parse(value, baileys.BufferJSON.reviver);
    };
    const serializeValue = (value) => JSON.stringify(value, baileys.BufferJSON.replacer);
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
            for (const category of Object.keys(data)) {
                for (const id of Object.keys(data[category])) {
                    const value = data[category][id];
                    const storageKey = `key:${category}:${id}`;
                    if (value) {
                        const serialized = serializeValue(value);
                        recordMap.set(storageKey, serialized);
                        await (0, surveys_1.upsertWhatsAppAuthRecord)(storageKey, serialized);
                    }
                    else {
                        recordMap.delete(storageKey);
                        await (0, surveys_1.removeWhatsAppAuthRecord)(storageKey);
                    }
                }
            }
        },
    };
    const authState = {
        creds,
        keys: baileys.makeCacheableSignalKeyStore(keysStore, logger),
    };
    return {
        state: authState,
        saveCreds: async () => {
            const serialized = serializeValue(authState.creds);
            recordMap.set("creds", serialized);
            await (0, surveys_1.upsertWhatsAppAuthRecord)("creds", serialized);
        },
    };
}
async function disconnectSocket() {
    if (!currentSocket) {
        await (0, surveys_1.clearWhatsAppAuthState)();
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
    await (0, surveys_1.clearWhatsAppAuthState)();
}
async function bootSocket() {
    if (socketBooting || !workerActive || !workerOwnsLease) {
        return;
    }
    socketBooting = true;
    try {
        const baileys = (await import("@whiskeysockets/baileys"));
        const { state, saveCreds } = await createMongoAuthState(baileys);
        const latest = await (baileys.fetchLatestWaWebVersion?.() ?? baileys.fetchLatestBaileysVersion()).catch(() => ({
            version: [0, 0, 0],
        }));
        await (0, surveys_1.updateWhatsAppConnectionState)({
            status: "connecting",
            qr: null,
            qrExpiresAt: null,
            lastError: null,
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
            void saveCreds();
        });
        sock.ev.on("connection.update", (...args) => {
            void (async () => {
                const update = (args[0] ?? {});
                const qr = typeof update.qr === "string" ? update.qr : null;
                const connection = typeof update.connection === "string" ? update.connection : null;
                const statusCode = Number(update.lastDisconnect
                    ?.error?.output?.statusCode ?? 0);
                if (qr) {
                    await (0, surveys_1.updateWhatsAppConnectionState)({
                        status: "qr_required",
                        qr,
                        qrExpiresAt: new Date(Date.now() + 60_000),
                        lastError: null,
                    });
                }
                if (connection === "open") {
                    socketConnected = true;
                    const phoneNumber = sock.user?.id?.split(":")[0] ?? sock.user?.id?.split("@")[0] ?? null;
                    await (0, surveys_1.updateWhatsAppConnectionState)({
                        status: "connected",
                        phoneNumber,
                        qr: null,
                        qrExpiresAt: null,
                        connected: true,
                        clearDisconnectRequest: true,
                    });
                }
                if (connection === "close") {
                    socketConnected = false;
                    currentSocket = null;
                    if (statusCode === baileys.DisconnectReason.loggedOut) {
                        await (0, surveys_1.clearWhatsAppAuthState)();
                        await (0, surveys_1.updateWhatsAppConnectionState)({
                            status: "disconnected",
                            phoneNumber: null,
                            qr: null,
                            qrExpiresAt: null,
                            lastError: "La sesion de WhatsApp se desvinculo y requiere un nuevo QR.",
                            disconnected: true,
                            clearDisconnectRequest: true,
                        });
                        return;
                    }
                    if (statusCode === baileys.DisconnectReason.connectionReplaced) {
                        await (0, surveys_1.updateWhatsAppConnectionState)({
                            status: "error",
                            lastError: "WhatsApp cerro la sesion porque otra instancia intento usar el mismo numero. Deja solo un worker activo y prepara un nuevo QR si hace falta.",
                            disconnected: true,
                        });
                        setTimeout(() => {
                            void bootSocket();
                        }, 10_000);
                        return;
                    }
                    await (0, surveys_1.updateWhatsAppConnectionState)({
                        status: "error",
                        lastError: `WhatsApp se desconecto (codigo ${statusCode || "desconocido"})`,
                        disconnected: true,
                    });
                    setTimeout(() => {
                        void bootSocket();
                    }, 5_000);
                }
            })();
        });
        sock.ev.on("messages.upsert", (...args) => {
            void (async () => {
                const event = (args[0] ?? {});
                const messages = Array.isArray(event.messages) ? event.messages : [];
                for (const item of messages) {
                    const message = item;
                    if (message.key?.fromMe) {
                        continue;
                    }
                    const phoneE164 = (0, surveys_2.extractPhoneE164FromWhatsAppKey)(message.key);
                    if (!phoneE164) {
                        logger.debug("mensaje entrante ignorado por no poder resolver telefono", message.key);
                        continue;
                    }
                    await (0, surveys_1.processIncomingWhatsAppMessage)({
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
        socketConnected = false;
        currentSocket = null;
        await (0, surveys_1.updateWhatsAppConnectionState)({
            status: "error",
            lastError: error instanceof Error ? error.message : String(error),
        });
        setTimeout(() => {
            void bootSocket();
        }, 10_000);
    }
    finally {
        socketBooting = false;
    }
}
async function sendPendingSurveyIfPossible() {
    if (!socketConnected || !currentSocket) {
        return;
    }
    const lease = await (0, surveys_1.takeNextSurveyLease)();
    if (!lease) {
        return;
    }
    try {
        const text = await (0, surveys_1.buildSurveyIntroMessage)(String(lease._id));
        const sent = await currentSocket.sendMessage((0, surveys_2.getWhatsappJid)(lease.phoneE164), { text });
        await (0, surveys_1.markSurveySendSuccess)({
            surveyId: String(lease._id),
            providerMessageId: sent.key?.id ?? `sent-${Date.now()}`,
        });
    }
    catch (error) {
        await (0, surveys_1.markSurveySendFailure)({
            surveyId: String(lease._id),
            errorMessage: error instanceof Error ? error.message : String(error),
        });
    }
}
async function workerLoop() {
    await (0, surveys_1.ensureSurveySettingsForWorker)();
    await (0, surveys_1.markLeasesAsDeliveryUnknown)();
    while (workerActive) {
        try {
            workerOwnsLease = await (0, surveys_1.acquireWhatsAppWorkerLease)({
                ownerId: workerInstanceId,
                ttlMs: WORKER_LEASE_TTL_MS,
            });
            if (!workerOwnsLease) {
                socketBooting = false;
                socketConnected = false;
                currentSocket = null;
                await new Promise((resolve) => setTimeout(resolve, 5_000));
                continue;
            }
            const disconnectRequestedAt = await (0, surveys_1.getWhatsappDisconnectRequestedAt)();
            if (disconnectRequestedAt) {
                await disconnectSocket();
            }
            else if (!currentSocket && !socketBooting) {
                await bootSocket();
            }
            await (0, surveys_1.expireNoResponseSurveys)();
            await sendPendingSurveyIfPossible();
        }
        catch (error) {
            logger.error("fallo el loop del worker", error);
        }
        await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
}
function startHealthServer() {
    const env = (0, env_2.getServerEnv)();
    const port = env.WHATSAPP_WORKER_PORT ?? 3010;
    const strictHealthPort = process.env.NODE_ENV === "production";
    const server = (0, node_http_1.createServer)((_, response) => {
        void (async () => {
            try {
                const snapshot = await (0, surveys_1.getWorkerHealthSnapshot)();
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
    void (0, surveys_1.releaseWhatsAppWorkerLease)(workerInstanceId);
    console.log(`[whatsapp-worker] cerrando por ${signal}`);
}
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
void main().catch((error) => {
    console.error("[whatsapp-worker] error fatal", error);
    process.exit(1);
});
