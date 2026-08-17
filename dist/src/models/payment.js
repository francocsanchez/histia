"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentModel = void 0;
const mongoose_1 = require("mongoose");
const paymentLineItemSchema = new mongoose_1.Schema({
    attentionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Attention",
        required: true,
    },
    attentionFecha: {
        type: Date,
        required: true,
    },
    pacienteId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Paciente",
        required: true,
    },
    pacienteNombre: {
        type: String,
        required: true,
        trim: true,
    },
    pacienteDni: {
        type: String,
        required: true,
        trim: true,
    },
    obraSocialId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "ObraSocial",
        required: true,
    },
    obraSocialNombre: {
        type: String,
        required: true,
        trim: true,
    },
    codigoObraSocialId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "CodigoObraSocial",
        required: true,
    },
    codigo: {
        type: String,
        required: true,
        trim: true,
    },
    codigoNombre: {
        type: String,
        required: true,
        trim: true,
    },
    pieza: {
        type: String,
        default: null,
        trim: true,
    },
    estadoAtencionSnapshot: {
        type: String,
        enum: ["no-cargado", "pendiente", "ok", "diferido", "denegado"],
        required: true,
    },
    pagoOdontologoCentavos: {
        type: Number,
        required: true,
        min: 0,
    },
    coseguroOdontoCentavos: {
        type: Number,
        default: null,
        min: 0,
    },
    includesCodePayment: {
        type: Boolean,
        required: true,
        default: false,
    },
    includesCoseguroOdontoPayment: {
        type: Boolean,
        required: true,
        default: false,
    },
    totalLineaCentavos: {
        type: Number,
        required: true,
        min: 0,
    },
}, {
    _id: false,
});
const paymentSchema = new mongoose_1.Schema({
    usuarioId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    usuarioNombreSnapshot: {
        type: String,
        required: true,
        trim: true,
    },
    attentionMonth: {
        type: String,
        required: true,
        index: true,
    },
    paidAt: {
        type: Date,
        required: true,
        index: true,
    },
    createdByUserId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    lineItems: {
        type: [paymentLineItemSchema],
        default: [],
    },
    totalPagoCodigosCentavos: {
        type: Number,
        required: true,
        min: 0,
    },
    totalCoseguroOdontoCentavos: {
        type: Number,
        required: true,
        min: 0,
    },
    totalHonorariosCentavos: {
        type: Number,
        required: true,
        min: 0,
    },
    quantityConceptsPaid: {
        type: Number,
        required: true,
        min: 1,
    },
}, {
    collection: "payments",
    timestamps: true,
});
paymentSchema.index({ usuarioId: 1, attentionMonth: 1, paidAt: -1 });
exports.PaymentModel = mongoose_1.models.Payment ||
    (0, mongoose_1.model)("Payment", paymentSchema);
