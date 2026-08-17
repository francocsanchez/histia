"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RxAttentionModel = void 0;
const mongoose_1 = require("mongoose");
const rxAttentionSchema = new mongoose_1.Schema({
    fecha: { type: Date, required: true, index: true },
    pacienteId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Paciente",
        required: true,
        index: true,
    },
    derivanteTipo: {
        type: String,
        enum: ["interno", "externo"],
        required: true,
    },
    derivanteUserId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
    },
    derivanteExternoNombre: {
        type: String,
        default: null,
        trim: true,
    },
    tipoRx: {
        type: String,
        enum: ["carpal", "panoramica"],
        required: true,
        index: true,
    },
    valorCentavos: {
        type: Number,
        default: null,
        min: 0,
    },
    usuarioGeneradorId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    observaciones: {
        type: String,
        default: null,
        trim: true,
    },
}, {
    collection: "rx_attentions",
    timestamps: true,
});
rxAttentionSchema.index({ fecha: -1, tipoRx: 1 });
exports.RxAttentionModel = mongoose_1.models.RxAttention ||
    (0, mongoose_1.model)("RxAttention", rxAttentionSchema);
