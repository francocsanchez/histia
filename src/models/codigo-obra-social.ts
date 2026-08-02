import { Model, Schema, model, models } from "mongoose";

export interface CodigoObraSocialDocument {
  _id: string;
  nombre: string;
  codigo: string;
  codigoNormalizado: string;
  obraSocialId: Schema.Types.ObjectId;
  valorCentavos: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const codigoObraSocialSchema = new Schema<CodigoObraSocialDocument>(
  {
    nombre: { type: String, required: true, trim: true },
    codigo: { type: String, required: true, trim: true },
    codigoNormalizado: { type: String, required: true },
    obraSocialId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "ObraSocial",
      index: true,
    },
    valorCentavos: { type: Number, required: true, min: 0 },
    activo: { type: Boolean, default: true, index: true },
  },
  {
    collection: "codigos_obras_sociales",
    timestamps: true,
  },
);

codigoObraSocialSchema.index(
  { obraSocialId: 1, codigoNormalizado: 1 },
  { unique: true },
);

export const CodigoObraSocialModel =
  (models.CodigoObraSocial as Model<CodigoObraSocialDocument>) ||
  model<CodigoObraSocialDocument>("CodigoObraSocial", codigoObraSocialSchema);
