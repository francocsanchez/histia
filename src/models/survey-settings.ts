import { Model, Schema, model, models } from "mongoose";

export interface SurveySettingsDocument {
  _id: string;
  surveysEnabled: boolean;
  globalPause: boolean;
  phoneForAppointments: string;
  sendIntervalSeconds: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  noResponseTimeoutHours: number;
  technicalRetryLimit: number;
  surveyIntroTemplate: string;
  commentOptInTemplate: string;
  commentRequestTemplate: string;
  thankYouTemplate: string;
  invalidRatingTemplate: string;
  invalidCommentOptInTemplate: string;
  unsupportedCommentTemplate: string;
  spontaneousMessageTemplate: string;
  createdAt: Date;
  updatedAt: Date;
}

const surveySettingsSchema = new Schema<SurveySettingsDocument>(
  {
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
  },
  {
    collection: "surveySettings",
    timestamps: true,
  },
);

export const SurveySettingsModel =
  (models.SurveySettings as Model<SurveySettingsDocument>) ||
  model<SurveySettingsDocument>("SurveySettings", surveySettingsSchema);
