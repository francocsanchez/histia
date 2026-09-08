"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIssnAutomationStatus = getIssnAutomationStatus;
exports.requestManualIssnRun = requestManualIssnRun;
exports.acquireIssnWorkerLease = acquireIssnWorkerLease;
exports.releaseIssnWorkerLease = releaseIssnWorkerLease;
exports.recoverInterruptedIssnRun = recoverInterruptedIssnRun;
exports.startIssnRun = startIssnRun;
exports.setIssnRunTotal = setIssnRunTotal;
exports.updateIssnRunProgress = updateIssnRunProgress;
exports.finishIssnRun = finishIssnRun;
exports.getIssnPatients = getIssnPatients;
exports.deactivateIssnPatient = deactivateIssnPatient;
exports.createIssnWorkerInstanceId = createIssnWorkerInstanceId;
const node_os_1 = require("node:os");
const api_1 = require("@/lib/api");
const mongoose_1 = require("@/lib/db/mongoose");
const issn_automation_control_1 = require("@/models/issn-automation-control");
const obra_social_1 = require("@/models/obra-social");
const paciente_1 = require("@/models/paciente");
const CONTROL_KEY = "main";
const LEASE_TTL_MS = 30_000;
function toDto(control) {
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
    await (0, mongoose_1.connectToDatabase)();
    const control = await issn_automation_control_1.IssnAutomationControlModel.findOneAndUpdate({ singletonKey: CONTROL_KEY }, { $setOnInsert: { singletonKey: CONTROL_KEY } }, { returnDocument: "after", upsert: true });
    if (!control) {
        throw new Error("No se pudo inicializar el control de automatizacion ISSN");
    }
    return control;
}
async function getIssnAutomationStatus() {
    const control = await ensureControl();
    return toDto(control);
}
async function requestManualIssnRun() {
    const control = await ensureControl();
    if (control.status === "running" || control.manualRunRequestedAt) {
        throw new api_1.AppError("VALIDATION_ERROR", "Ya hay una ejecucion ISSN en curso o pendiente", 409);
    }
    control.manualRunRequestedAt = new Date();
    await control.save();
    return toDto(control);
}
async function acquireIssnWorkerLease(ownerId) {
    await ensureControl();
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + LEASE_TTL_MS);
    const control = await issn_automation_control_1.IssnAutomationControlModel.findOneAndUpdate({
        singletonKey: CONTROL_KEY,
        $or: [
            { workerLeaseUntil: null },
            { workerLeaseUntil: { $lt: now } },
            { workerLeaseOwner: ownerId },
        ],
    }, { $set: { workerLeaseOwner: ownerId, workerLeaseUntil: leaseUntil, workerHeartbeatAt: now } }, { returnDocument: "after" });
    return control?.workerLeaseOwner === ownerId;
}
async function releaseIssnWorkerLease(ownerId) {
    await (0, mongoose_1.connectToDatabase)();
    await issn_automation_control_1.IssnAutomationControlModel.updateOne({ singletonKey: CONTROL_KEY, workerLeaseOwner: ownerId }, { $set: { workerLeaseOwner: null, workerLeaseUntil: null } });
}
async function recoverInterruptedIssnRun(ownerId) {
    await (0, mongoose_1.connectToDatabase)();
    await issn_automation_control_1.IssnAutomationControlModel.updateOne({ singletonKey: CONTROL_KEY, status: "running", workerLeaseOwner: ownerId }, {
        $set: {
            status: "error",
            finishedAt: new Date(),
            lastError: "La ejecucion ISSN anterior fue interrumpida al reiniciar el worker",
        },
    });
}
async function startIssnRun(origin) {
    await (0, mongoose_1.connectToDatabase)();
    const now = new Date();
    const control = await issn_automation_control_1.IssnAutomationControlModel.findOneAndUpdate({ singletonKey: CONTROL_KEY, status: { $ne: "running" } }, {
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
    }, { returnDocument: "after" });
    return Boolean(control);
}
async function setIssnRunTotal(total) {
    await issn_automation_control_1.IssnAutomationControlModel.updateOne({ singletonKey: CONTROL_KEY, status: "running" }, { $set: { total } });
}
async function updateIssnRunProgress(input) {
    const increment = { processed: 1 };
    if (input.deactivated)
        increment.deactivated = input.deactivated;
    if (input.unchanged)
        increment.unchanged = input.unchanged;
    if (input.error)
        increment.errors = 1;
    await issn_automation_control_1.IssnAutomationControlModel.updateOne({ singletonKey: CONTROL_KEY, status: "running" }, { $inc: increment, $set: { ...(input.error ? { lastError: input.error } : {}), workerHeartbeatAt: new Date() } });
}
async function finishIssnRun(status, error = null) {
    await issn_automation_control_1.IssnAutomationControlModel.updateOne({ singletonKey: CONTROL_KEY }, { $set: { status, finishedAt: new Date(), ...(error ? { lastError: error } : {}) } });
}
async function getIssnPatients() {
    await (0, mongoose_1.connectToDatabase)();
    const issn = await obra_social_1.ObraSocialModel.findOne({ nombreNormalizado: "issn" }).select("_id").lean();
    if (!issn)
        return [];
    return paciente_1.PacienteModel.find({ obraSocialId: issn._id }).select("_id dni activo").sort({ _id: 1 }).lean();
}
async function deactivateIssnPatient(patientId) {
    const result = await paciente_1.PacienteModel.updateOne({ _id: patientId, activo: true }, { $set: { activo: false } });
    return result.modifiedCount > 0;
}
function createIssnWorkerInstanceId() {
    return `${(0, node_os_1.hostname)()}:${process.pid}`;
}
