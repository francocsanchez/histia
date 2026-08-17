import { Model, Schema, model, models } from "mongoose";

export interface WhatsAppContactDocument {
  _id: string;
  phoneE164: string;
  lastSpontaneousReplyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const whatsappContactSchema = new Schema<WhatsAppContactDocument>(
  {
    phoneE164: { type: String, required: true, unique: true, index: true },
    lastSpontaneousReplyAt: { type: Date, default: null, index: true },
  },
  {
    collection: "whatsappContacts",
    timestamps: true,
  },
);

export const WhatsAppContactModel =
  (models.WhatsAppContact as Model<WhatsAppContactDocument>) ||
  model<WhatsAppContactDocument>("WhatsAppContact", whatsappContactSchema);
