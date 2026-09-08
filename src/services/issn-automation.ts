import { hostname } from "node:os";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { IssnAutomationControlModel } from "@/models/issn-automation-control";
import { ObraSocialModel } from "@/models/obra-social";
import { PacienteModel } from "@/models/paciente";
import type { IssnAutomationOrigin, IssnAutomationStatus } from "@/models/issn-automation-control";

const CONTROL_KEY = "main";
const LEASE_TTL_MS = 30_000;

export type IssnAutomationDto = {
  status: IssnAutomationStatus;
  origin: IssnAutomationOrigin;
  startedAt: string | null;
  finishedAt: string | null;
  total: number;
  processed: number;
  deactivated: number;
  unchanged: number;
  errors: number;
  lastError: string | null;
  manualRunRequestedAt: string | null;
};

function toDto(control: {
  status: IssnAutomationStatus;
  origin: IssnAutomationOrigin;
  startedAt: Date | null;
  finishedAt: Date | null;
  total: number;
  processed: number;
  deactivated: number;
  unchanged: number;
  errors: number;
  lastError: string | null;
  manualRunRequestedAt: Date | null;
}): IssnAutomationDto {
  return {
    status: control.status,
    origin: control.origin,
    startedAt: control.startedAt?.toISOString() ?? null,
    finishedAt: control.finishedAt?.toISOString() ?? null,
    total: control.total,
    processed: control.processed,
    deactivated: control.deactivated,
    unchanged: control.unchanged,
    errors: control.errors,
    lastError: control.lastError,
    manualRunRequestedAt: control.manualRunRequestedAt?.toISOString() ?? null,
  };
}

async function ensureControl() {
  await connectToDatabase();
  const control = await IssnAutomationControlModel.findOneAndUpdate(
    { singletonKey: CONTROL_KEY },
    { $setOnInsert: { singletonKey: CONTROL_KEY } },
    { returnDocument: "after", upsert: true },
  );
  if (!control) {
    throw new Error("No se pudo inicializar el control de automatizacion ISSN");
  }
  return control;
}

export async function getIssnAutomationStatus() {
  const control = await ensureControl();
  return toDto(control);
}

export async function requestManualIssnRun() {
  const control = await ensureControl();
  if (control.status === "running" || control.manualRunRequestedAt) {
    throw new AppError("VALIDATION_ERROR", "Ya hay una ejecucion ISSN en curso o pendiente", 409);
  }

  control.manualRunRequestedAt = new Date();
  await control.save();
  return toDto(control);
}

export async function acquireIssnWorkerLease(ownerId: string) {
  await ensureControl();
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_TTL_MS);
  const control = await IssnAutomationControlModel.findOneAndUpdate(
    {
      singletonKey: CONTROL_KEY,
      $or: [
        { workerLeaseUntil: null },
        { workerLeaseUntil: { $lt: now } },
        { workerLeaseOwner: ownerId },
      ],
    },
    { $set: { workerLeaseOwner: ownerId, workerLeaseUntil: leaseUntil, workerHeartbeatAt: now } },
    { returnDocument: "after" },
  );
  return control?.workerLeaseOwner === ownerId;
}

export async function releaseIssnWorkerLease(ownerId: string) {
  await connectToDatabase();
  await IssnAutomationControlModel.updateOne(
    { singletonKey: CONTROL_KEY, workerLeaseOwner: ownerId },
    { $set: { workerLeaseOwner: null, workerLeaseUntil: null } },
  );
}

export async function recoverInterruptedIssnRun(ownerId: string) {
  await connectToDatabase();
  await IssnAutomationControlModel.updateOne(
    { singletonKey: CONTROL_KEY, status: "running", workerLeaseOwner: ownerId },
    {
      $set: {
        status: "error",
        finishedAt: new Date(),
        lastError: "La ejecucion ISSN anterior fue interrumpida al reiniciar el worker",
      },
    },
  );
}

export async function startIssnRun(origin: Exclude<IssnAutomationOrigin, null>) {
  await connectToDatabase();
  const now = new Date();
  const control = await IssnAutomationControlModel.findOneAndUpdate(
    { singletonKey: CONTROL_KEY, status: { $ne: "running" } },
    {
      $set: {
        status: "running",
        origin,
        startedAt: now,
        finishedAt: null,
        total: 0,
        processed: 0,
        deactivated: 0,
        unchanged: 0,
        errors: 0,
        lastError: null,
        manualRunRequestedAt: null,
      },
    },
    { returnDocument: "after" },
  );
  return Boolean(control);
}

export async function setIssnRunTotal(total: number) {
  await IssnAutomationControlModel.updateOne({ singletonKey: CONTROL_KEY, status: "running" }, { $set: { total } });
}

export async function updateIssnRunProgress(input: { deactivated?: number; unchanged?: number; error?: string }) {
  const increment: Record<string, number> = { processed: 1 };
  if (input.deactivated) increment.deactivated = input.deactivated;
  if (input.unchanged) increment.unchanged = input.unchanged;
  if (input.error) increment.errors = 1;
  await IssnAutomationControlModel.updateOne(
    { singletonKey: CONTROL_KEY, status: "running" },
    { $inc: increment, $set: { ...(input.error ? { lastError: input.error } : {}), workerHeartbeatAt: new Date() } },
  );
}

export async function finishIssnRun(status: "completed" | "error", error: string | null = null) {
  await IssnAutomationControlModel.updateOne(
    { singletonKey: CONTROL_KEY },
    { $set: { status, finishedAt: new Date(), ...(error ? { lastError: error } : {}) } },
  );
}

export async function getIssnPatients() {
  await connectToDatabase();
  const issn = await ObraSocialModel.findOne({ nombreNormalizado: "issn" }).select("_id").lean();
  if (!issn) return [];
  return PacienteModel.find({ obraSocialId: issn._id }).select("_id dni activo").sort({ _id: 1 }).lean();
}

export async function deactivateIssnPatient(patientId: string) {
  const result = await PacienteModel.updateOne({ _id: patientId, activo: true }, { $set: { activo: false } });
  return result.modifiedCount > 0;
}

export function createIssnWorkerInstanceId() {
  return `${hostname()}:${process.pid}`;
}
