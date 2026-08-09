import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { UserRole } from "@/types/domain";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeName(value: string) {
  return normalizeWhitespace(value);
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeDni(value: string) {
  return value.replace(/[.\-\s]/g, "");
}

export function normalizeCode(value: string) {
  return value.trim();
}

export function normalizeTextKey(value: string) {
  return normalizeWhitespace(value).toLocaleLowerCase("es-AR");
}

export function splitRoles(value?: string | null): UserRole[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((role) => role.trim())
    .filter(
      (role): role is UserRole =>
        role === "administrador" ||
        role === "odontologo" ||
        role === "radiologo",
    );
}

export function joinRoles(roles: UserRole[]) {
  return roles.join(",");
}

export function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatMoneyInputFromCents(value: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function parseMoneyInputToCents(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function formatMoneyMaskedInput(value: string) {
  const sanitized = value.replace(/[^\d,]/g, "");
  const commaIndex = sanitized.indexOf(",");
  const hasComma = commaIndex >= 0;
  const integerRaw = hasComma ? sanitized.slice(0, commaIndex) : sanitized;
  const decimalRaw = hasComma ? sanitized.slice(commaIndex + 1).replace(/,/g, "") : "";
  const integerDigits = integerRaw.replace(/^0+(?=\d)/, "") || "0";
  const integerWithSeparators = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (!hasComma) {
    return sanitized ? integerWithSeparators : "";
  }

  return `${integerWithSeparators},${decimalRaw.slice(0, 2)}`;
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function getTodayDateOnly() {
  const today = new Date();

  return `${today.getFullYear()}-${padDatePart(today.getMonth() + 1)}-${padDatePart(today.getDate())}`;
}

export function parseDateOnlyAsUtc(value: string, options?: { endOfDay?: boolean }) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error(`Invalid date-only value: ${value}`);
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const monthIndex = Number(monthValue) - 1;
  const day = Number(dayValue);

  if (options?.endOfDay) {
    return new Date(Date.UTC(year, monthIndex, day, 23, 59, 59, 999));
  }

  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0, 0));
}

export function formatDateOnlyValue(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;

  return `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`;
}

export function formatDateOnly(value: Date | string) {
  const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : formatDateOnlyValue(value);
  const [year, month, day] = normalized.split("-");

  return `${day}/${month}/${year}`;
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
