"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurveyCampaignModel = void 0;
const mongoose_1 = require("mongoose");
const domain_1 = require("@/types/domain");
const surveyCampaignSchema = new mongoose_1.Schema({
    fileName: { type: String, required: true, trim: true },
    importedByUserId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: domain_1.surveyCampaignStatusValues,
        default: "ready",
        index: true,
    },
    totalRows: { type: Number, required: true },
    validRows: { type: Number, required: true },
    duplicateRows: { type: Number, required: true },
    invalidRows: { type: Number, required: true },
    startedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
}, {
    collection: "surveyCampaigns",
    timestamps: true,
});
surveyCampaignSchema.index({ createdAt: -1 });
exports.SurveyCampaignModel = mongoose_1.models.SurveyCampaign ||
    (0, mongoose_1.model)("SurveyCampaign", surveyCampaignSchema);
