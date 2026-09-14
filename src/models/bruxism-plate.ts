import { Model, Schema, Types, model, models } from "mongoose";

export type BruxismPlateStatus = "en-laboratorio" | "lista-entrega" | "entregada" | "liquidada";

export interface BruxismPlatePaymentDocument {
  _id: Types.ObjectId;
  fecha: Date;
  montoCentavos: number;
  createdAt: Date;
}

export interface BruxismPlateDocument {
  _id: Types.ObjectId;
  fecha: Date;
  pacienteId: Types.ObjectId;
  odontologoId: Types.ObjectId;
  estado: BruxismPlateStatus;
  payments: BruxismPlatePaymentDocument[];
  laboratorioRecibidoAt: Date | null;
  costoLaboratorioCentavos: number | null;
  entregadaAt: Date | null;
  liquidadaAt: Date | null;
  paymentId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const platePaymentSchema = new Schema<BruxismPlatePaymentDocument>({
  fecha: { type: Date, required: true },
  montoCentavos: { type: Number, required: true, min: 1 },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

const bruxismPlateSchema = new Schema<BruxismPlateDocument>({
  fecha: { type: Date, required: true, index: true },
  pacienteId: { type: Schema.Types.ObjectId, ref: "Paciente", required: true, index: true },
  odontologoId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  estado: { type: String, enum: ["en-laboratorio", "lista-entrega", "entregada", "liquidada"], default: "en-laboratorio", index: true },
  payments: { type: [platePaymentSchema], default: [] },
  laboratorioRecibidoAt: { type: Date, default: null },
  costoLaboratorioCentavos: { type: Number, default: null, min: 0 },
  entregadaAt: { type: Date, default: null },
  liquidadaAt: { type: Date, default: null },
  paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
}, { collection: "bruxism_plates", timestamps: true });

bruxismPlateSchema.index({ odontologoId: 1, estado: 1, fecha: -1 });

export const BruxismPlateModel =
  (models.BruxismPlate as Model<BruxismPlateDocument>) ||
  model<BruxismPlateDocument>("BruxismPlate", bruxismPlateSchema);
