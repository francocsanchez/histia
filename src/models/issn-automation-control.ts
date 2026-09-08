import { Model, Schema, model, models } from "mongoose";

export type IssnAutomationStatus = "idle" | "running" | "completed" | "error";
export type IssnAutomationOrigin = "manual" | "scheduled" | null;

export interface IssnAutomationControlDocument {
  _id: string;
  singletonKey: string;
  status: IssnAutomationStatus;
  origin: IssnAutomationOrigin;
  manualRunRequestedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  total: number;
  processed: number;
  deactivated: number;
  unchanged: number;
  errors: number;
  lastError: string | null;
  workerLeaseOwner: string | null;
  workerLeaseUntil: Date | null;
  workerHeartbeatAt: Date | null;
  lastScheduledRunDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const issnAutomationControlSchema = new Schema<IssnAutomationControlDocument>(
  {
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
  },
  { collection: "issnAutomationControl", timestamps: true, suppressReservedKeysWarning: true },
);

export const IssnAutomationControlModel =
  (models.IssnAutomationControl as Model<IssnAutomationControlDocument>) ||
  model<IssnAutomationControlDocument>("IssnAutomationControl", issnAutomationControlSchema);
