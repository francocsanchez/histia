import { Model, Schema, model, models } from "mongoose";

export interface ObraSocialDocument {
  _id: string;
  nombre: string;
  nombreNormalizado: string;
  cantidadPrestacionesMes: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const obraSocialSchema = new Schema<ObraSocialDocument>(
  {
    nombre: { type: String, required: true, trim: true },
    nombreNormalizado: { type: String, required: true, unique: true },
    cantidadPrestacionesMes: { type: Number, required: true, min: 0 },
    activo: { type: Boolean, default: true, index: true },
  },
  {
    collection: "obras_sociales",
    timestamps: true,
  },
);

obraSocialSchema.index({ nombreNormalizado: 1 }, { unique: true });

export const ObraSocialModel =
  (models.ObraSocial as Model<ObraSocialDocument>) ||
  model<ObraSocialDocument>("ObraSocial", obraSocialSchema);
