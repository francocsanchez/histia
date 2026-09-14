"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BruxismPlateModel = void 0;
const mongoose_1 = require("mongoose");
const platePaymentSchema = new mongoose_1.Schema({
    fecha: { type: Date, required: true },
    montoCentavos: { type: Number, required: true, min: 1 },
    createdAt: { type: Date, required: true, default: () => new Date() },
});
const bruxismPlateSchema = new mongoose_1.Schema({
    fecha: { type: Date, required: true, index: true },
    pacienteId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Paciente", required: true, index: true },
    odontologoId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    estado: { type: String, enum: ["en-laboratorio", "lista-entrega", "entregada", "liquidada"], default: "en-laboratorio", index: true },
    payments: { type: [platePaymentSchema], default: [] },
    laboratorioRecibidoAt: { type: Date, default: null },
    costoLaboratorioCentavos: { type: Number, default: null, min: 0 },
    entregadaAt: { type: Date, default: null },
    liquidadaAt: { type: Date, default: null },
    paymentId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Payment", default: null },
}, { collection: "bruxism_plates", timestamps: true });
bruxismPlateSchema.index({ odontologoId: 1, estado: 1, fecha: -1 });
exports.BruxismPlateModel = mongoose_1.models.BruxismPlate ||
    (0, mongoose_1.model)("BruxismPlate", bruxismPlateSchema);
