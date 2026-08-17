import { Model, Schema, model, models } from "mongoose";

export interface WhatsAppAuthDocument {
  _id: string;
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const whatsappAuthSchema = new Schema<WhatsAppAuthDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  {
    collection: "whatsappAuth",
    timestamps: true,
  },
);

export const WhatsAppAuthModel =
  (models.WhatsAppAuth as Model<WhatsAppAuthDocument>) ||
  model<WhatsAppAuthDocument>("WhatsAppAuth", whatsappAuthSchema);
