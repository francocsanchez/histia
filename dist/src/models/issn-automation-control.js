"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssnAutomationControlModel = void 0;
const mongoose_1 = require("mongoose");
const issnAutomationControlSchema = new mongoose_1.Schema({
    singletonKey: { type: String, required: true, unique: true, default: "main" },
    status: { type: String, enum: ["idle", "running", "completed", "error"], default: "idle" },
    origin: { type: String, enum: ["manual", "scheduled"], default: null },
    manualRunRequestedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    deactivated: { type: Number, default: 0 },
    unchanged: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    workerLeaseOwner: { type: String, default: null },
    workerLeaseUntil: { type: Date, default: null },
    workerHeartbeatAt: { type: Date, default: null },
    lastScheduledRunDate: { type: String, default: null },
}, { collection: "issnAutomationControl", timestamps: true, suppressReservedKeysWarning: true });
exports.IssnAutomationControlModel = mongoose_1.models.IssnAutomationControl ||
    (0, mongoose_1.model)("IssnAutomationControl", issnAutomationControlSchema);
