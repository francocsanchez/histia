import {
  checkPendingMercadoPagoSyncs,
  startMercadoPagoSync,
} from "@/services/mercadopago-sync";
import {
  hasMercadoPagoAccessToken,
  MERCADO_PAGO_HOURLY_INTERVAL_MS,
  MERCADO_PAGO_PENDING_CHECK_INTERVAL_MS,
  MERCADO_PAGO_RECOVERY_HOUR,
  MERCADO_PAGO_RECOVERY_MINUTE,
} from "@/lib/mercadopago";

declare global {
  var __histiaMercadoPagoScheduler:
    | {
        started: boolean;
        timers: NodeJS.Timeout[];
        runningJobs: Set<string>;
      }
    | undefined;
}

const schedulerState = global.__histiaMercadoPagoScheduler ?? {
  started: false,
  timers: [],
  runningJobs: new Set<string>(),
};

if (process.env.NODE_ENV !== "production") {
  global.__histiaMercadoPagoScheduler = schedulerState;
}

function clearSchedulerTimers() {
  schedulerState.timers.forEach((timer) => clearTimeout(timer));
  schedulerState.timers = [];
}

async function runSchedulerJob(name: string, task: () => Promise<void>) {
  if (schedulerState.runningJobs.has(name)) {
    return;
  }

  schedulerState.runningJobs.add(name);

  try {
    await task();
  } catch (error) {
    console.error("[mercadopago-scheduler] fallo una tarea", {
      name,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    schedulerState.runningJobs.delete(name);
  }
}

function getMillisecondsUntilNextRecoveryRun(now = new Date()) {
  const next = new Date(now);
  next.setHours(MERCADO_PAGO_RECOVERY_HOUR, MERCADO_PAGO_RECOVERY_MINUTE, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime() - now.getTime();
}

function scheduleDailyRecovery() {
  const delay = getMillisecondsUntilNextRecoveryRun();
  const timer = setTimeout(() => {
    void runSchedulerJob("daily-recovery-sync", async () => {
      await startMercadoPagoSync({ syncType: "daily_recovery" });
    });

    scheduleDailyRecovery();
  }, delay);

  schedulerState.timers.push(timer);
}

export function registerMercadoPagoSchedulers() {
  if (schedulerState.started || process.env.NODE_ENV === "test") {
    return;
  }

  schedulerState.started = true;

  if (!hasMercadoPagoAccessToken()) {
    console.warn(
      "[mercadopago-scheduler] MERCADOPAGO_ACCESS_TOKEN no configurado, se omiten schedulers",
    );
    return;
  }

  void runSchedulerJob("pending-sync-check", async () => {
    await checkPendingMercadoPagoSyncs();
  });

  void runSchedulerJob("hourly-sync", async () => {
    await startMercadoPagoSync({ syncType: "hourly" });
  });

  schedulerState.timers.push(
    setInterval(() => {
      void runSchedulerJob("pending-sync-check", async () => {
        await checkPendingMercadoPagoSyncs();
      });
    }, MERCADO_PAGO_PENDING_CHECK_INTERVAL_MS),
  );

  schedulerState.timers.push(
    setInterval(() => {
      void runSchedulerJob("hourly-sync", async () => {
        await startMercadoPagoSync({ syncType: "hourly" });
      });
    }, MERCADO_PAGO_HOURLY_INTERVAL_MS),
  );

  scheduleDailyRecovery();

  const shutdown = () => {
    clearSchedulerTimers();
    schedulerState.started = false;
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
