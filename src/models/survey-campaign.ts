import { Model, Schema, Types, model, models } from "mongoose";

import { surveyCampaignStatusValues } from "@/types/domain";

export interface SurveyCampaignDocument {
  _id: string;
  fileName: string;
  importedByUserId: Types.ObjectId;
  status: (typeof surveyCampaignStatusValues)[number];
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  startedAt: Date | null;
  pausedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const surveyCampaignSchema = new Schema<SurveyCampaignDocument>(
  {
    fileName: { type: String, required: true, trim: true },
    importedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: surveyCampaignStatusValues,
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
  },
  {
    collection: "surveyCampaigns",
    timestamps: true,
  },
);

surveyCampaignSchema.index({ createdAt: -1 });

export const SurveyCampaignModel =
  (models.SurveyCampaign as Model<SurveyCampaignDocument>) ||
  model<SurveyCampaignDocument>("SurveyCampaign", surveyCampaignSchema);
