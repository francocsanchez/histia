"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SURVEY_REQUIRED_HEADERS = exports.SURVEY_RUNNING_CAMPAIGN_STATUSES = exports.SURVEY_FINAL_STATUSES = exports.SURVEY_WAITING_STATUSES = exports.SURVEY_ACTIVE_STATUSES = exports.SURVEY_DEFAULT_YEAR = exports.SURVEY_TIMEZONE = void 0;
exports.getDefaultSurveyTemplates = getDefaultSurveyTemplates;
exports.applySurveyTemplate = applySurveyTemplate;
exports.normalizeSurveyPhone = normalizeSurveyPhone;
exports.maskPhoneNumber = maskPhoneNumber;
exports.parseSurveyAttendanceValue = parseSurveyAttendanceValue;
exports.mapSheetRowsToPreviewRows = mapSheetRowsToPreviewRows;
exports.buildSurveyCounters = buildSurveyCounters;
exports.getWhatsAppReconnectDelayMs = getWhatsAppReconnectDelayMs;
exports.getWhatsAppStatusPollingIntervalMs = getWhatsAppStatusPollingIntervalMs;
exports.getVisibleWhatsAppPhoneNumber = getVisibleWhatsAppPhoneNumber;
exports.isWithinSurveySendWindow = isWithinSurveySendWindow;
exports.getWhatsappJid = getWhatsappJid;
exports.extractPhoneE164FromWhatsAppKey = extractPhoneE164FromWhatsAppKey;
exports.extractTextFromWhatsAppMessage = extractTextFromWhatsAppMessage;
exports.isTextOnlyWhatsAppMessage = isTextOnlyWhatsAppMessage;
const libphonenumber_js_1 = require("libphonenumber-js");
const XLSX = __importStar(require("xlsx"));
exports.SURVEY_TIMEZONE = "America/Buenos_Aires";
exports.SURVEY_DEFAULT_YEAR = 2026;
exports.SURVEY_ACTIVE_STATUSES = [
    "queued",
    "leased_for_send",
    "waiting_rating",
    "waiting_comment_opt_in",
    "waiting_comment_text",
];
exports.SURVEY_WAITING_STATUSES = [
    "waiting_rating",
    "waiting_comment_opt_in",
    "waiting_comment_text",
];
exports.SURVEY_FINAL_STATUSES = [
    "completed",
    "no_response",
    "cancelled",
    "send_failed",
    "delivery_unknown",
];
exports.SURVEY_RUNNING_CAMPAIGN_STATUSES = [
    "ready",
    "running",
    "paused",
];
exports.SURVEY_REQUIRED_HEADERS = [
    "paciente",
    "numero",
    "fecha atencion",
    "doctor",
];
function normalizeSurveySheetRow(row) {
    const normalizedRow = {};
    for (const [key, value] of Object.entries(row)) {
        normalizedRow[String(key).trim().toLowerCase()] = value;
    }
    return normalizedRow;
}
function getDefaultSurveyTemplates() {
    return {
        surveyIntroTemplate: "Hola {{patientName}}. Queremos conocer tu experiencia con la atencion recibida por {{doctorName}} recientemente.\n\nComo calificarias tu experiencia general?\n\n1 - Excelente\n2 - Muy buena\n3 - Buena\n4 - Regular\n5 - Mala",
        commentOptInTemplate: "Queres dejarnos algun comentario sobre tu experiencia?\n\n1 - Si\n2 - No",
        commentRequestTemplate: "Perfecto. Escribi tu comentario y lo tendremos en cuenta.",
        thankYouTemplate: "Muchas gracias por tu tiempo. Que tengas un muy buen dia.",
        invalidRatingTemplate: "Por favor responde con un numero del 1 al 5.",
        invalidCommentOptInTemplate: "Por favor responde 1 para Si o 2 para No.",
        unsupportedCommentTemplate: "Por favor envianos tu comentario en texto para poder registrarlo.",
        spontaneousMessageTemplate: "Hola. Este numero de On Dent se utiliza exclusivamente para encuestas de satisfaccion. Para solicitar o gestionar turnos podes comunicarte al {{appointmentsPhone}}. Muchas gracias.",
    };
}
function applySurveyTemplate(template, context) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const value = context[key];
        return typeof value === "string" ? value : "";
    });
}
function normalizeSurveyPhone(rawValue) {
    const digits = rawValue.replace(/[^\d]/g, "");
    if (!digits) {
        throw new Error("El numero es obligatorio");
    }
    const sanitized = digits.replace(/^0+/, "");
    const withoutCountryCode = sanitized.startsWith("54") ? sanitized.slice(2) : sanitized;
    const withoutMobilePrefix = withoutCountryCode.startsWith("9")
        ? withoutCountryCode.slice(1)
        : withoutCountryCode;
    const candidates = [
        `549${withoutMobilePrefix}`,
        sanitized,
        `54${withoutCountryCode}`,
    ];
    for (const candidate of new Set(candidates)) {
        const phone = (0, libphonenumber_js_1.parsePhoneNumberFromString)(`+${candidate}`, "AR");
        if (phone?.country === "AR" && phone.isValid()) {
            const normalized = phone.number.replace(/^\+/, "");
            if (normalized.startsWith("549")) {
                return normalized;
            }
        }
    }
    throw new Error("El numero no corresponde a un celular argentino valido para WhatsApp");
}
function maskPhoneNumber(phoneE164) {
    if (phoneE164.length <= 4) {
        return phoneE164;
    }
    return `${phoneE164.slice(0, 4)}****${phoneE164.slice(-3)}`;
}
function parseSurveyAttendanceValue(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
    }
    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (!parsed) {
            throw new Error("La fecha de atencion no es valida");
        }
        const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, Math.floor(parsed.S ?? 0)));
        return date.toISOString();
    }
    const text = String(value ?? "").trim().toUpperCase();
    if (!text) {
        throw new Error("La fecha de atencion es obligatoria");
    }
    const match = /^(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(AM|PM)$/.exec(text);
    if (!match) {
        throw new Error("La fecha de atencion debe tener formato DD-MM hh:mmAM");
    }
    const [, dayValue, monthValue, hourValue, minuteValue, meridiem] = match;
    const day = Number(dayValue);
    const monthIndex = Number(monthValue) - 1;
    let hour = Number(hourValue);
    const minute = Number(minuteValue);
    if (Number.isNaN(day) ||
        Number.isNaN(monthIndex) ||
        Number.isNaN(hour) ||
        Number.isNaN(minute)) {
        throw new Error("La fecha de atencion no es valida");
    }
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59 || monthIndex < 0 || monthIndex > 11) {
        throw new Error("La fecha de atencion no es valida");
    }
    if (meridiem === "PM" && hour < 12) {
        hour += 12;
    }
    if (meridiem === "AM" && hour === 12) {
        hour = 0;
    }
    const date = new Date(Date.UTC(exports.SURVEY_DEFAULT_YEAR, monthIndex, day, hour + 3, minute, 0, 0));
    if (Number.isNaN(date.getTime())) {
        throw new Error("La fecha de atencion no es valida");
    }
    return date.toISOString();
}
function mapSheetRowsToPreviewRows(rows) {
    const seenKeys = new Set();
    return rows.map((sourceRow, index) => {
        const row = normalizeSurveySheetRow(sourceRow);
        const previewRow = {
            previewId: `row-${index + 1}`,
            rowNumber: index + 2,
            patientNameSnapshot: String(row.paciente ?? "").trim(),
            doctorNameSnapshot: String(row.doctor ?? "").trim(),
            phoneRaw: String(row.numero ?? "").trim(),
            phoneE164: null,
            attendanceAt: null,
            selected: true,
            valid: false,
            duplicate: false,
            errors: [],
        };
        if (!previewRow.patientNameSnapshot) {
            previewRow.errors.push("El paciente es obligatorio");
        }
        if (!previewRow.doctorNameSnapshot) {
            previewRow.errors.push("El doctor es obligatorio");
        }
        if (!previewRow.phoneRaw) {
            previewRow.errors.push("El numero es obligatorio");
        }
        else {
            try {
                previewRow.phoneE164 = normalizeSurveyPhone(previewRow.phoneRaw);
            }
            catch (error) {
                previewRow.errors.push(error instanceof Error ? error.message : "El numero no es valido");
            }
        }
        try {
            previewRow.attendanceAt = parseSurveyAttendanceValue(row["fecha atencion"]);
        }
        catch (error) {
            previewRow.errors.push(error instanceof Error ? error.message : "La fecha de atencion no es valida");
        }
        if (previewRow.phoneE164 && previewRow.attendanceAt) {
            const duplicateKey = `${previewRow.phoneE164}::${previewRow.attendanceAt}`;
            if (seenKeys.has(duplicateKey)) {
                previewRow.duplicate = true;
            }
            else {
                seenKeys.add(duplicateKey);
            }
        }
        previewRow.valid = previewRow.errors.length === 0 && !previewRow.duplicate;
        previewRow.selected = previewRow.valid;
        return previewRow;
    });
}
function buildSurveyCounters(surveys) {
    return {
        queuedCount: surveys.filter((survey) => survey.status === "queued").length,
        waitingCount: surveys.filter((survey) => exports.SURVEY_WAITING_STATUSES.includes(survey.status)).length,
        completedCount: surveys.filter((survey) => survey.status === "completed").length,
        noResponseCount: surveys.filter((survey) => survey.status === "no_response").length,
        cancelledCount: surveys.filter((survey) => survey.status === "cancelled").length,
        sendFailedCount: surveys.filter((survey) => survey.status === "send_failed").length,
        deliveryUnknownCount: surveys.filter((survey) => survey.status === "delivery_unknown").length,
    };
}
const WHATSAPP_RECONNECT_DELAYS_MS = [5_000, 10_000, 20_000, 30_000];
function getWhatsAppReconnectDelayMs(attempt) {
    return (WHATSAPP_RECONNECT_DELAYS_MS[Math.min(Math.max(attempt, 0), WHATSAPP_RECONNECT_DELAYS_MS.length - 1)] ?? WHATSAPP_RECONNECT_DELAYS_MS[WHATSAPP_RECONNECT_DELAYS_MS.length - 1]);
}
function getWhatsAppStatusPollingIntervalMs(status) {
    if (status === "connected") {
        return 10_000;
    }
    if (status === "qr_required" || status === "connecting" || status === "disconnecting") {
        return 2_500;
    }
    return 5_000;
}
function getVisibleWhatsAppPhoneNumber(status, phoneNumber) {
    return status === "connected" ? (phoneNumber ?? null) : null;
}
function isWithinSurveySendWindow(date = new Date(), start = "09:00", end = "18:00") {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: exports.SURVEY_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    const [startHour, startMinute] = start.split(":").map(Number);
    const [endHour, endMinute] = end.split(":").map(Number);
    const current = hour * 60 + minute;
    const lowerBound = startHour * 60 + startMinute;
    const upperBound = endHour * 60 + endMinute;
    return current >= lowerBound && current <= upperBound;
}
function getWhatsappJid(phoneE164) {
    return `${phoneE164}@s.whatsapp.net`;
}
function extractPhoneCandidateFromJid(value) {
    if (typeof value !== "string") {
        return null;
    }
    if (!value.endsWith("@s.whatsapp.net")) {
        return null;
    }
    return value.split("@")[0]?.split(":")[0] ?? null;
}
function extractPhoneE164FromWhatsAppKey(key) {
    if (!key) {
        return null;
    }
    const candidates = [
        extractPhoneCandidateFromJid(key.remoteJid),
        extractPhoneCandidateFromJid(key.remoteJidAlt),
        extractPhoneCandidateFromJid(key.participant),
        extractPhoneCandidateFromJid(key.participantAlt),
    ];
    return candidates.find((candidate) => Boolean(candidate)) ?? null;
}
function extractTextFromWhatsAppMessage(message) {
    if (!message) {
        return "";
    }
    const normalizedCandidates = [
        message.conversation ?? "",
        (message.extendedTextMessage?.text ?? ""),
        (message.imageMessage?.caption ?? ""),
        (message.videoMessage?.caption ?? ""),
    ];
    return normalizedCandidates.find((candidate) => candidate.trim())?.trim() ?? "";
}
function isTextOnlyWhatsAppMessage(message) {
    if (!message) {
        return false;
    }
    return Boolean(typeof message.conversation === "string" ||
        (message.extendedTextMessage &&
            typeof message.extendedTextMessage.text === "string"));
}
