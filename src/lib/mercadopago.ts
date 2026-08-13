import { getServerEnv } from "@/lib/env";
import {
  MercadoPagoExternalComponent,
  MercadoPagoSyncType,
} from "@/types/domain";

export const MERCADO_PAGO_API_BASE_URL = "https://api.mercadopago.com";
export const MERCADO_PAGO_HOURLY_INTERVAL_MS = 60 * 60 * 1000;
export const MERCADO_PAGO_PENDING_CHECK_INTERVAL_MS = 5 * 60 * 1000;
export const MERCADO_PAGO_HOURLY_WINDOW_HOURS = 24;
export const MERCADO_PAGO_RECOVERY_WINDOW_HOURS = 48;
export const MERCADO_PAGO_MANUAL_WINDOW_HOURS = 24;
export const MERCADO_PAGO_RECOVERY_HOUR = 3;
export const MERCADO_PAGO_RECOVERY_MINUTE = 15;
export const MERCADO_PAGO_HTTP_TIMEOUT_MS = 20_000;
export const MERCADO_PAGO_RECONCILIATION_TOLERANCE_CENTAVOS = 1;
const MERCADO_PAGO_OUTGOING_TRANSACTION_TYPES = new Set([
  "WITHDRAWAL",
  "WITHDRAWAL_CANCEL",
  "PAYOUT",
]);

export const MERCADO_PAGO_SCHEDULER_SYNC_TYPES: MercadoPagoSyncType[] = [
  "hourly",
  "daily_recovery",
];

export function getMercadoPagoAccessToken() {
  const env = getServerEnv();

  if (!env.MERCADOPAGO_ACCESS_TOKEN?.trim()) {
    throw new Error(
      "Configuracion de entorno invalida:\nMERCADOPAGO_ACCESS_TOKEN: es obligatoria para integrar Mercado Pago",
    );
  }

  return env.MERCADOPAGO_ACCESS_TOKEN.trim();
}

export function hasMercadoPagoAccessToken() {
  const env = getServerEnv();
  return Boolean(env.MERCADOPAGO_ACCESS_TOKEN?.trim());
}

export function toMercadoPagoReportDate(date: Date) {
  return date.toISOString();
}

export function getMercadoPagoWindowHours(syncType: MercadoPagoSyncType) {
  if (syncType === "daily_recovery") {
    return MERCADO_PAGO_RECOVERY_WINDOW_HOURS;
  }

  if (syncType === "manual") {
    return MERCADO_PAGO_MANUAL_WINDOW_HOURS;
  }

  return MERCADO_PAGO_HOURLY_WINDOW_HOURS;
}

export function getMercadoPagoSystemKey(
  component: MercadoPagoExternalComponent,
  direction: "ingreso" | "egreso",
) {
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

export function getMercadoPagoMovementDescription(
  component: MercadoPagoExternalComponent,
  options?: {
    transactionType?: string | null;
    direction?: "ingreso" | "egreso";
  },
) {
  if (component === "TAX") {
    return "Impuestos Mercado Pago";
  }

  if (component === "FEE") {
    return "Comision Mercado Pago";
  }

  if (
    options?.transactionType &&
    MERCADO_PAGO_OUTGOING_TRANSACTION_TYPES.has(options.transactionType)
  ) {
    if (options.direction === "ingreso" && options.transactionType === "WITHDRAWAL_CANCEL") {
      return "Reversion de salida Mercado Pago";
    }

    if (options.direction === "egreso") {
      return "Salida de dinero Mercado Pago";
    }
  }

  return "Mercado Pago";
}
