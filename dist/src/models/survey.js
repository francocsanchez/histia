"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurveyModel = void 0;
const mongoose_1 = require("mongoose");
const domain_1 = require("@/types/domain");
const surveySchema = new mongoose_1.Schema({
    campaignId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "SurveyCampaign",
        required: true,
        index: true,
    },
    patientNameSnapshot: { type: String, required: true, trim: true },
    doctorNameSnapshot: { type: String, required: true, trim: true },
    phoneRaw: { type: String, required: true, trim: true },
    phoneE164: { type: String, required: true, index: true },
    attendanceAt: { type: Date, required: true, index: true },
    status: {
        type: String,
        enum: domain_1.surveyStatusValues,
        required: true,
        default: "queued",
        index: true,
    },
    rating: { type: Number, default: null },
    comment: { type: String, default: null },
    createdByUserId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    scheduledAt: { type: Date, default: null, index: true },
    leaseUntil: { type: Date, default: null, index: true },
    sendAttemptCount: { type: Number, default: 0 },
    providerMessageId: { type: String, default: null, index: true },
    sentAt: { type: Date, default: null, index: true },
    firstResponseAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastInboundAt: { type: Date, default: null },
    invalidReplyCount: { type: Number, default: 0 },
    technicalError: { type: String, default: null },
    deliveryResolution: { type: String, default: null },
}, {
    collection: "surveys",
    timestamps: true,
});
surveySchema.index({ campaignId: 1, status: 1 });
surveySchema.index({ phoneE164: 1, attendanceAt: 1 }, { unique: true });
surveySchema.index({ phoneE164: 1, status: 1 });
exports.SurveyModel = mongoose_1.models.Survey ||
    (0, mongoose_1.model)("Survey", surveySchema);
