import { Model, Schema, Types, model, models } from "mongoose";

import {
  MercadoPagoSyncStatus,
  MercadoPagoSyncType,
} from "@/types/domain";

export interface MercadoPagoSettlementSyncDocument {
  _id: Types.ObjectId;
  reportId: number | null;
  fileName: string | null;
  beginDate: Date;
  endDate: Date;
  status: MercadoPagoSyncStatus;
  remoteStatus: string | null;
  tipoSincronizacion: MercadoPagoSyncType;
  cantidadFilas: number;
  cantidadMovimientosCreados: number;
  cantidadMovimientosIgnorados: number;
  cantidadAdvertencias: number;
  error: string | null;
  processedAt: Date | null;
  lastCheckedAt: Date | null;
  processingStartedAt: Date | null;
  createdByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const mercadoPagoSettlementSyncSchema =
  new Schema<MercadoPagoSettlementSyncDocument>(
    {
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
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
    },
    {
      collection: "mercadopago_settlement_syncs",
      timestamps: true,
    },
  );

mercadoPagoSettlementSyncSchema.index({ status: 1, createdAt: -1 });
mercadoPagoSettlementSyncSchema.index({ tipoSincronizacion: 1, createdAt: -1 });
mercadoPagoSettlementSyncSchema.index(
  { reportId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      reportId: { $type: "number" },
    },
  },
);

export const MercadoPagoSettlementSyncModel =
  (models.MercadoPagoSettlementSync as Model<MercadoPagoSettlementSyncDocument>) ||
  model<MercadoPagoSettlementSyncDocument>(
    "MercadoPagoSettlementSync",
    mercadoPagoSettlementSyncSchema,
  );
