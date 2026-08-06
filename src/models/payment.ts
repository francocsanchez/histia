import { Model, Schema, Types, model, models } from "mongoose";

import { AttentionCodeStatus } from "@/types/domain";

export interface PaymentLineItemDocument {
  attentionId: Types.ObjectId;
  attentionFecha: Date;
  pacienteId: Types.ObjectId;
  pacienteNombre: string;
  pacienteDni: string;
  obraSocialId: Types.ObjectId;
  obraSocialNombre: string;
  codigoObraSocialId: Types.ObjectId;
  codigo: string;
  codigoNombre: string;
  pieza: string | null;
  estadoAtencionSnapshot: AttentionCodeStatus;
  pagoOdontologoCentavos: number;
  coseguroOdontoCentavos: number | null;
  includesCodePayment: boolean;
  includesCoseguroOdontoPayment: boolean;
  totalLineaCentavos: number;
}

export interface PaymentDocument {
  _id: Types.ObjectId;
  usuarioId: Types.ObjectId;
  usuarioNombreSnapshot: string;
  attentionMonth: string;
  paidAt: Date;
  createdByUserId: Types.ObjectId;
  lineItems: PaymentLineItemDocument[];
  totalPagoCodigosCentavos: number;
  totalCoseguroOdontoCentavos: number;
  totalHonorariosCentavos: number;
  quantityConceptsPaid: number;
  createdAt: Date;
  updatedAt: Date;
}

const paymentLineItemSchema = new Schema<PaymentLineItemDocument>(
  {
    attentionId: {
      type: Schema.Types.ObjectId,
      ref: "Attention",
      required: true,
    },
    attentionFecha: {
      type: Date,
      required: true,
    },
    pacienteId: {
      type: Schema.Types.ObjectId,
      ref: "Paciente",
      required: true,
    },
    pacienteNombre: {
      type: String,
      required: true,
      trim: true,
    },
    pacienteDni: {
      type: String,
      required: true,
      trim: true,
    },
    obraSocialId: {
      type: Schema.Types.ObjectId,
      ref: "ObraSocial",
      required: true,
    },
    obraSocialNombre: {
      type: String,
      required: true,
      trim: true,
    },
    codigoObraSocialId: {
      type: Schema.Types.ObjectId,
      ref: "CodigoObraSocial",
      required: true,
    },
    codigo: {
      type: String,
      required: true,
      trim: true,
    },
    codigoNombre: {
      type: String,
      required: true,
      trim: true,
    },
    pieza: {
      type: String,
      default: null,
      trim: true,
    },
    estadoAtencionSnapshot: {
      type: String,
      enum: ["no-cargado", "pendiente", "ok", "diferido", "denegado"],
      required: true,
    },
    pagoOdontologoCentavos: {
      type: Number,
      required: true,
      min: 0,
    },
    coseguroOdontoCentavos: {
      type: Number,
      default: null,
      min: 0,
    },
    includesCodePayment: {
      type: Boolean,
      required: true,
      default: false,
    },
    includesCoseguroOdontoPayment: {
      type: Boolean,
      required: true,
      default: false,
    },
    totalLineaCentavos: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

const paymentSchema = new Schema<PaymentDocument>(
  {
    usuarioId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    usuarioNombreSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    attentionMonth: {
      type: String,
      required: true,
      index: true,
    },
    paidAt: {
      type: Date,
      required: true,
      index: true,
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lineItems: {
      type: [paymentLineItemSchema],
      default: [],
    },
    totalPagoCodigosCentavos: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCoseguroOdontoCentavos: {
      type: Number,
      required: true,
      min: 0,
    },
    totalHonorariosCentavos: {
      type: Number,
      required: true,
      min: 0,
    },
    quantityConceptsPaid: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    collection: "payments",
    timestamps: true,
  },
);

paymentSchema.index({ usuarioId: 1, attentionMonth: 1, paidAt: -1 });

export const PaymentModel =
  (models.Payment as Model<PaymentDocument>) ||
  model<PaymentDocument>("Payment", paymentSchema);
