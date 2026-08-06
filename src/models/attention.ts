import { Model, Schema, Types, model, models } from "mongoose";

import { AttentionCodeStatus, PaymentStatus } from "@/types/domain";

export interface AttentionCodeLineDocument {
  _id: Types.ObjectId;
  codigoObraSocialId: Types.ObjectId;
  pieza: string | null;
  coseguroCentavos: number | null;
  coseguroOdontoCentavos: number | null;
  observacion: string | null;
  pagoOdontologoCentavos: number;
  estado: AttentionCodeStatus;
  codePaymentStatus: PaymentStatus;
  codePaymentId: Types.ObjectId | null;
  codePaidAt: Date | null;
  coseguroOdontoPaymentStatus: PaymentStatus;
  coseguroOdontoPaymentId: Types.ObjectId | null;
  coseguroOdontoPaidAt: Date | null;
}

export interface AttentionDocument {
  _id: string;
  fecha: Date;
  pacienteId: Types.ObjectId;
  obraSocialId: Types.ObjectId;
  usuarioCargaId: Types.ObjectId;
  observacionGeneral: string | null;
  codigos: AttentionCodeLineDocument[];
  createdAt: Date;
  updatedAt: Date;
}

const attentionCodeLineSchema = new Schema<AttentionCodeLineDocument>(
  {
    codigoObraSocialId: {
      type: Schema.Types.ObjectId,
      ref: "CodigoObraSocial",
      required: true,
    },
    pieza: {
      type: String,
      default: null,
      trim: true,
    },
    coseguroCentavos: {
      type: Number,
      default: null,
      min: 0,
    },
    coseguroOdontoCentavos: {
      type: Number,
      default: null,
      min: 0,
    },
    observacion: {
      type: String,
      default: null,
      trim: true,
    },
    pagoOdontologoCentavos: {
      type: Number,
      required: true,
      min: 0,
    },
    estado: {
      type: String,
      enum: ["no-cargado", "pendiente", "ok", "diferido", "denegado"],
      required: true,
      default: "pendiente",
    },
    codePaymentStatus: {
      type: String,
      enum: ["pendiente", "pagado"],
      required: true,
      default: "pendiente",
    },
    codePaymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    codePaidAt: {
      type: Date,
      default: null,
    },
    coseguroOdontoPaymentStatus: {
      type: String,
      enum: ["pendiente", "pagado"],
      required: true,
      default: "pendiente",
    },
    coseguroOdontoPaymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    coseguroOdontoPaidAt: {
      type: Date,
      default: null,
    },
  },
);

const attentionSchema = new Schema<AttentionDocument>(
  {
    fecha: { type: Date, required: true, index: true },
    pacienteId: {
      type: Schema.Types.ObjectId,
      ref: "Paciente",
      required: true,
      index: true,
    },
    obraSocialId: {
      type: Schema.Types.ObjectId,
      ref: "ObraSocial",
      required: true,
      index: true,
    },
    usuarioCargaId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    observacionGeneral: {
      type: String,
      default: null,
      trim: true,
    },
    codigos: {
      type: [attentionCodeLineSchema],
      default: [],
    },
  },
  {
    collection: "attentions",
    timestamps: true,
  },
);

attentionSchema.index({ pacienteId: 1, obraSocialId: 1, fecha: -1 });
attentionSchema.index({ usuarioCargaId: 1, fecha: -1 });
attentionSchema.index({ "codigos.codigoObraSocialId": 1 });

export const AttentionModel =
  (models.Attention as Model<AttentionDocument>) ||
  model<AttentionDocument>("Attention", attentionSchema);
