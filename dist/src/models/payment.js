"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentModel = void 0;
const mongoose_1 = require("mongoose");
const paymentLineItemSchema = new mongoose_1.Schema({
    sourceType: {
        type: String,
        enum: ["attention", "orthodontic-payment"],
        required: true,
    },
    attentionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Attention",
        default: null,
    },
    attentionFecha: {
        type: Date,
        default: null,
    },
    pacienteId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Paciente",
        default: null,
    },
    pacienteNombre: {
        type: String,
        default: null,
        trim: true,
    },
    pacienteDni: {
        type: String,
        default: null,
        trim: true,
    },
    obraSocialId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "ObraSocial",
        default: null,
    },
    obraSocialNombre: {
        type: String,
        default: null,
        trim: true,
    },
    codigoObraSocialId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "CodigoObraSocial",
        default: null,
    },
    codigo: {
        type: String,
        default: null,
        trim: true,
    },
    codigoNombre: {
        type: String,
        default: null,
        trim: true,
    },
    pieza: {
        type: String,
        default: null,
        trim: true,
    },
    estadoAtencionSnapshot: {
        type: String,
        enum: ["no-cargado", "pendiente", "ok", "diferido", "denegado", null],
        default: null,
    },
    pagoOdontologoCentavos: {
        type: Number,
        default: null,
        min: 0,
    },
    coseguroOdontoCentavos: {
        type: Number,
        default: null,
        min: 0,
    },
    includesCodePayment: {
        type: Boolean,
        default: false,
    },
    includesCoseguroOdontoPayment: {
        type: Boolean,
        default: false,
    },
    orthodonticTreatmentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "OrthodonticTreatment",
        default: null,
    },
    orthodonticPaymentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        default: null,
    },
    treatmentStartDate: {
        type: Date,
        default: null,
    },
    paymentDate: {
        type: Date,
        default: null,
    },
    treatmentType: {
        type: String,
        enum: ["damon-q", "arco-recto", "damon-ultimate", "a-ligable-nac", null],
        default: null,
    },
    patientName: {
        type: String,
        default: null,
        trim: true,
    },
    paymentAmountCentavos: {
        type: Number,
        default: null,
        min: 0,
    },
    percentageToOrthodontist: {
        type: Number,
        default: null,
        min: 0,
        max: 100,
    },
    orthodontistAmountCentavos: {
        type: Number,
        default: null,
        min: 0,
    },
    totalLineaCentavos: {
        type: Number,
        required: true,
        min: 0,
    },
}, {
    _id: false,
});
const paymentDebitItemSchema = new mongoose_1.Schema({
    montoCentavos: { type: Number, required: true, min: 1 },
    observacion: { type: String, required: true, trim: true },
}, { _id: false });
const paymentCreditItemSchema = new mongoose_1.Schema({
    montoCentavos: { type: Number, required: true, min: 1 },
    observacion: { type: String, required: true, trim: true },
}, { _id: false });
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
    attentionMonths: {
        type: [String],
        default: [],
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
    totalOrtodonciaCentavos: {
        type: Number,
        required: true,
        min: 0,
    },
    totalHonorariosCentavos: {
        type: Number,
        required: true,
        min: 0,
    },
    totalCreditosCentavos: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalDebitosCentavos: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalNetoPagarCentavos: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    quantityConceptsPaid: {
        type: Number,
        required: true,
        min: 1,
    },
    debitItems: {
        type: [paymentDebitItemSchema],
        default: [],
    },
    creditItems: {
        type: [paymentCreditItemSchema],
        default: [],
    },
}, {
    collection: "payments",
    timestamps: true,
});
paymentSchema.index({ usuarioId: 1, attentionMonth: 1, paidAt: -1 });
paymentSchema.index({ usuarioId: 1, attentionMonths: 1, paidAt: -1 });
exports.PaymentModel = mongoose_1.models.Payment ||
    (0, mongoose_1.model)("Payment", paymentSchema);
