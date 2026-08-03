import { Types } from "mongoose";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { can } from "@/lib/permissions";
import { normalizeCode, normalizeName, normalizeTextKey } from "@/lib/utils";
import { CodigoObraSocialModel } from "@/models/codigo-obra-social";
import { ObraSocialModel } from "@/models/obra-social";
import { CodigoObraSocialDto, QueryParams, SessionUser } from "@/types/domain";

function toDto(document: {
  _id: unknown;
  nombre: string;
  codigo: string;
  obraSocialId: unknown;
  valorCentavos: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
  obraSocial?: { nombre: string } | null;
}): CodigoObraSocialDto {
  return {
    id: String(document._id),
    nombre: document.nombre,
    codigo: document.codigo,
    obraSocialId: String(document.obraSocialId),
    obraSocialNombre: document.obraSocial?.nombre ?? "",
    valorCentavos: document.valorCentavos,
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
      { codigo: { $regex: query.search, $options: "i" } },
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

  if (!can(user, "codigos-obras-sociales", "write")) {
    filter.activo = true;
  }

  return filter;
}

export async function listCodigosObrasSociales(query: QueryParams, user: SessionUser) {
  await connectToDatabase();

  const filter = buildFilter(query, user);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    CodigoObraSocialModel.find(filter)
      .populate("obraSocialId", "nombre")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    CodigoObraSocialModel.countDocuments(filter),
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

export async function createCodigoObraSocial(input: {
  nombre: string;
  codigo: string;
  obraSocialId: string;
  valorCentavos: number;
}) {
  await connectToDatabase();

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

  const nombre = normalizeName(input.nombre);
  const codigo = normalizeCode(input.codigo);
  const codigoNormalizado = normalizeTextKey(codigo);
  const duplicate = await CodigoObraSocialModel.findOne()
    .where("obraSocialId")
    .equals(new Types.ObjectId(input.obraSocialId))
    .where("codigoNormalizado")
    .equals(codigoNormalizado)
    .lean();

  if (duplicate) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ese codigo ya existe para la obra social seleccionada",
      409,
      { codigo: "Ese codigo ya existe para la obra social seleccionada" },
    );
  }

  const codigoObraSocial = new CodigoObraSocialModel();
  codigoObraSocial.nombre = nombre;
  codigoObraSocial.codigo = codigo;
  codigoObraSocial.codigoNormalizado = codigoNormalizado;
  codigoObraSocial.obraSocialId = new Types.ObjectId(input.obraSocialId);
  codigoObraSocial.valorCentavos = input.valorCentavos;
  codigoObraSocial.activo = true;
  await codigoObraSocial.save();

  await codigoObraSocial.populate("obraSocialId", "nombre");

  return toDto({
    ...codigoObraSocial.toObject(),
    obraSocial: codigoObraSocial.obraSocialId as unknown as { nombre: string },
  });
}

export async function updateCodigoObraSocial(
  id: string,
  input: {
    nombre: string;
    codigo: string;
    obraSocialId: string;
    valorCentavos: number;
  },
) {
  await connectToDatabase();

  const codigoObraSocial = await CodigoObraSocialModel.findById(id);

  if (!codigoObraSocial) {
    throw new AppError("NOT_FOUND", "Codigo no encontrado", 404);
  }

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

  const codigo = normalizeCode(input.codigo);
  const codigoNormalizado = normalizeTextKey(codigo);
  const duplicate = await CodigoObraSocialModel.findOne()
    .where("obraSocialId")
    .equals(new Types.ObjectId(input.obraSocialId))
    .where("codigoNormalizado")
    .equals(codigoNormalizado)
    .where("_id")
    .ne(id)
    .lean();

  if (duplicate) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ese codigo ya existe para la obra social seleccionada",
      409,
      { codigo: "Ese codigo ya existe para la obra social seleccionada" },
    );
  }

  codigoObraSocial.nombre = normalizeName(input.nombre);
  codigoObraSocial.codigo = codigo;
  codigoObraSocial.codigoNormalizado = codigoNormalizado;
  codigoObraSocial.obraSocialId = new Types.ObjectId(input.obraSocialId);
  codigoObraSocial.valorCentavos = input.valorCentavos;
  await codigoObraSocial.save();
  await codigoObraSocial.populate("obraSocialId", "nombre");

  return toDto({
    ...codigoObraSocial.toObject(),
    obraSocial: codigoObraSocial.obraSocialId as unknown as { nombre: string },
  });
}

export async function setCodigoObraSocialStatus(id: string, activo: boolean) {
  await connectToDatabase();

  const codigo = await CodigoObraSocialModel.findById(id);

  if (!codigo) {
    throw new AppError("NOT_FOUND", "Codigo no encontrado", 404);
  }

  codigo.activo = activo;
  await codigo.save();
  await codigo.populate("obraSocialId", "nombre");

  return toDto({
    ...codigo.toObject(),
    obraSocial: codigo.obraSocialId as unknown as { nombre: string },
  });
}
