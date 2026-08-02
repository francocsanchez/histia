import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { can } from "@/lib/permissions";
import { normalizeName, normalizeTextKey } from "@/lib/utils";
import { ObraSocialDocument, ObraSocialModel } from "@/models/obra-social";
import { ObraSocialDto, QueryParams, SessionUser } from "@/types/domain";

function toDto(document: ObraSocialDocument): ObraSocialDto {
  return {
    id: document._id.toString(),
    nombre: document.nombre,
    cantidadPrestacionesMes: document.cantidadPrestacionesMes,
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
    filter.nombre = { $regex: query.search, $options: "i" };
  }

  if (query.status === "active") {
    filter.activo = true;
  }

  if (query.status === "inactive") {
    filter.activo = false;
  }

  if (!can(user, "obras-sociales", "write")) {
    filter.activo = true;
  }

  return filter;
}

export async function listObrasSociales(query: QueryParams, user: SessionUser) {
  await connectToDatabase();

  const filter = buildFilter(query, user);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    ObraSocialModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    ObraSocialModel.countDocuments(filter),
  ]);

  return {
    data: items.map((item) => toDto(item as unknown as ObraSocialDocument)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function listActiveObrasSociales() {
  await connectToDatabase();

  const items = await ObraSocialModel.find({ activo: true })
    .sort({ nombre: 1 })
    .lean();

  return items.map((item) => toDto(item as unknown as ObraSocialDocument));
}

export async function createObraSocial(input: {
  nombre: string;
  cantidadPrestacionesMes: number;
}) {
  await connectToDatabase();

  const nombre = normalizeName(input.nombre);
  const nombreNormalizado = normalizeTextKey(nombre);
  const existing = await ObraSocialModel.findOne({ nombreNormalizado }).lean();

  if (existing) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ya existe una obra social con ese nombre",
      409,
      { nombre: "Ya existe una obra social con ese nombre" },
    );
  }

  const obraSocial = await ObraSocialModel.create({
    nombre,
    nombreNormalizado,
    cantidadPrestacionesMes: input.cantidadPrestacionesMes,
    activo: true,
  });

  return toDto(obraSocial.toObject());
}

export async function updateObraSocial(
  id: string,
  input: { nombre: string; cantidadPrestacionesMes: number },
) {
  await connectToDatabase();

  const obraSocial = await ObraSocialModel.findById(id);

  if (!obraSocial) {
    throw new AppError("NOT_FOUND", "Obra social no encontrada", 404);
  }

  const nombre = normalizeName(input.nombre);
  const nombreNormalizado = normalizeTextKey(nombre);
  const duplicate = await ObraSocialModel.findOne({
    nombreNormalizado,
    _id: { $ne: obraSocial._id },
  }).lean();

  if (duplicate) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ya existe una obra social con ese nombre",
      409,
      { nombre: "Ya existe una obra social con ese nombre" },
    );
  }

  obraSocial.nombre = nombre;
  obraSocial.nombreNormalizado = nombreNormalizado;
  obraSocial.cantidadPrestacionesMes = input.cantidadPrestacionesMes;
  await obraSocial.save();

  return toDto(obraSocial.toObject());
}

export async function setObraSocialStatus(id: string, activo: boolean) {
  await connectToDatabase();

  const obraSocial = await ObraSocialModel.findById(id);

  if (!obraSocial) {
    throw new AppError("NOT_FOUND", "Obra social no encontrada", 404);
  }

  obraSocial.activo = activo;
  await obraSocial.save();

  return toDto(obraSocial.toObject());
}
