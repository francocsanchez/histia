import { headers } from "next/headers";

import { AppError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongoose";
import { env } from "@/lib/env";
import { joinRoles, normalizeEmail, normalizeName, splitRoles } from "@/lib/utils";
import { UserDocument, UserModel } from "@/models/user";
import { QueryParams, UserDto, UserRole } from "@/types/domain";

function toDto(document: UserDocument): UserDto {
  return {
    id: document._id.toString(),
    nombre: document.name,
    apellido: document.apellido ?? "",
    email: document.email,
    roles: splitRoles(document.roles),
    activo: document.activo ?? true,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function rolesRegex(role: UserRole) {
  return new RegExp(`(^|,)${role}(,|$)`);
}

function buildFilter(query: QueryParams): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: "i" } },
      { apellido: { $regex: query.search, $options: "i" } },
      { email: { $regex: query.search, $options: "i" } },
    ];
  }

  if (query.status === "active") {
    filter.activo = true;
  }

  if (query.status === "inactive") {
    filter.activo = false;
  }

  if (query.role) {
    filter.roles = { $regex: rolesRegex(query.role) };
  }

  return filter;
}

async function countActiveAdmins(excludeUserId?: string) {
  return UserModel.countDocuments({
    activo: true,
    roles: { $regex: rolesRegex("administrador") },
    ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
  });
}

export async function listUsers(query: QueryParams) {
  await connectToDatabase();

  const filter = buildFilter(query);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
    UserModel.countDocuments(filter),
  ]);

  return {
    data: items.map((item) => toDto(item as unknown as UserDocument)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function createUser(input: {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  roles: UserRole[];
}) {
  await connectToDatabase();

  const email = normalizeEmail(input.email);
  const existing = await UserModel.findOne({ email }).lean();

  if (existing) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ya existe un usuario con ese email",
      409,
      { email: "Ya existe un usuario con ese email" },
    );
  }

  const currentHeaders = await headers();
  const response = await auth.api.createUser({
    headers: currentHeaders,
    body: {
      email,
      password: input.password,
      name: normalizeName(input.nombre),
      role: input.roles.includes("administrador") ? "admin" : "user",
      data: {
        apellido: normalizeName(input.apellido),
        activo: true,
        roles: joinRoles(input.roles),
      },
    },
  });

  const user = await UserModel.findById(response.user.id);

  if (!user) {
    throw new AppError("INTERNAL_ERROR", "No se pudo crear el usuario", 500);
  }

  user.apellido = normalizeName(input.apellido);
  user.roles = joinRoles(input.roles);
  user.activo = true;
  user.role = input.roles.includes("administrador") ? "admin" : "user";
  await user.save();

  return toDto(user.toObject());
}

export async function updateUser(
  id: string,
  input: {
    nombre: string;
    apellido: string;
    email: string;
    roles: UserRole[];
    activo: boolean;
  },
) {
  await connectToDatabase();

  const user = await UserModel.findById(id);

  if (!user) {
    throw new AppError("NOT_FOUND", "Usuario no encontrado", 404);
  }

  const email = normalizeEmail(input.email);
  const duplicate = await UserModel.findOne({ email, _id: { $ne: id } }).lean();

  if (duplicate) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ya existe un usuario con ese email",
      409,
      { email: "Ya existe un usuario con ese email" },
    );
  }

  const willStayAdmin = input.roles.includes("administrador") && input.activo;

  if (!willStayAdmin && splitRoles(user.roles).includes("administrador")) {
    const adminsRemaining = await countActiveAdmins(id);

    if (adminsRemaining < 1) {
      throw new AppError(
        "VALIDATION_ERROR",
        "No se puede quitar o desactivar al ultimo administrador activo",
        400,
      );
    }
  }

  user.name = normalizeName(input.nombre);
  user.apellido = normalizeName(input.apellido);
  user.email = email;
  user.roles = joinRoles(input.roles);
  user.activo = input.activo;
  user.role = input.roles.includes("administrador") ? "admin" : "user";
  await user.save();

  return toDto(user.toObject());
}

export async function setUserStatus(id: string, activo: boolean) {
  await connectToDatabase();

  const user = await UserModel.findById(id);

  if (!user) {
    throw new AppError("NOT_FOUND", "Usuario no encontrado", 404);
  }

  if (!activo && splitRoles(user.roles).includes("administrador")) {
    const adminsRemaining = await countActiveAdmins(id);

    if (adminsRemaining < 1) {
      throw new AppError(
        "VALIDATION_ERROR",
        "No se puede desactivar al ultimo administrador activo",
        400,
      );
    }
  }

  user.activo = activo;
  await user.save();

  return toDto(user.toObject());
}

export async function setUserPassword(userId: string, password: string) {
  const currentHeaders = await headers();

  await auth.api.setUserPassword({
    headers: currentHeaders,
    body: {
      userId,
      newPassword: password,
    },
  });

  return { status: true };
}

export async function seedAdminUser() {
  await connectToDatabase();

  const {
    SEED_ADMIN_EMAIL,
    SEED_ADMIN_PASSWORD,
    SEED_ADMIN_NAME,
    SEED_ADMIN_LAST_NAME,
  } = env;

  if (
    !SEED_ADMIN_EMAIL ||
    !SEED_ADMIN_PASSWORD ||
    !SEED_ADMIN_NAME ||
    !SEED_ADMIN_LAST_NAME
  ) {
    throw new Error(
      "Faltan variables SEED_ADMIN_* para crear el administrador inicial",
    );
  }

  const email = normalizeEmail(SEED_ADMIN_EMAIL);
  let user = await UserModel.findOne({ email });

  if (!user) {
    await auth.api.signUpEmail({
      headers: new Headers({
        "x-histia-internal-secret": env.BETTER_AUTH_SECRET,
      }),
      body: {
        email,
        password: SEED_ADMIN_PASSWORD,
        name: normalizeName(SEED_ADMIN_NAME),
      },
    });

    user = await UserModel.findOne({ email });
  }

  if (!user) {
    throw new Error("No se pudo crear el administrador inicial");
  }

  user.name = normalizeName(SEED_ADMIN_NAME);
  user.apellido = normalizeName(SEED_ADMIN_LAST_NAME);
  user.activo = true;
  user.roles = joinRoles(["administrador"]);
  user.role = "admin";
  await user.save();

  return toDto(user.toObject());
}
