import { Schema, Types, model, models } from "mongoose";

import {
  MercadoPagoExternalComponent,
  MovementDirection,
  MovementMetadataDto,
  MovementOriginType,
} from "@/types/domain";

export interface MovementDocument {
  _id: Types.ObjectId;
  fecha: Date;
  descripcion: string | null;
  direccion: MovementDirection;
  tipoMovimientoId: Types.ObjectId | null;
  tipo: string;
  montoCentavos: number;
  origenTipo: MovementOriginType;
  origenId: Types.ObjectId | null;
  externalId: string | null;
  externalComponent: MercadoPagoExternalComponent | null;
  creadoAutomaticamente: boolean;
  metadata: MovementMetadataDto | null;
  createdByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const movementSchema = new Schema<MovementDocument>(
  {
    fecha: {
      type: Date,
      required: true,
      index: true,
    },
    descripcion: {
      type: String,
      default: null,
      trim: true,
    },
    direccion: {
      type: String,
      enum: ["ingreso", "egreso"],
      required: true,
      index: true,
    },
    tipoMovimientoId: {
      type: Schema.Types.ObjectId,
      ref: "MovementType",
      default: null,
      index: true,
    },
    tipo: {
      type: String,
      required: true,
      trim: true,
    },
    montoCentavos: {
      type: Number,
      required: true,
      min: 1,
    },
    origenTipo: {
      type: String,
      enum: ["manual", "payment", "mercadopago"],
      required: true,
      index: true,
    },
    origenId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    externalId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    externalComponent: {
      type: String,
      enum: ["TRANSACTION", "TAX", "FEE", null],
      default: null,
      index: true,
    },
    creadoAutomaticamente: {
      type: Boolean,
      required: true,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    collection: "movements",
    timestamps: true,
  },
);

movementSchema.index({ fecha: -1 });
movementSchema.index({ direccion: 1, tipoMovimientoId: 1, fecha: -1 });
movementSchema.index(
  { origenTipo: 1, origenId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      origenTipo: { $ne: "manual" },
      origenId: { $type: "objectId" },
    },
  },
);
movementSchema.index(
  { origenTipo: 1, externalId: 1, externalComponent: 1 },
  {
    unique: true,
    partialFilterExpression: {
      origenTipo: "mercadopago",
      externalId: { $type: "string" },
      externalComponent: { $type: "string" },
    },
  },
);

if (models.Movement) {
  delete models.Movement;
}

export const MovementModel = model<MovementDocument>("Movement", movementSchema);
