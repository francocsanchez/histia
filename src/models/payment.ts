import { Model, Schema, Types, model, models } from "mongoose";

import {
  AttentionCodeStatus,
  OrthodonticTreatmentType,
  PaymentDebitItemDto,
} from "@/types/domain";

export interface AttentionPaymentLineItemDocument {
  sourceType: "attention";
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

export interface OrthodonticPaymentLineItemDocument {
  sourceType: "orthodontic-payment";
  orthodonticTreatmentId: Types.ObjectId;
  orthodonticPaymentId: Types.ObjectId;
  treatmentStartDate: Date;
  paymentDate: Date;
  treatmentType: OrthodonticTreatmentType;
  patientId: Types.ObjectId;
  patientName: string;
  patientDni: string;
  paymentAmountCentavos: number;
  percentageToOrthodontist: number;
  orthodontistAmountCentavos: number;
  totalLineaCentavos: number;
}

export type PaymentLineItemDocument =
  | AttentionPaymentLineItemDocument
  | OrthodonticPaymentLineItemDocument;

export type PaymentDebitItemDocument = PaymentDebitItemDto;

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
  totalOrtodonciaCentavos: number;
  totalHonorariosCentavos: number;
  totalDebitosCentavos: number;
  totalNetoPagarCentavos: number;
  quantityConceptsPaid: number;
  debitItems: PaymentDebitItemDocument[];
  createdAt: Date;
  updatedAt: Date;
}

const paymentLineItemSchema = new Schema(
  {
    sourceType: {
      type: String,
      enum: ["attention", "orthodontic-payment"],
      required: true,
    },
    attentionId: {
      type: Schema.Types.ObjectId,
      ref: "Attention",
      default: null,
    },
    attentionFecha: {
      type: Date,
      default: null,
    },
    pacienteId: {
      type: Schema.Types.ObjectId,
      ref: "Paciente",
      default: null,
    },
    pacienteNombre: {
      type: String,
      default: null,
      trim: true,
    },
    pacienteDni: {
      type: String,
      default: null,
      trim: true,
    },
    obraSocialId: {
      type: Schema.Types.ObjectId,
      ref: "ObraSocial",
      default: null,
    },
    obraSocialNombre: {
      type: String,
      default: null,
      trim: true,
    },
    codigoObraSocialId: {
      type: Schema.Types.ObjectId,
      ref: "CodigoObraSocial",
      default: null,
    },
    codigo: {
      type: String,
      default: null,
      trim: true,
    },
    codigoNombre: {
      type: String,
      default: null,
      trim: true,
    },
    pieza: {
      type: String,
      default: null,
      trim: true,
    },
    estadoAtencionSnapshot: {
      type: String,
      enum: ["no-cargado", "pendiente", "ok", "diferido", "denegado", null],
      default: null,
    },
    pagoOdontologoCentavos: {
      type: Number,
      default: null,
      min: 0,
    },
    coseguroOdontoCentavos: {
      type: Number,
      default: null,
      min: 0,
    },
    includesCodePayment: {
      type: Boolean,
      default: false,
    },
    includesCoseguroOdontoPayment: {
      type: Boolean,
      default: false,
    },
    orthodonticTreatmentId: {
      type: Schema.Types.ObjectId,
      ref: "OrthodonticTreatment",
      default: null,
    },
    orthodonticPaymentId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    treatmentStartDate: {
      type: Date,
      default: null,
    },
    paymentDate: {
      type: Date,
      default: null,
    },
    treatmentType: {
      type: String,
      enum: ["damon-q", "arco-recto", "damon-ultimate", "a-ligable-nac", null],
      default: null,
    },
    patientName: {
      type: String,
      default: null,
      trim: true,
    },
    paymentAmountCentavos: {
      type: Number,
      default: null,
      min: 0,
    },
    percentageToOrthodontist: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    orthodontistAmountCentavos: {
      type: Number,
      default: null,
      min: 0,
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

const paymentDebitItemSchema = new Schema<PaymentDebitItemDocument>(
  {
    montoCentavos: { type: Number, required: true, min: 1 },
    observacion: { type: String, required: true, trim: true },
  },
  { _id: false },
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
    totalOrtodonciaCentavos: {
      type: Number,
      required: true,
      min: 0,
    },
    totalHonorariosCentavos: {
      type: Number,
      required: true,
      min: 0,
    },
    totalDebitosCentavos: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalNetoPagarCentavos: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    quantityConceptsPaid: {
      type: Number,
      required: true,
      min: 1,
    },
    debitItems: {
      type: [paymentDebitItemSchema],
      default: [],
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
