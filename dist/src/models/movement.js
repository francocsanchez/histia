"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovementModel = void 0;
const mongoose_1 = require("mongoose");
const movementSchema = new mongoose_1.Schema({
    fecha: {
        type: Date,
        required: true,
        index: true,
    },
    descripcion: {
        type: String,
        default: null,
        trim: true,
    },
    direccion: {
        type: String,
        enum: ["ingreso", "egreso"],
        required: true,
        index: true,
    },
    tipoMovimientoId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "MovementType",
        default: null,
        index: true,
    },
    tipo: {
        type: String,
        required: true,
        trim: true,
    },
    montoCentavos: {
        type: Number,
        required: true,
        min: 1,
    },
    origenTipo: {
        type: String,
        enum: ["manual", "payment", "mercadopago"],
        required: true,
        index: true,
    },
    origenId: {
        type: mongoose_1.Schema.Types.ObjectId,
        default: null,
    },
    externalId: {
        type: String,
        default: null,
        trim: true,
        index: true,
    },
    externalComponent: {
        type: String,
        enum: ["TRANSACTION", "TAX", "FEE", null],
        default: null,
        index: true,
    },
    creadoAutomaticamente: {
        type: Boolean,
        required: true,
        default: false,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
    },
    createdByUserId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
}, {
    collection: "movements",
    timestamps: true,
});
movementSchema.index({ fecha: -1 });
movementSchema.index({ direccion: 1, tipoMovimientoId: 1, fecha: -1 });
movementSchema.index({ origenTipo: 1, origenId: 1 }, {
    unique: true,
    partialFilterExpression: {
        origenTipo: { $ne: "manual" },
        origenId: { $type: "objectId" },
    },
});
movementSchema.index({ origenTipo: 1, externalId: 1, externalComponent: 1 }, {
    unique: true,
    partialFilterExpression: {
        origenTipo: "mercadopago",
        externalId: { $type: "string" },
        externalComponent: { $type: "string" },
    },
});
if (mongoose_1.models.Movement) {
    delete mongoose_1.models.Movement;
}
exports.MovementModel = (0, mongoose_1.model)("Movement", movementSchema);
