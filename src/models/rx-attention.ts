import { Model, Schema, Types, model, models } from "mongoose";

export interface RxAttentionDocument {
  _id: string;
  fecha: Date;
  pacienteId: Types.ObjectId;
  derivanteTipo: "interno" | "externo";
  derivanteUserId: Types.ObjectId | null;
  derivanteExternoNombre: string | null;
  tipoRx: "carpal" | "panoramica";
  valorCentavos: number | null;
  usuarioGeneradorId: Types.ObjectId;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const rxAttentionSchema = new Schema<RxAttentionDocument>(
  {
    fecha: { type: Date, required: true, index: true },
    pacienteId: {
      type: Schema.Types.ObjectId,
      ref: "Paciente",
      required: true,
      index: true,
    },
    derivanteTipo: {
      type: String,
      enum: ["interno", "externo"],
      required: true,
    },
    derivanteUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    derivanteExternoNombre: {
      type: String,
      default: null,
      trim: true,
    },
    tipoRx: {
      type: String,
      enum: ["carpal", "panoramica"],
      required: true,
      index: true,
    },
    valorCentavos: {
      type: Number,
      default: null,
      min: 0,
    },
    usuarioGeneradorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    observaciones: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    collection: "rx_attentions",
    timestamps: true,
  },
);

rxAttentionSchema.index({ fecha: -1, tipoRx: 1 });

export const RxAttentionModel =
  (models.RxAttention as Model<RxAttentionDocument>) ||
  model<RxAttentionDocument>("RxAttention", rxAttentionSchema);
