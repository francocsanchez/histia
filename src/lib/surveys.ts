import { parsePhoneNumberFromString } from "libphonenumber-js";
import * as XLSX from "xlsx";

import {
  SurveyCampaignStatus,
  SurveyStatus,
} from "@/types/domain";

export const SURVEY_TIMEZONE = "America/Buenos_Aires";
export const SURVEY_DEFAULT_YEAR = 2026;
export const SURVEY_ACTIVE_STATUSES: SurveyStatus[] = [
  "queued",
  "leased_for_send",
  "waiting_rating",
  "waiting_comment_opt_in",
  "waiting_comment_text",
];
export const SURVEY_WAITING_STATUSES: SurveyStatus[] = [
  "waiting_rating",
  "waiting_comment_opt_in",
  "waiting_comment_text",
];
export const SURVEY_FINAL_STATUSES: SurveyStatus[] = [
  "completed",
  "no_response",
  "cancelled",
  "send_failed",
  "delivery_unknown",
];
export const SURVEY_RUNNING_CAMPAIGN_STATUSES: SurveyCampaignStatus[] = [
  "ready",
  "running",
  "paused",
];
export const SURVEY_REQUIRED_HEADERS = [
  "paciente",
  "numero",
  "fecha atencion",
  "doctor",
] as const;

export type SurveyPreviewRow = {
  previewId: string;
  rowNumber: number;
  patientNameSnapshot: string;
  doctorNameSnapshot: string;
  phoneRaw: string;
  phoneE164: string | null;
  attendanceAt: string | null;
  selected: boolean;
  valid: boolean;
  duplicate: boolean;
  errors: string[];
};

function normalizeSurveySheetRow(row: Record<string, unknown>) {
  const normalizedRow: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    normalizedRow[String(key).trim().toLowerCase()] = value;
  }

  return normalizedRow;
}

export function getDefaultSurveyTemplates() {
  return {
    surveyIntroTemplate:
      "Hola {{patientName}}. Queremos conocer tu experiencia con la atencion recibida por {{doctorName}} recientemente.\n\nComo calificarias tu experiencia general?\n\n1 - Excelente\n2 - Muy buena\n3 - Buena\n4 - Regular\n5 - Mala",
    commentOptInTemplate:
      "Queres dejarnos algun comentario sobre tu experiencia?\n\n1 - Si\n2 - No",
    commentRequestTemplate:
      "Perfecto. Escribi tu comentario y lo tendremos en cuenta.",
    thankYouTemplate: "Muchas gracias por tu tiempo. Que tengas un muy buen dia.",
    invalidRatingTemplate: "Por favor responde con un numero del 1 al 5.",
    invalidCommentOptInTemplate: "Por favor responde 1 para Si o 2 para No.",
    unsupportedCommentTemplate:
      "Por favor envianos tu comentario en texto para poder registrarlo.",
    spontaneousMessageTemplate:
      "Hola. Este numero de On Dent se utiliza exclusivamente para encuestas de satisfaccion. Para solicitar o gestionar turnos podes comunicarte al {{appointmentsPhone}}. Muchas gracias.",
  };
}

export function applySurveyTemplate(
  template: string,
  context: Record<string, string | null | undefined>,
) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = context[key];
    return typeof value === "string" ? value : "";
  });
}

export function normalizeSurveyPhone(rawValue: string) {
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
    const phone = parsePhoneNumberFromString(`+${candidate}`, "AR");

    if (phone?.country === "AR" && phone.isValid()) {
      const normalized = phone.number.replace(/^\+/, "");

      if (normalized.startsWith("549")) {
        return normalized;
      }
    }
  }

  throw new Error("El numero no corresponde a un celular argentino valido para WhatsApp");
}

export function maskPhoneNumber(phoneE164: string) {
  if (phoneE164.length <= 4) {
    return phoneE164;
  }

  return `${phoneE164.slice(0, 4)}****${phoneE164.slice(-3)}`;
}

export function parseSurveyAttendanceValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) {
      throw new Error("La fecha de atencion no es valida");
    }

    const date = new Date(
      Date.UTC(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H,
        parsed.M,
        Math.floor(parsed.S ?? 0),
      ),
    );

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

  if (
    Number.isNaN(day) ||
    Number.isNaN(monthIndex) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
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

  const date = new Date(Date.UTC(SURVEY_DEFAULT_YEAR, monthIndex, day, hour + 3, minute, 0, 0));

  if (Number.isNaN(date.getTime())) {
    throw new Error("La fecha de atencion no es valida");
  }

  return date.toISOString();
}

export function mapSheetRowsToPreviewRows(rows: Record<string, unknown>[]) {
  const seenKeys = new Set<string>();

  return rows.map((sourceRow, index) => {
    const row = normalizeSurveySheetRow(sourceRow);
    const previewRow: SurveyPreviewRow = {
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
    } else {
      try {
        previewRow.phoneE164 = normalizeSurveyPhone(previewRow.phoneRaw);
      } catch (error) {
        previewRow.errors.push(
          error instanceof Error ? error.message : "El numero no es valido",
        );
      }
    }

    try {
      previewRow.attendanceAt = parseSurveyAttendanceValue(row["fecha atencion"]);
    } catch (error) {
      previewRow.errors.push(
        error instanceof Error ? error.message : "La fecha de atencion no es valida",
      );
    }

    if (previewRow.phoneE164 && previewRow.attendanceAt) {
      const duplicateKey = `${previewRow.phoneE164}::${previewRow.attendanceAt}`;

      if (seenKeys.has(duplicateKey)) {
        previewRow.duplicate = true;
      } else {
        seenKeys.add(duplicateKey);
      }
    }

    previewRow.valid = previewRow.errors.length === 0 && !previewRow.duplicate;
    previewRow.selected = previewRow.valid;

    return previewRow;
  });
}

export function buildSurveyCounters(
  surveys: Array<{
    status: SurveyStatus;
  }>,
) {
  return {
    queuedCount: surveys.filter((survey) => survey.status === "queued").length,
    waitingCount: surveys.filter((survey) => SURVEY_WAITING_STATUSES.includes(survey.status)).length,
    completedCount: surveys.filter((survey) => survey.status === "completed").length,
    noResponseCount: surveys.filter((survey) => survey.status === "no_response").length,
    cancelledCount: surveys.filter((survey) => survey.status === "cancelled").length,
    sendFailedCount: surveys.filter((survey) => survey.status === "send_failed").length,
    deliveryUnknownCount: surveys.filter((survey) => survey.status === "delivery_unknown").length,
  };
}

export function isWithinSurveySendWindow(date = new Date(), start = "09:00", end = "18:00") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SURVEY_TIMEZONE,
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

export function getWhatsappJid(phoneE164: string) {
  return `${phoneE164}@s.whatsapp.net`;
}

function extractPhoneCandidateFromJid(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  if (!value.endsWith("@s.whatsapp.net")) {
    return null;
  }

  return value.split("@")[0]?.split(":")[0] ?? null;
}

export function extractPhoneE164FromWhatsAppKey(
  key:
    | {
        remoteJid?: string | null;
        remoteJidAlt?: string | null;
        participant?: string | null;
        participantAlt?: string | null;
      }
    | null
    | undefined,
) {
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

export function extractTextFromWhatsAppMessage(message: Record<string, unknown> | null | undefined) {
  if (!message) {
    return "";
  }

  const normalizedCandidates = [
    (message.conversation as string | undefined) ?? "",
    ((message.extendedTextMessage as { text?: string } | undefined)?.text ?? ""),
    ((message.imageMessage as { caption?: string } | undefined)?.caption ?? ""),
    ((message.videoMessage as { caption?: string } | undefined)?.caption ?? ""),
  ];

  return normalizedCandidates.find((candidate) => candidate.trim())?.trim() ?? "";
}

export function isTextOnlyWhatsAppMessage(message: Record<string, unknown> | null | undefined) {
  if (!message) {
    return false;
  }

  return Boolean(
    typeof message.conversation === "string" ||
      (message.extendedTextMessage &&
        typeof (message.extendedTextMessage as { text?: string }).text === "string"),
  );
}
