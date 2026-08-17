"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoSettlementSyncModel = void 0;
const mongoose_1 = require("mongoose");
const mercadoPagoSettlementSyncSchema = new mongoose_1.Schema({
    reportId: {
        type: Number,
        default: null,
    },
    fileName: {
        type: String,
        default: null,
        trim: true,
    },
    beginDate: {
        type: Date,
        required: true,
        index: true,
    },
    endDate: {
        type: Date,
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ["PENDING", "WAITING_REPORT", "PROCESSING", "PROCESSED", "FAILED"],
        required: true,
        index: true,
    },
    remoteStatus: {
        type: String,
        default: null,
        trim: true,
    },
    tipoSincronizacion: {
        type: String,
        enum: ["hourly", "daily_recovery", "manual"],
        required: true,
        index: true,
    },
    cantidadFilas: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    cantidadMovimientosCreados: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    cantidadMovimientosIgnorados: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    cantidadAdvertencias: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    error: {
        type: String,
        default: null,
        trim: true,
    },
    processedAt: {
        type: Date,
        default: null,
    },
    lastCheckedAt: {
        type: Date,
        default: null,
    },
    processingStartedAt: {
        type: Date,
        default: null,
    },
    createdByUserId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
}, {
    collection: "mercadopago_settlement_syncs",
    timestamps: true,
});
mercadoPagoSettlementSyncSchema.index({ status: 1, createdAt: -1 });
mercadoPagoSettlementSyncSchema.index({ tipoSincronizacion: 1, createdAt: -1 });
mercadoPagoSettlementSyncSchema.index({ reportId: 1 }, {
    unique: true,
    partialFilterExpression: {
        reportId: { $type: "number" },
    },
});
exports.MercadoPagoSettlementSyncModel = mongoose_1.models.MercadoPagoSettlementSync ||
    (0, mongoose_1.model)("MercadoPagoSettlementSync", mercadoPagoSettlementSyncSchema);
