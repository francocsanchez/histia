import { Model, Schema, Types, model, models } from "mongoose";

import {
  MovementDirection,
  MovementOriginType,
  MovementPaymentMetadataDto,
} from "@/types/domain";

export interface MovementDocument {
  _id: Types.ObjectId;
  fecha: Date;
  descripcion: string;
  direccion: MovementDirection;
  tipoMovimientoId: Types.ObjectId | null;
  tipo: string;
  montoCentavos: number;
  origenTipo: MovementOriginType;
  origenId: Types.ObjectId | null;
  creadoAutomaticamente: boolean;
  metadata: MovementPaymentMetadataDto | null;
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
      required: true,
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
      enum: ["manual", "payment"],
      required: true,
      index: true,
    },
    origenId: {
      type: Schema.Types.ObjectId,
      default: null,
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

export const MovementModel =
  (models.Movement as Model<MovementDocument>) ||
  model<MovementDocument>("Movement", movementSchema);
