import { createRequire } from "node:module";

const runtimeRequire = createRequire(__filename);
const runningWithTsx = process.execArgv.join(" ").indexOf("tsx") >= 0;

if (!runningWithTsx) {
  runtimeRequire("module-alias/register");
}

const { loadEnvConfig } = runtimeRequire("@next/env") as typeof import("@next/env");
const { verifyIssnAffiliation } = runtimeRequire("../src/lib/issn") as typeof import("../src/lib/issn");
const { IssnAutomationControlModel } = runtimeRequire("../src/models/issn-automation-control") as typeof import("../src/models/issn-automation-control");
const {
  acquireIssnWorkerLease,
  createIssnWorkerInstanceId,
  deactivateIssnPatient,
  finishIssnRun,
  getIssnPatients,
  getIssnAutomationStatus,
  releaseIssnWorkerLease,
  recoverInterruptedIssnRun,
  setIssnRunTotal,
  startIssnRun,
  updateIssnRunProgress,
} = runtimeRequire("../src/services/issn-automation") as typeof import("../src/services/issn-automation");

loadEnvConfig(process.cwd());

const POLL_MS = 15_000;
const QUERY_INTERVAL_MS = 3_000;
const MAX_CONSECUTIVE_ERRORS = 5;
const workerId = createIssnWorkerInstanceId();
let active = true;
let startupRecovered = false;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function argentinaDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function argentinaTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { hour: Number(values.hour), minute: Number(values.minute) };
}

async function shouldRunScheduled() {
  const status = await getIssnAutomationStatus();
  const clock = argentinaTime();
  if (status.status === "running" || clock.hour !== 2 || clock.minute !== 0) return false;
  const control = await IssnAutomationControlModel.findOne({ singletonKey: "main" }).lean();
  return control?.lastScheduledRunDate !== argentinaDateKey();
}

async function markScheduledRunDate() {
  await IssnAutomationControlModel.updateOne({ singletonKey: "main" }, { $set: { lastScheduledRunDate: argentinaDateKey() } });
}

async function run(origin: "manual" | "scheduled") {
  if (!(await startIssnRun(origin))) return;
  if (origin === "scheduled") await markScheduledRunDate();

  try {
    const patients = await getIssnPatients();
    await setIssnRunTotal(patients.length);
    let consecutiveErrors = 0;

    for (const patient of patients) {
      if (!active || !(await acquireIssnWorkerLease(workerId))) {
        await finishIssnRun("error", "La ejecucion ISSN fue interrumpida porque el worker perdio su lease");
        return;
      }

      const result = await verifyIssnAffiliation(patient.dni);
      if (result.kind === "error") {
        consecutiveErrors += 1;
        await updateIssnRunProgress({ error: result.error });
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          await finishIssnRun("error", "ISSN acumulo 5 errores consecutivos: " + result.error);
          return;
        }
      } else {
        consecutiveErrors = 0;
        const deactivated = result.kind === "baja" ? await deactivateIssnPatient(String(patient._id)) : false;
        await updateIssnRunProgress(deactivated ? { deactivated: 1 } : { unchanged: 1 });
      }
      if (patient !== patients[patients.length - 1]) await sleep(QUERY_INTERVAL_MS);
    }
    await finishIssnRun("completed");
  } catch (error) {
    await finishIssnRun("error", error instanceof Error ? error.message : "Error inesperado del worker ISSN");
  }
}

async function loop() {
  while (active) {
    try {
      if (await acquireIssnWorkerLease(workerId)) {
        if (!startupRecovered) {
          await recoverInterruptedIssnRun(workerId);
          startupRecovered = true;
        }
        const status = await getIssnAutomationStatus();
        if (status.manualRunRequestedAt && status.status !== "running") await run("manual");
        else if (await shouldRunScheduled()) await run("scheduled");
      }
    } catch (error) {
      console.error("[issn-worker] fallo del loop", error);
    }
    await sleep(POLL_MS);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    active = false;
    void releaseIssnWorkerLease(workerId);
  });
}

void loop();
