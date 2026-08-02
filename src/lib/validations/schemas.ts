import { z } from "zod";

import { userRoleValues } from "@/types/domain";

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
