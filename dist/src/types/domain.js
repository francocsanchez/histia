"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mercadoPagoSyncStatusValues = exports.mercadoPagoSyncTypeValues = exports.mercadoPagoExternalComponentValues = exports.movementOriginTypeValues = exports.movementDirectionValues = exports.paymentStatusValues = exports.attentionCodeStatusValues = exports.referrerTypeValues = exports.rxTypeValues = exports.surveyStatusValues = exports.surveyCampaignStatusValues = exports.userRoleValues = void 0;
exports.userRoleValues = [
    "administrador",
    "odontologo",
    "radiologo",
];
exports.surveyCampaignStatusValues = [
    "draft",
    "ready",
    "running",
    "paused",
    "completed",
    "cancelled",
    "error",
];
exports.surveyStatusValues = [
    "queued",
    "leased_for_send",
    "waiting_rating",
    "waiting_comment_opt_in",
    "waiting_comment_text",
    "completed",
    "no_response",
    "cancelled",
    "send_failed",
    "delivery_unknown",
];
exports.rxTypeValues = ["carpal", "panoramica"];
exports.referrerTypeValues = ["interno", "externo"];
exports.attentionCodeStatusValues = [
    "no-cargado",
    "pendiente",
    "ok",
    "diferido",
    "denegado",
];
exports.paymentStatusValues = ["pendiente", "pagado"];
exports.movementDirectionValues = ["ingreso", "egreso"];
exports.movementOriginTypeValues = ["manual", "payment", "mercadopago"];
exports.mercadoPagoExternalComponentValues = [
    "TRANSACTION",
    "TAX",
    "FEE",
];
exports.mercadoPagoSyncTypeValues = [
    "hourly",
    "daily_recovery",
    "manual",
];
exports.mercadoPagoSyncStatusValues = [
    "PENDING",
    "WAITING_REPORT",
    "PROCESSING",
    "PROCESSED",
    "FAILED",
];
