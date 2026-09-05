import { Model, Schema, Types, model, models } from "mongoose";

import {
  OrthodonticTreatmentStatus,
  OrthodonticTreatmentType,
  PaymentStatus,
} from "@/types/domain";

export interface OrthodonticPaymentDocument {
  _id: Types.ObjectId;
  fecha: Date;
  montoCentavos: number;
  porcentajeOrtodoncista: number;
  montoOrtodoncistaCentavos: number;
  paymentStatus: PaymentStatus;
  paymentId: Types.ObjectId | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrthodonticTreatmentDocument {
  _id: Types.ObjectId;
  fechaInicio: Date;
  pacienteId: Types.ObjectId;
  usuarioOrtodoncistaId: Types.ObjectId;
  tratamientoTipo: OrthodonticTreatmentType;
  valorTratamientoCentavos: number;
  valorMaterialesCentavos: number;
  estado: OrthodonticTreatmentStatus;
  payments: OrthodonticPaymentDocument[];
  createdAt: Date;
  updatedAt: Date;
}

const orthodonticPaymentSchema = new Schema<OrthodonticPaymentDocument>(
  {
    fecha: {
      type: Date,
      required: true,
    },
    montoCentavos: {
      type: Number,
      required: true,
      min: 1,
    },
    porcentajeOrtodoncista: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    montoOrtodoncistaCentavos: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["pendiente", "pagado"],
      required: true,
      default: "pendiente",
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    updatedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  {
    _id: true,
  },
);

const orthodonticTreatmentSchema = new Schema<OrthodonticTreatmentDocument>(
  {
    fechaInicio: {
      type: Date,
      required: true,
      index: true,
    },
    pacienteId: {
      type: Schema.Types.ObjectId,
      ref: "Paciente",
      required: true,
      index: true,
    },
    usuarioOrtodoncistaId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tratamientoTipo: {
      type: String,
      enum: ["damon-q", "arco-recto", "damon-ultimate", "a-ligable-nac"],
      required: true,
    },
    valorTratamientoCentavos: {
      type: Number,
      required: true,
      min: 0,
    },
    valorMaterialesCentavos: {
      type: Number,
      required: true,
      min: 0,
    },
    estado: {
      type: String,
      enum: ["activo", "cerrado", "cancelado"],
      required: true,
      default: "activo",
      index: true,
    },
    payments: {
      type: [orthodonticPaymentSchema],
      default: [],
    },
  },
  {
    collection: "orthodontic_treatments",
    timestamps: true,
  },
);

orthodonticTreatmentSchema.index({ pacienteId: 1, estado: 1 });
orthodonticTreatmentSchema.index({ usuarioOrtodoncistaId: 1, fechaInicio: -1 });
orthodonticTreatmentSchema.index({ "payments._id": 1 });
orthodonticTreatmentSchema.index({ "payments.paymentStatus": 1 });

export const OrthodonticTreatmentModel =
  (models.OrthodonticTreatment as Model<OrthodonticTreatmentDocument>) ||
  model<OrthodonticTreatmentDocument>(
    "OrthodonticTreatment",
    orthodonticTreatmentSchema,
  );
