import { Model, Schema, model, models } from "mongoose";

import { MovementDirection } from "@/types/domain";

export interface MovementTypeDocument {
  _id: string;
  nombre: string;
  nombreNormalizado: string;
  direccion: MovementDirection;
  activo: boolean;
  systemKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const movementTypeSchema = new Schema<MovementTypeDocument>(
  {
    nombre: { type: String, required: true, trim: true },
    nombreNormalizado: { type: String, required: true, unique: true },
    direccion: {
      type: String,
      enum: ["ingreso", "egreso"],
      required: true,
      index: true,
    },
    activo: { type: Boolean, default: true, index: true },
    systemKey: { type: String, default: null, index: true },
  },
  {
    collection: "movement_types",
    timestamps: true,
  },
);

movementTypeSchema.index({ nombreNormalizado: 1 }, { unique: true });

export const MovementTypeModel =
  (models.MovementType as Model<MovementTypeDocument>) ||
  model<MovementTypeDocument>("MovementType", movementTypeSchema);
