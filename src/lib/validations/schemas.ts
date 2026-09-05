import { z } from "zod";

import {
  attentionCodeStatusValues,
  movementDirectionValues,
  orthodonticTreatmentStatusValues,
  orthodonticTreatmentTypeValues,
  paymentStatusValues,
  referrerTypeValues,
  rxTypeValues,
  surveyCampaignStatusValues,
  userRoleValues,
} from "@/types/domain";

function normalizeIntegerInput(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const normalized = Number(trimmed);
    return Number.isNaN(normalized) ? null : normalized;
  }

  const normalized = Number(value);
  return Number.isNaN(normalized) ? null : normalized;
}

const nullableNonNegativeIntegerSchema = z.preprocess(
  normalizeIntegerInput,
  z
    .number()
    .int("Debe ser un numero entero")
    .min(0, "Debe ser igual o mayor que cero")
    .nullable(),
);

export const loginSchema = z.object({
  email: z.string().email("Ingresa un email valido"),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
});

export const obraSocialSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  cantidadPrestacionesMes: z
    .coerce.number()
    .int("Debe ser un numero entero")
    .min(0, "Debe ser igual o mayor que cero"),
});

export const codigoObraSocialSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  codigo: z.string().min(1, "El codigo es obligatorio"),
  obraSocialId: z.string().min(1, "La obra social es obligatoria"),
  valorCentavos: z
    .coerce.number()
    .int("El valor debe ser un entero")
    .min(0, "El valor debe ser igual o mayor que cero"),
});

export const pacienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  apellido: z.string().min(1, "El apellido es obligatorio"),
  dni: z.string().min(1, "El DNI es obligatorio"),
  obraSocialId: z.string().optional().nullable(),
});

export const userCreateSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  apellido: z.string().min(1, "El apellido es obligatorio"),
  email: z.string().email("El email no es valido"),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
  roles: z
    .array(z.enum(userRoleValues))
    .min(1, "Debe seleccionar al menos un rol"),
});

export const userUpdateSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  apellido: z.string().min(1, "El apellido es obligatorio"),
  email: z.string().email("El email no es valido"),
  roles: z
    .array(z.enum(userRoleValues))
    .min(1, "Debe seleccionar al menos un rol"),
  activo: z.boolean(),
});

export const userPasswordSchema = z.object({
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
});

export const userPasswordChangeSchema = z
  .object({
    password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
    confirmPassword: z
      .string()
      .min(8, "La confirmacion debe tener al menos 8 caracteres"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contrasenas no coinciden",
  });

const inlinePacienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  apellido: z.string().min(1, "El apellido es obligatorio"),
  dni: z.string().min(1, "El DNI es obligatorio"),
  obraSocialId: z.string().optional().nullable(),
});

export const rxAttentionSchema = z
  .object({
    fecha: z.string().min(1, "La fecha es obligatoria"),
    pacienteId: z.string().optional().nullable(),
    paciente: inlinePacienteSchema.optional(),
    derivanteTipo: z.enum(referrerTypeValues),
    derivanteUserId: z.string().optional().nullable(),
    derivanteExternoNombre: z.string().optional().nullable(),
    tipoRx: z.enum(rxTypeValues),
    valorCentavos: z
      .union([z.coerce.number().int().min(0), z.null()])
      .optional()
      .transform((value) => value ?? null),
    observaciones: z.string().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const hasPacienteId = Boolean(value.pacienteId);
    const hasPacienteInline = Boolean(value.paciente);

    if (!hasPacienteId && !hasPacienteInline) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pacienteId"],
        message: "Debes seleccionar un paciente o crearlo en el flujo",
      });
    }

    if (value.derivanteTipo === "interno") {
      if (!value.derivanteUserId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["derivanteUserId"],
          message: "Debes seleccionar un odontologo interno",
        });
      }
    }

    if (value.derivanteTipo === "externo") {
      if (!value.derivanteExternoNombre?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["derivanteExternoNombre"],
          message: "Debes indicar el profesional derivante externo",
        });
      }
    }
  });

const attentionInlinePacienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  apellido: z.string().min(1, "El apellido es obligatorio"),
  dni: z.string().min(1, "El DNI es obligatorio"),
  obraSocialId: z.string().min(1, "La obra social es obligatoria"),
});

const attentionCodeLineSchema = z.object({
  lineId: z.string().optional(),
  codigoObraSocialId: z.string().min(1, "Debes seleccionar un codigo"),
  pieza: z.string().optional().nullable(),
  coseguroCentavos: nullableNonNegativeIntegerSchema.optional().transform((value) => value ?? null),
  coseguroOdontoCentavos: nullableNonNegativeIntegerSchema
    .optional()
    .transform((value) => value ?? null),
  observacion: z.string().optional().nullable(),
  pagoOdontologoCentavos: z.preprocess(
    (value) => normalizeIntegerInput(value) ?? 0,
    z
      .number()
      .int("El pago al odontologo debe ser un entero")
      .min(0, "El pago al odontologo debe ser igual o mayor que cero"),
  ),
  estado: z.enum(attentionCodeStatusValues).default("pendiente"),
});

export const attentionSchema = z
  .object({
    fecha: z.string().min(1, "La fecha es obligatoria"),
    pacienteId: z.string().optional().nullable(),
    paciente: attentionInlinePacienteSchema.optional(),
    observacionGeneral: z.string().optional().nullable(),
    codigos: z
      .array(attentionCodeLineSchema)
      .min(1, "Debes cargar al menos un codigo"),
  })
  .superRefine((value, ctx) => {
    const hasPacienteId = Boolean(value.pacienteId);
    const hasPacienteInline = Boolean(value.paciente);

    if (!hasPacienteId && !hasPacienteInline) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pacienteId"],
        message: "Debes seleccionar un paciente o crearlo en el flujo",
      });
    }
  });

export const paymentCandidateSelectionSchema = z
  .object({
    sourceType: z.enum(["attention", "orthodontic-payment"]),
    lineId: z.string().min(1, "La linea es obligatoria"),
    payCode: z.boolean(),
    payCoseguroOdonto: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.payCode && !value.payCoseguroOdonto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lineId"],
        message: "Debes seleccionar al menos un concepto a pagar",
      });
    }
  });

export const paymentDebitItemSchema = z.object({
  montoCentavos: z
    .coerce.number()
    .int("El importe del debito debe ser un entero")
    .min(1, "El importe del debito debe ser mayor que cero"),
  observacion: z.string().trim().min(1, "La observacion del debito es obligatoria"),
});

export const paymentCreateSchema = z.object({
  userId: z.string().min(1, "El usuario es obligatorio"),
  attentionMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "El mes debe tener formato YYYY-MM")
    .optional(),
  selectedItems: z
    .array(paymentCandidateSelectionSchema)
    .min(1, "Debes seleccionar al menos un concepto"),
  debitItems: z.array(paymentDebitItemSchema).default([]),
});

export const orthodonticTreatmentSchema = z.object({
  fechaInicio: z.string().min(1, "La fecha de inicio es obligatoria"),
  pacienteId: z.string().optional().nullable(),
  paciente: inlinePacienteSchema.optional(),
  usuarioOrtodoncistaId: z.string().optional().nullable(),
  tratamientoTipo: z.enum(orthodonticTreatmentTypeValues),
  valorTratamientoCentavos: z
    .coerce.number()
    .int("El valor del tratamiento debe ser un entero")
    .min(0, "El valor del tratamiento debe ser igual o mayor que cero"),
  valorMaterialesCentavos: z
    .coerce.number()
    .int("El valor de materiales debe ser un entero")
    .min(0, "El valor de materiales debe ser igual o mayor que cero"),
  estado: z.enum(orthodonticTreatmentStatusValues).default("activo"),
}).superRefine((value, ctx) => {
  const hasPacienteId = Boolean(value.pacienteId);
  const hasPacienteInline = Boolean(value.paciente);

  if (!hasPacienteId && !hasPacienteInline) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pacienteId"],
      message: "Debes seleccionar un paciente o crearlo en el flujo",
    });
  }
});

export const orthodonticPaymentSchema = z.object({
  fecha: z.string().min(1, "La fecha es obligatoria"),
  montoCentavos: z
    .coerce.number()
    .int("El monto debe ser un entero")
    .min(1, "El monto debe ser mayor que cero"),
  porcentajeOrtodoncista: z
    .coerce.number()
    .min(0, "El porcentaje debe ser igual o mayor que cero")
    .max(100, "El porcentaje debe ser igual o menor que 100"),
});

export const paymentStatusSchema = z.enum(paymentStatusValues);

export const movementCreateSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD"),
  descripcion: z.string().optional().nullable(),
  movementTypeId: z.string().min(1, "El tipo de movimiento es obligatorio"),
  montoCentavos: z
    .coerce.number()
    .int("El monto debe ser un entero")
    .min(1, "El monto debe ser mayor que cero"),
});

export const movementUpdateSchema = z.object({
  descripcion: z.string().optional().nullable(),
  movementTypeId: z.string().min(1, "El tipo de movimiento es obligatorio"),
});

export const movementTypeSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  direccion: z.enum(movementDirectionValues),
});

export const surveyPreviewRowSchema = z.object({
  previewId: z.string().min(1),
  rowNumber: z.coerce.number().int().min(2),
  patientNameSnapshot: z.string().min(1),
  doctorNameSnapshot: z.string().min(1),
  phoneRaw: z.string().min(1),
  phoneE164: z.string().min(1),
  attendanceAt: z.string().datetime(),
  selected: z.boolean(),
  valid: z.boolean(),
  duplicate: z.boolean(),
  errors: z.array(z.string()),
});

export const surveyCampaignCreateSchema = z.object({
  fileName: z.string().min(1, "El nombre del archivo es obligatorio"),
  rows: z.array(surveyPreviewRowSchema).min(1, "Debes enviar el preview"),
});

export const surveyCampaignActionSchema = z.object({
  action: z.enum(["start", "pause", "resume", "cancel"]),
});

export const surveyDashboardFilterSchema = z.object({
  status: z.enum(surveyCampaignStatusValues).optional(),
  search: z.string().optional(),
});

export const surveyCancelSchema = z.object({
  surveyId: z.string().min(1, "La encuesta es obligatoria"),
});

export const surveySettingsSchema = z.object({
  surveysEnabled: z.boolean(),
  globalPause: z.boolean(),
  phoneForAppointments: z.string().min(1, "El numero de turnos es obligatorio"),
  sendIntervalSeconds: z.coerce.number().int().min(15).max(3600),
  sendWindowStart: z.string().regex(/^\d{2}:\d{2}$/),
  sendWindowEnd: z.string().regex(/^\d{2}:\d{2}$/),
  noResponseTimeoutHours: z.coerce.number().int().min(1).max(168),
  technicalRetryLimit: z.coerce.number().int().min(0).max(10),
  surveyIntroTemplate: z.string().min(1),
  commentOptInTemplate: z.string().min(1),
  commentRequestTemplate: z.string().min(1),
  thankYouTemplate: z.string().min(1),
  invalidRatingTemplate: z.string().min(1),
  invalidCommentOptInTemplate: z.string().min(1),
  unsupportedCommentTemplate: z.string().min(1),
  spontaneousMessageTemplate: z.string().min(1),
});
