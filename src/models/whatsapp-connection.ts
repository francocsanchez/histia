import { Model, Schema, model, models } from "mongoose";

export interface WhatsAppConnectionDocument {
  _id: string;
  singletonKey: string;
  status: "disconnected" | "connecting" | "qr_required" | "connected" | "disconnecting" | "error";
  phoneNumber: string | null;
  qr: string | null;
  qrExpiresAt: Date | null;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  lastError: string | null;
  disconnectRequestedAt: Date | null;
  workerLeaseOwner: string | null;
  workerLeaseUntil: Date | null;
  workerHeartbeatAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const whatsappConnectionSchema = new Schema<WhatsAppConnectionDocument>(
  {
    singletonKey: { type: String, required: true, unique: true, index: true, default: "main" },
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
    disconnectRequestedAt: { type: Date, default: null },
    workerLeaseOwner: { type: String, default: null },
    workerLeaseUntil: { type: Date, default: null },
    workerHeartbeatAt: { type: Date, default: null },
  },
  {
    collection: "whatsappConnection",
    timestamps: true,
  },
);

export const WhatsAppConnectionModel =
  (models.WhatsAppConnection as Model<WhatsAppConnectionDocument>) ||
  model<WhatsAppConnectionDocument>("WhatsAppConnection", whatsappConnectionSchema);
