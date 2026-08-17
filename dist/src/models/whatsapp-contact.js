"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppContactModel = void 0;
const mongoose_1 = require("mongoose");
const whatsappContactSchema = new mongoose_1.Schema({
    phoneE164: { type: String, required: true, unique: true, index: true },
    lastSpontaneousReplyAt: { type: Date, default: null, index: true },
}, {
    collection: "whatsappContacts",
    timestamps: true,
});
exports.WhatsAppContactModel = mongoose_1.models.WhatsAppContact ||
    (0, mongoose_1.model)("WhatsAppContact", whatsappContactSchema);
