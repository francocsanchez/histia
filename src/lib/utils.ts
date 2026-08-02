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

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
