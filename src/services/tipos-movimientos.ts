import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { can } from "@/lib/permissions";
import { normalizeName, normalizeTextKey } from "@/lib/utils";
import {
  MovementTypeDocument,
  MovementTypeModel,
} from "@/models/movement-type";
import {
  MovementDirection,
  MovementTypeCreateDto,
  MovementTypeDto,
  QueryParams,
  SessionUser,
} from "@/types/domain";

const defaultMovementTypes = [
  {
    systemKey: "payment-honorarios",
    nombre: "Pago honorarios",
    direccion: "egreso" as const,
  },
  {
    systemKey: "other-income",
    nombre: "Otro ingreso",
    direccion: "ingreso" as const,
  },
  {
    systemKey: "other-expense",
    nombre: "Otro egreso",
    direccion: "egreso" as const,
  },
  {
    systemKey: "mercadopago-income",
    nombre: "Mercado Pago ingreso",
    direccion: "ingreso" as const,
  },
  {
    systemKey: "mercadopago-expense",
    nombre: "Mercado Pago egreso",
    direccion: "egreso" as const,
  },
  {
    systemKey: "mercadopago-tax-income",
    nombre: "Impuestos Mercado Pago ingreso",
    direccion: "ingreso" as const,
  },
  {
    systemKey: "mercadopago-tax-expense",
    nombre: "Impuestos Mercado Pago egreso",
    direccion: "egreso" as const,
  },
  {
    systemKey: "mercadopago-fee-income",
    nombre: "Comision Mercado Pago ingreso",
    direccion: "ingreso" as const,
  },
  {
    systemKey: "mercadopago-fee-expense",
    nombre: "Comision Mercado Pago egreso",
    direccion: "egreso" as const,
  },
];

function toDto(document: MovementTypeDocument): MovementTypeDto {
  return {
    id: document._id.toString(),
    nombre: document.nombre,
    direccion: document.direccion,
    activo: document.activo,
    systemKey: document.systemKey,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

export async function ensureDefaultMovementTypes() {
  await connectToDatabase();

  await Promise.all(
    defaultMovementTypes.map(async (item) => {
      const nombre = normalizeName(item.nombre);
      const nombreNormalizado = normalizeTextKey(nombre);

      await MovementTypeModel.updateOne(
        { systemKey: item.systemKey },
        {
          $set: {
            nombre,
            nombreNormalizado,
            direccion: item.direccion,
            activo: true,
            systemKey: item.systemKey,
          },
        },
        { upsert: true },
      );
    }),
  );
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

  if (!can(user, "tipos-movimientos", "write")) {
    filter.activo = true;
  }

  return filter;
}

export async function listMovementTypes(query: QueryParams, user: SessionUser) {
  await ensureDefaultMovementTypes();

  const filter = buildFilter(query, user);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    MovementTypeModel.find(filter)
      .sort({ direccion: 1, nombre: 1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    MovementTypeModel.countDocuments(filter),
  ]);

  return {
    data: items.map((item) => toDto(item as unknown as MovementTypeDocument)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function listActiveMovementTypes(direction?: MovementDirection) {
  await ensureDefaultMovementTypes();

  const filter: Record<string, unknown> = { activo: true };

  if (direction) {
    filter.direccion = direction;
  }

  const items = await MovementTypeModel.find(filter).sort({ nombre: 1 }).lean();
  return items.map((item) => toDto(item as unknown as MovementTypeDocument));
}

export async function createMovementType(input: MovementTypeCreateDto) {
  await ensureDefaultMovementTypes();

  const nombre = normalizeName(input.nombre);
  const nombreNormalizado = normalizeTextKey(nombre);
  const duplicate = await MovementTypeModel.findOne({ nombreNormalizado }).lean();

  if (duplicate) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ya existe un tipo de movimiento con ese nombre",
      409,
      { nombre: "Ya existe un tipo de movimiento con ese nombre" },
    );
  }

  const movementType = await MovementTypeModel.create({
    nombre,
    nombreNormalizado,
    direccion: input.direccion,
    activo: true,
    systemKey: null,
  });

  return toDto(movementType.toObject());
}

export async function updateMovementType(id: string, input: MovementTypeCreateDto) {
  await ensureDefaultMovementTypes();

  const movementType = await MovementTypeModel.findById(id);

  if (!movementType) {
    throw new AppError("NOT_FOUND", "Tipo de movimiento no encontrado", 404);
  }

  if (movementType.systemKey && movementType.direccion !== input.direccion) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Los tipos de sistema no pueden cambiar de direccion",
      409,
      { direccion: "Los tipos de sistema no pueden cambiar de direccion" },
    );
  }

  const nombre = normalizeName(input.nombre);
  const nombreNormalizado = normalizeTextKey(nombre);
  const duplicate = await MovementTypeModel.findOne({
    nombreNormalizado,
    _id: { $ne: movementType._id },
  }).lean();

  if (duplicate) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ya existe un tipo de movimiento con ese nombre",
      409,
      { nombre: "Ya existe un tipo de movimiento con ese nombre" },
    );
  }

  movementType.nombre = nombre;
  movementType.nombreNormalizado = nombreNormalizado;
  movementType.direccion = input.direccion;
  await movementType.save();

  return toDto(movementType.toObject());
}

export async function setMovementTypeStatus(id: string, activo: boolean) {
  await ensureDefaultMovementTypes();

  const movementType = await MovementTypeModel.findById(id);

  if (!movementType) {
    throw new AppError("NOT_FOUND", "Tipo de movimiento no encontrado", 404);
  }

  if (movementType.systemKey && !activo) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Los tipos de sistema no pueden desactivarse",
      409,
    );
  }

  movementType.activo = activo;
  await movementType.save();

  return toDto(movementType.toObject());
}

export async function getMovementTypeById(id: string, options?: { requireActive?: boolean }) {
  await ensureDefaultMovementTypes();

  const movementType = await MovementTypeModel.findById(id).lean();

  if (!movementType) {
    throw new AppError("NOT_FOUND", "Tipo de movimiento no encontrado", 404);
  }

  if (options?.requireActive && !movementType.activo) {
    throw new AppError(
      "INACTIVE_RELATED_RECORD",
      "El tipo de movimiento debe estar activo",
      409,
      { movementTypeId: "El tipo de movimiento debe estar activo" },
    );
  }

  return toDto(movementType as unknown as MovementTypeDocument);
}

export async function getSystemMovementType(systemKey: string) {
  await ensureDefaultMovementTypes();

  const movementType = await MovementTypeModel.findOne({ systemKey, activo: true }).lean();

  if (!movementType) {
    throw new AppError(
      "NOT_FOUND",
      "No se encontro el tipo de movimiento de sistema requerido",
      404,
    );
  }

  return toDto(movementType as unknown as MovementTypeDocument);
}
