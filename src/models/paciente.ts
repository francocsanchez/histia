import { Model, Schema, Types, model, models } from "mongoose";

export interface PacienteDocument {
  _id: string;
  nombre: string;
  apellido: string;
  dni: string;
  obraSocialId: Types.ObjectId | null;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const pacienteSchema = new Schema<PacienteDocument>(
  {
    nombre: { type: String, required: true, trim: true },
    apellido: { type: String, required: true, trim: true },
    dni: { type: String, required: true, unique: true },
    obraSocialId: {
      type: Schema.Types.ObjectId,
      ref: "ObraSocial",
      default: null,
      index: true,
    },
    activo: { type: Boolean, default: true, index: true },
  },
  {
    collection: "pacientes",
    timestamps: true,
  },
);

pacienteSchema.index({ dni: 1 }, { unique: true });
pacienteSchema.index({ apellido: 1, nombre: 1 });

export const PacienteModel =
  (models.Paciente as Model<PacienteDocument>) ||
  model<PacienteDocument>("Paciente", pacienteSchema);
