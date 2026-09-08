"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrthodonticTreatmentModel = void 0;
const mongoose_1 = require("mongoose");
const orthodonticPaymentSchema = new mongoose_1.Schema({
    fecha: {
        type: Date,
        required: true,
    },
    montoCentavos: {
        type: Number,
        required: true,
        min: 1,
    },
    porcentajeOrtodoncista: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    },
    montoOrtodoncistaCentavos: {
        type: Number,
        required: true,
        min: 0,
    },
    paymentStatus: {
        type: String,
        enum: ["pendiente", "pagado"],
        required: true,
        default: "pendiente",
    },
    paymentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Payment",
        default: null,
    },
    paidAt: {
        type: Date,
        default: null,
    },
    createdAt: {
        type: Date,
        required: true,
        default: () => new Date(),
    },
    updatedAt: {
        type: Date,
        required: true,
        default: () => new Date(),
    },
}, {
    _id: true,
});
const orthodonticTreatmentSchema = new mongoose_1.Schema({
    fechaInicio: {
        type: Date,
        required: true,
        index: true,
    },
    pacienteId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Paciente",
        required: true,
        index: true,
    },
    usuarioOrtodoncistaId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    tratamientoTipo: {
        type: String,
        enum: ["damon-q", "arco-recto", "damon-ultimate", "a-ligable-nac"],
        required: true,
    },
    valorTratamientoCentavos: {
        type: Number,
        required: true,
        min: 0,
    },
    valorMaterialesCentavos: {
        type: Number,
        required: true,
        min: 0,
    },
    estado: {
        type: String,
        enum: ["activo", "cerrado", "cancelado"],
        required: true,
        default: "activo",
        index: true,
    },
    payments: {
        type: [orthodonticPaymentSchema],
        default: [],
    },
}, {
    collection: "orthodontic_treatments",
    timestamps: true,
});
orthodonticTreatmentSchema.index({ pacienteId: 1, estado: 1 });
orthodonticTreatmentSchema.index({ usuarioOrtodoncistaId: 1, fechaInicio: -1 });
orthodonticTreatmentSchema.index({ "payments._id": 1 });
orthodonticTreatmentSchema.index({ "payments.paymentStatus": 1 });
exports.OrthodonticTreatmentModel = mongoose_1.models.OrthodonticTreatment ||
    (0, mongoose_1.model)("OrthodonticTreatment", orthodonticTreatmentSchema);
