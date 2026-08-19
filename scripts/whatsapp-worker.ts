import "module-alias/register";
import { createServer } from "node:http";
import { hostname } from "node:os";
import { loadEnvConfig } from "@next/env";

import {
  acquireWhatsAppWorkerLease,
  buildSurveyIntroMessage,
  clearWhatsAppAuthState,
  ensureSurveySettingsForWorker,
  expireNoResponseSurveys,
  getWhatsAppConnectionControlState,
  getStoredWhatsAppAuthRecords,
  getWorkerHealthSnapshot,
  markLeasesAsDeliveryUnknown,
  markSurveySendFailure,
  markSurveySendSuccess,
  processIncomingWhatsAppMessage,
  releaseWhatsAppWorkerLease,
  removeWhatsAppAuthRecord,
  takeNextSurveyLease,
  updateWhatsAppConnectionState,
  upsertWhatsAppAuthRecord,
} from "@/services/surveys";
import { getServerEnv } from "@/lib/env";
import { getWhatsAppReconnectDelayMs } from "@/lib/whatsapp-connection";
import { extractPhoneE164FromWhatsAppKey, getWhatsappJid } from "@/lib/surveys";

loadEnvConfig(process.cwd());

type AuthStateModule = {
  BufferJSON: {
    replacer: (key: string, value: unknown) => unknown;
    reviver: (key: string, value: unknown) => unknown;
  };
  Browsers: {
    macOS: (name: string) => [string, string, string];
    ubuntu: (name: string) => [string, string, string];
  };
  DisconnectReason: Record<string, number>;
  default: (config: Record<string, unknown>) => {
    ev: {
      on: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    sendMessage: (
      jid: string,
      content: { text: string },
    ) => Promise<{ key?: { id?: string | null } }>;
    logout: () => Promise<void>;
    user?: { id?: string | null };
  };
  fetchLatestBaileysVersion: () => Promise<{ version: number[] }>;
  fetchLatestWaWebVersion?: () => Promise<{ version: number[]; isLatest: boolean }>;
  initAuthCreds: () => unknown;
  makeCacheableSignalKeyStore: (
    store: {
      get: (type: string, ids: string[]) => Promise<Record<string, unknown>>;
      set: (data: Record<string, Record<string, unknown>>) => Promise<void>;
    },
    logger: Record<string, (...args: unknown[]) => void>,
  ) => unknown;
};

let workerActive = true;
let socketBooting = false;
let socketConnected = false;
let workerOwnsLease = false;
let socketGeneration = 0;
let resetInProgress = false;
let currentDesiredState: "running" | "stopped" = "running";
let appliedResetNonce: number | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempt = 0;
let currentSocket:
  | {
      sendMessage: (
        jid: string,
        content: { text: string },
      ) => Promise<{ key?: { id?: string | null } }>;
      logout: () => Promise<void>;
      end?: (error?: Error) => void;
    }
  | null = null;
const workerInstanceId = `${hostname()}:${process.pid}`;
const WORKER_LEASE_TTL_MS = 30_000;
const logger = {
  trace: (...args: unknown[]) => console.debug("[whatsapp-worker][trace]", ...args),
  debug: (...args: unknown[]) => console.debug("[whatsapp-worker][debug]", ...args),
  info: (...args: unknown[]) => console.info("[whatsapp-worker][info]", ...args),
  warn: (...args: unknown[]) => console.warn("[whatsapp-worker][warn]", ...args),
  error: (...args: unknown[]) => console.error("[whatsapp-worker][error]", ...args),
};

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

async function createMongoAuthState(baileys: AuthStateModule) {
  const records = await getStoredWhatsAppAuthRecords();
  const recordMap = new Map(records.map((record) => [record.key, record.value]));
  const parseStoredValue = (value: unknown) => {
    if (typeof value !== "string") {
      return value;
    }

    return JSON.parse(value, baileys.BufferJSON.reviver);
  };
  const serializeValue = (value: unknown) =>
    JSON.stringify(value, baileys.BufferJSON.replacer);

  const creds = parseStoredValue(recordMap.get("creds")) ?? baileys.initAuthCreds();
  const keysStore = {
    get: async (type: string, ids: string[]) => {
      const data: Record<string, unknown> = {};

      for (const id of ids) {
        const value = recordMap.get(`key:${type}:${id}`);

        if (value !== undefined) {
          data[id] = parseStoredValue(value);
        }
      }

      return data;
    },
    set: async (data: Record<string, Record<string, unknown>>) => {
      for (const category of Object.keys(data)) {
        for (const id of Object.keys(data[category])) {
          const value = data[category][id];
          const storageKey = `key:${category}:${id}`;

          if (value) {
            const serialized = serializeValue(value);
            recordMap.set(storageKey, serialized);
            await upsertWhatsAppAuthRecord(storageKey, serialized);
          } else {
            recordMap.delete(storageKey);
            await removeWhatsAppAuthRecord(storageKey);
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
      await upsertWhatsAppAuthRecord("creds", serialized);
    },
  };
}

function discardSocket(reason: string) {
  clearReconnectTimer();
  invalidateSocketGeneration();

  if (currentSocket?.end) {
    try {
      currentSocket.end(new Error(reason));
    } catch (error) {
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
  } catch (error) {
    logger.warn("logout fallo, se limpia auth igual", error);
  } finally {
    currentSocket = null;
    socketConnected = false;
  }

  await clearWhatsAppAuthState();
}

async function applyTerminalDisconnect(input: {
  lastError: string;
  lastDisconnectCode: number | null;
  lastDisconnectReason: string;
}) {
  currentDesiredState = "stopped";
  resetReconnectBackoff();
  await clearWhatsAppAuthState();
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
}

async function applyRequestedReset(input: {
  desiredState: "running" | "stopped";
  resetNonce: number;
}) {
  resetInProgress = true;
  currentDesiredState = input.desiredState;
  resetReconnectBackoff();

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
  } finally {
    resetInProgress = false;
  }
}

async function bootSocket() {
  if (
    socketBooting ||
    !workerActive ||
    !workerOwnsLease ||
    resetInProgress ||
    currentDesiredState !== "running"
  ) {
    return;
  }

  socketBooting = true;
  clearReconnectTimer();
  const generation = ++socketGeneration;

  try {
    const baileys = (await import("@whiskeysockets/baileys")) as unknown as AuthStateModule;
    const { state, saveCreds } = await createMongoAuthState(baileys);
    const latest = await (
      baileys.fetchLatestWaWebVersion?.() ?? baileys.fetchLatestBaileysVersion()
    ).catch(() => ({
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

      void saveCreds();
    });

    sock.ev.on("connection.update", (...args: unknown[]) => {
      void (async () => {
        if (generation !== socketGeneration) {
          return;
        }

        const update = (args[0] ?? {}) as Record<string, unknown>;
        const qr = typeof update.qr === "string" ? update.qr : null;
        const connection = typeof update.connection === "string" ? update.connection : null;
        const statusCode = Number(
          (update.lastDisconnect as { error?: { output?: { statusCode?: number } } } | undefined)
            ?.error?.output?.statusCode ?? 0,
        );

        if (qr) {
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
              lastError:
                "WhatsApp cerro la sesion porque otra instancia intento usar el mismo numero. Deja solo un worker activo y prepara un nuevo QR si hace falta.",
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

    sock.ev.on("messages.upsert", (...args: unknown[]) => {
      void (async () => {
        if (generation !== socketGeneration) {
          return;
        }

        const event = (args[0] ?? {}) as Record<string, unknown>;
        const messages = Array.isArray(event.messages) ? event.messages : [];

        for (const item of messages) {
          const message = item as {
            key?: {
              fromMe?: boolean | null;
              remoteJid?: string | null;
              remoteJidAlt?: string | null;
              participant?: string | null;
              participantAlt?: string | null;
            };
            message?: Record<string, unknown> | null;
          };

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
              sendText: async (jid: string, text: string) => {
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
  } catch (error) {
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

    scheduleReconnect();
  } finally {
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
    const text = await buildSurveyIntroMessage(String(lease._id));
    const sent = await currentSocket.sendMessage(getWhatsappJid(lease.phoneE164), { text });

    await markSurveySendSuccess({
      surveyId: String(lease._id),
      providerMessageId: sent.key?.id ?? `sent-${Date.now()}`,
    });
  } catch (error) {
    await markSurveySendFailure({
      surveyId: String(lease._id),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
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
        discardSocket("worker lease perdida");
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        continue;
      }

      const connectionControl = await getWhatsAppConnectionControlState();
      currentDesiredState = connectionControl.desiredState;

      if (appliedResetNonce === null) {
        appliedResetNonce =
          connectionControl.status === "disconnecting" ? connectionControl.resetNonce - 1 : connectionControl.resetNonce;
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
      } else if (!currentSocket && !socketBooting && !resetInProgress) {
        await bootSocket();
      }

      await expireNoResponseSurveys();
      await sendPendingSurveyIfPossible();
    } catch (error) {
      logger.error("fallo el loop del worker", error);
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

function startHealthServer() {
  const env = getServerEnv();
  const port = env.WHATSAPP_WORKER_PORT ?? 3010;
  const strictHealthPort = process.env.NODE_ENV === "production";

  const server = createServer((_, response) => {
    void (async () => {
      try {
        const snapshot = await getWorkerHealthSnapshot();
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: true, ...snapshot }));
      } catch (error) {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    })();
  });

  server.on("error", (error) => {
    if ((error as NodeJS.ErrnoException).code === "EADDRINUSE" && !strictHealthPort) {
      console.warn(
        `[whatsapp-worker] puerto ${port} ya esta en uso; en desarrollo se continua sin health server local`,
      );
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

function shutdown(signal: string) {
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
