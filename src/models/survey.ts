import { Model, Schema, Types, model, models } from "mongoose";

import { surveyStatusValues } from "@/types/domain";

export interface SurveyDocument {
  _id: string;
  campaignId: Types.ObjectId;
  patientNameSnapshot: string;
  doctorNameSnapshot: string;
  phoneRaw: string;
  phoneE164: string;
  attendanceAt: Date;
  status: (typeof surveyStatusValues)[number];
  rating: number | null;
  comment: string | null;
  createdByUserId: Types.ObjectId;
  scheduledAt: Date | null;
  leaseUntil: Date | null;
  sendAttemptCount: number;
  providerMessageId: string | null;
  sentAt: Date | null;
  firstResponseAt: Date | null;
  completedAt: Date | null;
  lastInboundAt: Date | null;
  invalidReplyCount: number;
  technicalError: string | null;
  deliveryResolution: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const surveySchema = new Schema<SurveyDocument>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
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
      enum: surveyStatusValues,
      required: true,
      default: "queued",
      index: true,
    },
    rating: { type: Number, default: null },
    comment: { type: String, default: null },
    createdByUserId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    collection: "surveys",
    timestamps: true,
  },
);

surveySchema.index({ campaignId: 1, status: 1 });
surveySchema.index({ phoneE164: 1, attendanceAt: 1 }, { unique: true });
surveySchema.index({ phoneE164: 1, status: 1 });

export const SurveyModel =
  (models.Survey as Model<SurveyDocument>) ||
  model<SurveyDocument>("Survey", surveySchema);
