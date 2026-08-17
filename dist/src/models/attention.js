"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttentionModel = void 0;
const mongoose_1 = require("mongoose");
const attentionCodeLineSchema = new mongoose_1.Schema({
    codigoObraSocialId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "CodigoObraSocial",
        required: true,
    },
    pieza: {
        type: String,
        default: null,
        trim: true,
    },
    coseguroCentavos: {
        type: Number,
        default: null,
        min: 0,
    },
    coseguroOdontoCentavos: {
        type: Number,
        default: null,
        min: 0,
    },
    observacion: {
        type: String,
        default: null,
        trim: true,
    },
    pagoOdontologoCentavos: {
        type: Number,
        required: true,
        min: 0,
    },
    estado: {
        type: String,
        enum: ["no-cargado", "pendiente", "ok", "diferido", "denegado"],
        required: true,
        default: "pendiente",
    },
    codePaymentStatus: {
        type: String,
        enum: ["pendiente", "pagado"],
        required: true,
        default: "pendiente",
    },
    codePaymentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Payment",
        default: null,
    },
    codePaidAt: {
        type: Date,
        default: null,
    },
    coseguroOdontoPaymentStatus: {
        type: String,
        enum: ["pendiente", "pagado"],
        required: true,
        default: "pendiente",
    },
    coseguroOdontoPaymentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Payment",
        default: null,
    },
    coseguroOdontoPaidAt: {
        type: Date,
        default: null,
    },
});
const attentionSchema = new mongoose_1.Schema({
    fecha: { type: Date, required: true, index: true },
    pacienteId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Paciente",
        required: true,
        index: true,
    },
    obraSocialId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "ObraSocial",
        required: true,
        index: true,
    },
    usuarioCargaId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    observacionGeneral: {
        type: String,
        default: null,
        trim: true,
    },
    codigos: {
        type: [attentionCodeLineSchema],
        default: [],
    },
}, {
    collection: "attentions",
    timestamps: true,
});
attentionSchema.index({ pacienteId: 1, obraSocialId: 1, fecha: -1 });
attentionSchema.index({ usuarioCargaId: 1, fecha: -1 });
attentionSchema.index({ "codigos.codigoObraSocialId": 1 });
exports.AttentionModel = mongoose_1.models.Attention ||
    (0, mongoose_1.model)("Attention", attentionSchema);
