import { z } from "zod";

import {
  attentionCodeStatusValues,
  referrerTypeValues,
  rxTypeValues,
  userRoleValues,
} from "@/types/domain";

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
  codigoObraSocialId: z.string().min(1, "Debes seleccionar un codigo"),
  pieza: z.string().optional().nullable(),
  coseguroCentavos: z
    .union([z.coerce.number().int().min(0), z.null()])
    .optional()
    .transform((value) => value ?? null),
  coseguroOdontoCentavos: z
    .union([z.coerce.number().int().min(0), z.null()])
    .optional()
    .transform((value) => value ?? null),
  observacion: z.string().optional().nullable(),
  pagoOdontologoCentavos: z
    .coerce.number()
    .int("El pago al odontologo debe ser un entero")
    .min(0, "El pago al odontologo debe ser igual o mayor que cero"),
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
