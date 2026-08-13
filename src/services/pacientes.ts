import { Types } from "mongoose";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { can } from "@/lib/permissions";
import { normalizeDni, normalizeName } from "@/lib/utils";
import { ObraSocialModel } from "@/models/obra-social";
import { PacienteModel } from "@/models/paciente";
import { PacienteDto, QueryParams, SessionUser } from "@/types/domain";

function normalizePacienteName(value: string) {
  return normalizeName(value).toLocaleLowerCase("es-AR");
}

function extractObraSocialId(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && "_id" in value) {
    const nestedId = (value as { _id?: unknown })._id;

    if (nestedId instanceof Types.ObjectId) {
      return nestedId.toString();
    }

    if (typeof nestedId === "string") {
      return nestedId;
    }
  }

  return String(value);
}

function toDto(document: {
  _id: unknown;
  nombre: string;
  apellido: string;
  dni: string;
  obraSocialId: unknown;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
  obraSocial?: { nombre: string } | null;
}): PacienteDto {
  return {
    id: String(document._id),
    nombre: document.nombre,
    apellido: document.apellido,
    dni: document.dni,
    obraSocialId: extractObraSocialId(document.obraSocialId),
    obraSocialNombre: document.obraSocial?.nombre ?? null,
    activo: document.activo,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function buildFilter(
  query: QueryParams,
  user: SessionUser,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.search) {
    filter.$or = [
      { nombre: { $regex: query.search, $options: "i" } },
      { apellido: { $regex: query.search, $options: "i" } },
      { dni: { $regex: query.search, $options: "i" } },
    ];
  }

  if (query.status === "active") {
    filter.activo = true;
  }

  if (query.status === "inactive") {
    filter.activo = false;
  }

  if (query.obraSocialId) {
    filter.obraSocialId = new Types.ObjectId(query.obraSocialId);
  }

  if (!can(user, "pacientes", "write")) {
    filter.activo = true;
  }

  return filter;
}

export async function listPacientes(query: QueryParams, user: SessionUser) {
  await connectToDatabase();

  const filter = buildFilter(query, user);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    PacienteModel.find(filter)
      .populate("obraSocialId", "nombre")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    PacienteModel.countDocuments(filter),
  ]);

  return {
    data: items.map((item) =>
      toDto({
        ...item,
        obraSocial: item.obraSocialId as unknown as { nombre: string },
      }),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function createPaciente(input: {
  nombre: string;
  apellido: string;
  dni: string;
  obraSocialId?: string | null;
}) {
  await connectToDatabase();

  const dni = normalizeDni(input.dni);
  const duplicate = await PacienteModel.findOne({ dni }).lean();

  if (duplicate) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ya existe un paciente con ese DNI",
      409,
      { dni: "Ya existe un paciente con ese DNI" },
    );
  }

  let obraSocialId: string | null = null;

  if (input.obraSocialId) {
    const obraSocial = await ObraSocialModel.findById(input.obraSocialId).lean();

    if (!obraSocial) {
      throw new AppError("NOT_FOUND", "La obra social no existe", 404);
    }

    if (!obraSocial.activo) {
      throw new AppError(
        "INACTIVE_RELATED_RECORD",
        "La obra social debe estar activa",
        409,
      );
    }

    obraSocialId = input.obraSocialId;
  }

  const paciente = await PacienteModel.create({
    nombre: normalizePacienteName(input.nombre),
    apellido: normalizePacienteName(input.apellido),
    dni,
    obraSocialId,
    activo: true,
  });

  await paciente.populate("obraSocialId", "nombre");

  return toDto({
    ...paciente.toObject(),
    obraSocial: paciente.obraSocialId as unknown as { nombre: string } | null,
  });
}

export async function updatePaciente(
  id: string,
  input: {
    nombre: string;
    apellido: string;
    dni: string;
    obraSocialId?: string | null;
  },
) {
  await connectToDatabase();

  const paciente = await PacienteModel.findById(id);

  if (!paciente) {
    throw new AppError("NOT_FOUND", "Paciente no encontrado", 404);
  }

  const dni = normalizeDni(input.dni);
  const duplicate = await PacienteModel.findOne({ dni, _id: { $ne: id } }).lean();

  if (duplicate) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ya existe un paciente con ese DNI",
      409,
      { dni: "Ya existe un paciente con ese DNI" },
    );
  }

  let obraSocialId: Types.ObjectId | null = null;

  if (input.obraSocialId) {
    const obraSocial = await ObraSocialModel.findById(input.obraSocialId).lean();

    if (!obraSocial) {
      throw new AppError("NOT_FOUND", "La obra social no existe", 404);
    }

    const keepsCurrentInactiveObraSocial =
      !obraSocial.activo &&
      paciente.obraSocialId &&
      String(paciente.obraSocialId) === input.obraSocialId;

    if (!obraSocial.activo && !keepsCurrentInactiveObraSocial) {
      throw new AppError(
        "INACTIVE_RELATED_RECORD",
        "La obra social debe estar activa",
        409,
      );
    }

    obraSocialId = new Types.ObjectId(input.obraSocialId);
  }

  paciente.nombre = normalizePacienteName(input.nombre);
  paciente.apellido = normalizePacienteName(input.apellido);
  paciente.dni = dni;
  paciente.obraSocialId = obraSocialId;
  await paciente.save();
  await paciente.populate("obraSocialId", "nombre");

  return toDto({
    ...paciente.toObject(),
    obraSocial: paciente.obraSocialId as unknown as { nombre: string } | null,
  });
}

export async function setPacienteStatus(id: string, activo: boolean) {
  await connectToDatabase();

  const paciente = await PacienteModel.findById(id);

  if (!paciente) {
    throw new AppError("NOT_FOUND", "Paciente no encontrado", 404);
  }

  paciente.activo = activo;
  await paciente.save();
  await paciente.populate("obraSocialId", "nombre");

  return toDto({
    ...paciente.toObject(),
    obraSocial: paciente.obraSocialId as unknown as { nombre: string } | null,
  });
}
