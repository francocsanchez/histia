"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppAuthModel = void 0;
const mongoose_1 = require("mongoose");
const whatsappAuthSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose_1.Schema.Types.Mixed, required: true },
}, {
    collection: "whatsappAuth",
    timestamps: true,
});
exports.WhatsAppAuthModel = mongoose_1.models.WhatsAppAuth ||
    (0, mongoose_1.model)("WhatsAppAuth", whatsappAuthSchema);
