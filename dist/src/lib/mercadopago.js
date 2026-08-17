"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MERCADO_PAGO_SCHEDULER_SYNC_TYPES = exports.MERCADO_PAGO_RECONCILIATION_TOLERANCE_CENTAVOS = exports.MERCADO_PAGO_HTTP_TIMEOUT_MS = exports.MERCADO_PAGO_RECOVERY_MINUTE = exports.MERCADO_PAGO_RECOVERY_HOUR = exports.MERCADO_PAGO_MANUAL_WINDOW_HOURS = exports.MERCADO_PAGO_RECOVERY_WINDOW_HOURS = exports.MERCADO_PAGO_HOURLY_WINDOW_HOURS = exports.MERCADO_PAGO_PENDING_CHECK_INTERVAL_MS = exports.MERCADO_PAGO_HOURLY_INTERVAL_MS = exports.MERCADO_PAGO_API_BASE_URL = void 0;
exports.getMercadoPagoAccessToken = getMercadoPagoAccessToken;
exports.hasMercadoPagoAccessToken = hasMercadoPagoAccessToken;
exports.toMercadoPagoReportDate = toMercadoPagoReportDate;
exports.getMercadoPagoWindowHours = getMercadoPagoWindowHours;
exports.getMercadoPagoSystemKey = getMercadoPagoSystemKey;
exports.getMercadoPagoMovementDescription = getMercadoPagoMovementDescription;
const env_1 = require("@/lib/env");
exports.MERCADO_PAGO_API_BASE_URL = "https://api.mercadopago.com";
exports.MERCADO_PAGO_HOURLY_INTERVAL_MS = 60 * 60 * 1000;
exports.MERCADO_PAGO_PENDING_CHECK_INTERVAL_MS = 5 * 60 * 1000;
exports.MERCADO_PAGO_HOURLY_WINDOW_HOURS = 24;
exports.MERCADO_PAGO_RECOVERY_WINDOW_HOURS = 48;
exports.MERCADO_PAGO_MANUAL_WINDOW_HOURS = 24;
exports.MERCADO_PAGO_RECOVERY_HOUR = 3;
exports.MERCADO_PAGO_RECOVERY_MINUTE = 15;
exports.MERCADO_PAGO_HTTP_TIMEOUT_MS = 20_000;
exports.MERCADO_PAGO_RECONCILIATION_TOLERANCE_CENTAVOS = 1;
const MERCADO_PAGO_OUTGOING_TRANSACTION_TYPES = new Set([
    "WITHDRAWAL",
    "WITHDRAWAL_CANCEL",
    "PAYOUT",
]);
exports.MERCADO_PAGO_SCHEDULER_SYNC_TYPES = [
    "hourly",
    "daily_recovery",
];
function getMercadoPagoAccessToken() {
    const env = (0, env_1.getServerEnv)();
    if (!env.MERCADOPAGO_ACCESS_TOKEN?.trim()) {
        throw new Error("Configuracion de entorno invalida:\nMERCADOPAGO_ACCESS_TOKEN: es obligatoria para integrar Mercado Pago");
    }
    return env.MERCADOPAGO_ACCESS_TOKEN.trim();
}
function hasMercadoPagoAccessToken() {
    const env = (0, env_1.getServerEnv)();
    return Boolean(env.MERCADOPAGO_ACCESS_TOKEN?.trim());
}
function toMercadoPagoReportDate(date) {
    return date.toISOString();
}
function getMercadoPagoWindowHours(syncType) {
    if (syncType === "daily_recovery") {
        return exports.MERCADO_PAGO_RECOVERY_WINDOW_HOURS;
    }
    if (syncType === "manual") {
        return exports.MERCADO_PAGO_MANUAL_WINDOW_HOURS;
    }
    return exports.MERCADO_PAGO_HOURLY_WINDOW_HOURS;
}
function getMercadoPagoSystemKey(component, direction) {
    if (component === "TAX") {
        return direction === "ingreso"
            ? "mercadopago-tax-income"
            : "mercadopago-tax-expense";
    }
    if (component === "FEE") {
        return direction === "ingreso"
            ? "mercadopago-fee-income"
            : "mercadopago-fee-expense";
    }
    return direction === "ingreso"
        ? "mercadopago-income"
        : "mercadopago-expense";
}
function getMercadoPagoMovementDescription(component, options) {
    if (component === "TAX") {
        return "Impuestos Mercado Pago";
    }
    if (component === "FEE") {
        return "Comision Mercado Pago";
    }
    if (options?.transactionType &&
        MERCADO_PAGO_OUTGOING_TRANSACTION_TYPES.has(options.transactionType)) {
        if (options.direction === "ingreso" && options.transactionType === "WITHDRAWAL_CANCEL") {
            return "Reversion de salida Mercado Pago";
        }
        if (options.direction === "egreso") {
            return "Salida de dinero Mercado Pago";
        }
    }
    return "Mercado Pago";
}
