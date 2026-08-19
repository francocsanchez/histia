"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppConnectionModel = void 0;
const mongoose_1 = require("mongoose");
const whatsappConnectionSchema = new mongoose_1.Schema({
    singletonKey: { type: String, required: true, unique: true, index: true, default: "main" },
    desiredState: {
        type: String,
        enum: ["running", "stopped"],
        default: "running",
    },
    resetNonce: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ["disconnected", "connecting", "qr_required", "connected", "disconnecting", "error"],
        default: "disconnected",
        index: true,
    },
    phoneNumber: { type: String, default: null },
    qr: { type: String, default: null },
    qrExpiresAt: { type: Date, default: null },
    lastConnectedAt: { type: Date, default: null },
    lastDisconnectedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    lastDisconnectCode: { type: Number, default: null },
    lastDisconnectReason: { type: String, default: null },
    disconnectRequestedAt: { type: Date, default: null },
    workerLeaseOwner: { type: String, default: null },
    workerLeaseUntil: { type: Date, default: null },
    workerHeartbeatAt: { type: Date, default: null },
}, {
    collection: "whatsappConnection",
    timestamps: true,
});
exports.WhatsAppConnectionModel = mongoose_1.models.WhatsAppConnection ||
    (0, mongoose_1.model)("WhatsAppConnection", whatsappConnectionSchema);
