"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cn = cn;
exports.normalizeWhitespace = normalizeWhitespace;
exports.normalizeName = normalizeName;
exports.normalizeEmail = normalizeEmail;
exports.normalizeDni = normalizeDni;
exports.normalizeCode = normalizeCode;
exports.normalizeTextKey = normalizeTextKey;
exports.splitRoles = splitRoles;
exports.joinRoles = joinRoles;
exports.formatCurrencyFromCents = formatCurrencyFromCents;
exports.formatMoneyInputFromCents = formatMoneyInputFromCents;
exports.parseMoneyInputToCents = parseMoneyInputToCents;
exports.formatMoneyMaskedInput = formatMoneyMaskedInput;
exports.getTodayDateOnly = getTodayDateOnly;
exports.parseDateOnlyAsUtc = parseDateOnlyAsUtc;
exports.formatDateOnlyValue = formatDateOnlyValue;
exports.formatDateOnly = formatDateOnly;
exports.formatDate = formatDate;
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
function normalizeWhitespace(value) {
    return value.trim().replace(/\s+/g, " ");
}
function normalizeName(value) {
    return normalizeWhitespace(value);
}
function normalizeEmail(value) {
    return value.trim().toLowerCase();
}
function normalizeDni(value) {
    return value.replace(/[.\-\s]/g, "");
}
function normalizeCode(value) {
    return value.trim();
}
function normalizeTextKey(value) {
    return normalizeWhitespace(value).toLocaleLowerCase("es-AR");
}
function splitRoles(value) {
    if (!value) {
        return [];
    }
    return value
        .split(",")
        .map((role) => role.trim())
        .filter((role) => role === "administrador" ||
        role === "odontologo" ||
        role === "radiologo");
}
function joinRoles(roles) {
    return roles.join(",");
}
function formatCurrencyFromCents(value) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 2,
    }).format(value / 100);
}
function formatMoneyInputFromCents(value) {
    return new Intl.NumberFormat("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value / 100);
}
function parseMoneyInputToCents(value) {
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
function formatMoneyMaskedInput(value) {
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
function padDatePart(value) {
    return String(value).padStart(2, "0");
}
function getTodayDateOnly() {
    const today = new Date();
    return `${today.getFullYear()}-${padDatePart(today.getMonth() + 1)}-${padDatePart(today.getDate())}`;
}
function parseDateOnlyAsUtc(value, options) {
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
function formatDateOnlyValue(value) {
    const date = typeof value === "string" ? new Date(value) : value;
    return `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`;
}
function formatDateOnly(value) {
    const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? value
        : formatDateOnlyValue(value);
    const [year, month, day] = normalized.split("-");
    return `${day}/${month}/${year}`;
}
function formatDate(value) {
    return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value));
}
