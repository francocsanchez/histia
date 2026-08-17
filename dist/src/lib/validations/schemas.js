"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.surveySettingsSchema = exports.surveyCancelSchema = exports.surveyDashboardFilterSchema = exports.surveyCampaignActionSchema = exports.surveyCampaignCreateSchema = exports.surveyPreviewRowSchema = exports.movementTypeSchema = exports.movementUpdateSchema = exports.movementCreateSchema = exports.paymentStatusSchema = exports.paymentCreateSchema = exports.paymentCandidateSelectionSchema = exports.attentionSchema = exports.rxAttentionSchema = exports.userPasswordChangeSchema = exports.userPasswordSchema = exports.userUpdateSchema = exports.userCreateSchema = exports.pacienteSchema = exports.codigoObraSocialSchema = exports.obraSocialSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
const domain_1 = require("@/types/domain");
function normalizeIntegerInput(value) {
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
const nullableNonNegativeIntegerSchema = zod_1.z.preprocess(normalizeIntegerInput, zod_1.z
    .number()
    .int("Debe ser un numero entero")
    .min(0, "Debe ser igual o mayor que cero")
    .nullable());
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Ingresa un email valido"),
    password: zod_1.z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
});
exports.obraSocialSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1, "El nombre es obligatorio"),
    cantidadPrestacionesMes: zod_1.z
        .coerce.number()
        .int("Debe ser un numero entero")
        .min(0, "Debe ser igual o mayor que cero"),
});
exports.codigoObraSocialSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1, "El nombre es obligatorio"),
    codigo: zod_1.z.string().min(1, "El codigo es obligatorio"),
    obraSocialId: zod_1.z.string().min(1, "La obra social es obligatoria"),
    valorCentavos: zod_1.z
        .coerce.number()
        .int("El valor debe ser un entero")
        .min(0, "El valor debe ser igual o mayor que cero"),
});
exports.pacienteSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1, "El nombre es obligatorio"),
    apellido: zod_1.z.string().min(1, "El apellido es obligatorio"),
    dni: zod_1.z.string().min(1, "El DNI es obligatorio"),
    obraSocialId: zod_1.z.string().optional().nullable(),
});
exports.userCreateSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1, "El nombre es obligatorio"),
    apellido: zod_1.z.string().min(1, "El apellido es obligatorio"),
    email: zod_1.z.string().email("El email no es valido"),
    password: zod_1.z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
    roles: zod_1.z
        .array(zod_1.z.enum(domain_1.userRoleValues))
        .min(1, "Debe seleccionar al menos un rol"),
});
exports.userUpdateSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1, "El nombre es obligatorio"),
    apellido: zod_1.z.string().min(1, "El apellido es obligatorio"),
    email: zod_1.z.string().email("El email no es valido"),
    roles: zod_1.z
        .array(zod_1.z.enum(domain_1.userRoleValues))
        .min(1, "Debe seleccionar al menos un rol"),
    activo: zod_1.z.boolean(),
});
exports.userPasswordSchema = zod_1.z.object({
    password: zod_1.z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
});
exports.userPasswordChangeSchema = zod_1.z
    .object({
    password: zod_1.z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
    confirmPassword: zod_1.z
        .string()
        .min(8, "La confirmacion debe tener al menos 8 caracteres"),
})
    .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contrasenas no coinciden",
});
const inlinePacienteSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1, "El nombre es obligatorio"),
    apellido: zod_1.z.string().min(1, "El apellido es obligatorio"),
    dni: zod_1.z.string().min(1, "El DNI es obligatorio"),
    obraSocialId: zod_1.z.string().optional().nullable(),
});
exports.rxAttentionSchema = zod_1.z
    .object({
    fecha: zod_1.z.string().min(1, "La fecha es obligatoria"),
    pacienteId: zod_1.z.string().optional().nullable(),
    paciente: inlinePacienteSchema.optional(),
    derivanteTipo: zod_1.z.enum(domain_1.referrerTypeValues),
    derivanteUserId: zod_1.z.string().optional().nullable(),
    derivanteExternoNombre: zod_1.z.string().optional().nullable(),
    tipoRx: zod_1.z.enum(domain_1.rxTypeValues),
    valorCentavos: zod_1.z
        .union([zod_1.z.coerce.number().int().min(0), zod_1.z.null()])
        .optional()
        .transform((value) => value ?? null),
    observaciones: zod_1.z.string().optional().nullable(),
})
    .superRefine((value, ctx) => {
    const hasPacienteId = Boolean(value.pacienteId);
    const hasPacienteInline = Boolean(value.paciente);
    if (!hasPacienteId && !hasPacienteInline) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["pacienteId"],
            message: "Debes seleccionar un paciente o crearlo en el flujo",
        });
    }
    if (value.derivanteTipo === "interno") {
        if (!value.derivanteUserId) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["derivanteUserId"],
                message: "Debes seleccionar un odontologo interno",
            });
        }
    }
    if (value.derivanteTipo === "externo") {
        if (!value.derivanteExternoNombre?.trim()) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["derivanteExternoNombre"],
                message: "Debes indicar el profesional derivante externo",
            });
        }
    }
});
const attentionInlinePacienteSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1, "El nombre es obligatorio"),
    apellido: zod_1.z.string().min(1, "El apellido es obligatorio"),
    dni: zod_1.z.string().min(1, "El DNI es obligatorio"),
    obraSocialId: zod_1.z.string().min(1, "La obra social es obligatoria"),
});
const attentionCodeLineSchema = zod_1.z.object({
    lineId: zod_1.z.string().optional(),
    codigoObraSocialId: zod_1.z.string().min(1, "Debes seleccionar un codigo"),
    pieza: zod_1.z.string().optional().nullable(),
    coseguroCentavos: nullableNonNegativeIntegerSchema.optional().transform((value) => value ?? null),
    coseguroOdontoCentavos: nullableNonNegativeIntegerSchema
        .optional()
        .transform((value) => value ?? null),
    observacion: zod_1.z.string().optional().nullable(),
    pagoOdontologoCentavos: zod_1.z.preprocess((value) => normalizeIntegerInput(value) ?? 0, zod_1.z
        .number()
        .int("El pago al odontologo debe ser un entero")
        .min(0, "El pago al odontologo debe ser igual o mayor que cero")),
    estado: zod_1.z.enum(domain_1.attentionCodeStatusValues).default("pendiente"),
});
exports.attentionSchema = zod_1.z
    .object({
    fecha: zod_1.z.string().min(1, "La fecha es obligatoria"),
    pacienteId: zod_1.z.string().optional().nullable(),
    paciente: attentionInlinePacienteSchema.optional(),
    observacionGeneral: zod_1.z.string().optional().nullable(),
    codigos: zod_1.z
        .array(attentionCodeLineSchema)
        .min(1, "Debes cargar al menos un codigo"),
})
    .superRefine((value, ctx) => {
    const hasPacienteId = Boolean(value.pacienteId);
    const hasPacienteInline = Boolean(value.paciente);
    if (!hasPacienteId && !hasPacienteInline) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["pacienteId"],
            message: "Debes seleccionar un paciente o crearlo en el flujo",
        });
    }
});
exports.paymentCandidateSelectionSchema = zod_1.z
    .object({
    lineId: zod_1.z.string().min(1, "La linea es obligatoria"),
    payCode: zod_1.z.boolean(),
    payCoseguroOdonto: zod_1.z.boolean(),
})
    .superRefine((value, ctx) => {
    if (!value.payCode && !value.payCoseguroOdonto) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["lineId"],
            message: "Debes seleccionar al menos un concepto a pagar",
        });
    }
});
exports.paymentCreateSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, "El usuario es obligatorio"),
    attentionMonth: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}$/, "El mes debe tener formato YYYY-MM"),
    selectedItems: zod_1.z
        .array(exports.paymentCandidateSelectionSchema)
        .min(1, "Debes seleccionar al menos un concepto"),
});
exports.paymentStatusSchema = zod_1.z.enum(domain_1.paymentStatusValues);
exports.movementCreateSchema = zod_1.z.object({
    fecha: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD"),
    descripcion: zod_1.z.string().optional().nullable(),
    movementTypeId: zod_1.z.string().min(1, "El tipo de movimiento es obligatorio"),
    montoCentavos: zod_1.z
        .coerce.number()
        .int("El monto debe ser un entero")
        .min(1, "El monto debe ser mayor que cero"),
});
exports.movementUpdateSchema = zod_1.z.object({
    descripcion: zod_1.z.string().optional().nullable(),
    movementTypeId: zod_1.z.string().min(1, "El tipo de movimiento es obligatorio"),
});
exports.movementTypeSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1, "El nombre es obligatorio"),
    direccion: zod_1.z.enum(domain_1.movementDirectionValues),
});
exports.surveyPreviewRowSchema = zod_1.z.object({
    previewId: zod_1.z.string().min(1),
    rowNumber: zod_1.z.coerce.number().int().min(2),
    patientNameSnapshot: zod_1.z.string().min(1),
    doctorNameSnapshot: zod_1.z.string().min(1),
    phoneRaw: zod_1.z.string().min(1),
    phoneE164: zod_1.z.string().min(1),
    attendanceAt: zod_1.z.string().datetime(),
    selected: zod_1.z.boolean(),
    valid: zod_1.z.boolean(),
    duplicate: zod_1.z.boolean(),
    errors: zod_1.z.array(zod_1.z.string()),
});
exports.surveyCampaignCreateSchema = zod_1.z.object({
    fileName: zod_1.z.string().min(1, "El nombre del archivo es obligatorio"),
    rows: zod_1.z.array(exports.surveyPreviewRowSchema).min(1, "Debes enviar el preview"),
});
exports.surveyCampaignActionSchema = zod_1.z.object({
    action: zod_1.z.enum(["start", "pause", "resume", "cancel"]),
});
exports.surveyDashboardFilterSchema = zod_1.z.object({
    status: zod_1.z.enum(domain_1.surveyCampaignStatusValues).optional(),
    search: zod_1.z.string().optional(),
});
exports.surveyCancelSchema = zod_1.z.object({
    surveyId: zod_1.z.string().min(1, "La encuesta es obligatoria"),
});
exports.surveySettingsSchema = zod_1.z.object({
    surveysEnabled: zod_1.z.boolean(),
    globalPause: zod_1.z.boolean(),
    phoneForAppointments: zod_1.z.string().min(1, "El numero de turnos es obligatorio"),
    sendIntervalSeconds: zod_1.z.coerce.number().int().min(15).max(3600),
    sendWindowStart: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    sendWindowEnd: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    noResponseTimeoutHours: zod_1.z.coerce.number().int().min(1).max(168),
    technicalRetryLimit: zod_1.z.coerce.number().int().min(0).max(10),
    surveyIntroTemplate: zod_1.z.string().min(1),
    commentOptInTemplate: zod_1.z.string().min(1),
    commentRequestTemplate: zod_1.z.string().min(1),
    thankYouTemplate: zod_1.z.string().min(1),
    invalidRatingTemplate: zod_1.z.string().min(1),
    invalidCommentOptInTemplate: zod_1.z.string().min(1),
    unsupportedCommentTemplate: zod_1.z.string().min(1),
    spontaneousMessageTemplate: zod_1.z.string().min(1),
});
