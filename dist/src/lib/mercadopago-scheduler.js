"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMercadoPagoSchedulers = registerMercadoPagoSchedulers;
const mercadopago_sync_1 = require("@/services/mercadopago-sync");
const mercadopago_1 = require("@/lib/mercadopago");
const schedulerState = global.__histiaMercadoPagoScheduler ?? {
    started: false,
    timers: [],
    runningJobs: new Set(),
};
if (process.env.NODE_ENV !== "production") {
    global.__histiaMercadoPagoScheduler = schedulerState;
}
function clearSchedulerTimers() {
    schedulerState.timers.forEach((timer) => clearTimeout(timer));
    schedulerState.timers = [];
}
async function runSchedulerJob(name, task) {
    if (schedulerState.runningJobs.has(name)) {
        return;
    }
    schedulerState.runningJobs.add(name);
    try {
        await task();
    }
    catch (error) {
        if ((0, mercadopago_sync_1.isMercadoPagoRateLimitError)(error)) {
            console.warn("[mercadopago-scheduler] se omitio una tarea por rate limit de Mercado Pago", {
                name,
                error: error instanceof Error ? error.message : String(error),
            });
            return;
        }
        console.error("[mercadopago-scheduler] fallo una tarea", {
            name,
            error: error instanceof Error ? error.message : String(error),
        });
    }
    finally {
        schedulerState.runningJobs.delete(name);
    }
}
function getMillisecondsUntilNextRecoveryRun(now = new Date()) {
    const next = new Date(now);
    next.setHours(mercadopago_1.MERCADO_PAGO_RECOVERY_HOUR, mercadopago_1.MERCADO_PAGO_RECOVERY_MINUTE, 0, 0);
    if (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
    }
    return next.getTime() - now.getTime();
}
function scheduleDailyRecovery() {
    const delay = getMillisecondsUntilNextRecoveryRun();
    const timer = setTimeout(() => {
        void runSchedulerJob("daily-recovery-sync", async () => {
            await (0, mercadopago_sync_1.startMercadoPagoSync)({ syncType: "daily_recovery" });
        });
        scheduleDailyRecovery();
    }, delay);
    schedulerState.timers.push(timer);
}
function registerMercadoPagoSchedulers() {
    if (schedulerState.started || process.env.NODE_ENV === "test") {
        return;
    }
    schedulerState.started = true;
    if (!(0, mercadopago_1.hasMercadoPagoAccessToken)()) {
        console.warn("[mercadopago-scheduler] MERCADOPAGO_ACCESS_TOKEN no configurado, se omiten schedulers");
        return;
    }
    void runSchedulerJob("pending-sync-check", async () => {
        await (0, mercadopago_sync_1.checkPendingMercadoPagoSyncs)();
    });
    void runSchedulerJob("hourly-sync", async () => {
        await (0, mercadopago_sync_1.startMercadoPagoSync)({ syncType: "hourly" });
    });
    schedulerState.timers.push(setInterval(() => {
        void runSchedulerJob("pending-sync-check", async () => {
            await (0, mercadopago_sync_1.checkPendingMercadoPagoSyncs)();
        });
    }, mercadopago_1.MERCADO_PAGO_PENDING_CHECK_INTERVAL_MS));
    schedulerState.timers.push(setInterval(() => {
        void runSchedulerJob("hourly-sync", async () => {
            await (0, mercadopago_sync_1.startMercadoPagoSync)({ syncType: "hourly" });
        });
    }, mercadopago_1.MERCADO_PAGO_HOURLY_INTERVAL_MS));
    scheduleDailyRecovery();
    const shutdown = () => {
        clearSchedulerTimers();
        schedulerState.started = false;
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
}
