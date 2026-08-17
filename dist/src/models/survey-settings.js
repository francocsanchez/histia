"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurveySettingsModel = void 0;
const mongoose_1 = require("mongoose");
const surveySettingsSchema = new mongoose_1.Schema({
    surveysEnabled: { type: Boolean, default: true },
    globalPause: { type: Boolean, default: false },
    phoneForAppointments: { type: String, default: "2995099606" },
    sendIntervalSeconds: { type: Number, default: 60 },
    sendWindowStart: { type: String, default: "09:00" },
    sendWindowEnd: { type: String, default: "18:00" },
    noResponseTimeoutHours: { type: Number, default: 24 },
    technicalRetryLimit: { type: Number, default: 2 },
    surveyIntroTemplate: { type: String, required: true },
    commentOptInTemplate: { type: String, required: true },
    commentRequestTemplate: { type: String, required: true },
    thankYouTemplate: { type: String, required: true },
    invalidRatingTemplate: { type: String, required: true },
    invalidCommentOptInTemplate: { type: String, required: true },
    unsupportedCommentTemplate: { type: String, required: true },
    spontaneousMessageTemplate: { type: String, required: true },
}, {
    collection: "surveySettings",
    timestamps: true,
});
exports.SurveySettingsModel = mongoose_1.models.SurveySettings ||
    (0, mongoose_1.model)("SurveySettings", surveySettingsSchema);
