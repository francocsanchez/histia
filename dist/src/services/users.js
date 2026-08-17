"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.setUserStatus = setUserStatus;
exports.setUserPassword = setUserPassword;
exports.seedAdminUser = seedAdminUser;
const headers_1 = require("next/headers");
const api_1 = require("@/lib/api");
const auth_1 = require("@/lib/auth");
const mongoose_1 = require("@/lib/db/mongoose");
const env_1 = require("@/lib/env");
const utils_1 = require("@/lib/utils");
const user_1 = require("@/models/user");
function toDto(document) {
    return {
        id: document._id.toString(),
        nombre: document.name,
        apellido: document.apellido ?? "",
        email: document.email,
        roles: (0, utils_1.splitRoles)(document.roles),
        activo: document.activo ?? true,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
    };
}
function rolesRegex(role) {
    return new RegExp(`(^|,)${role}(,|$)`);
}
function buildFilter(query) {
    const filter = {};
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
async function countActiveAdmins(excludeUserId) {
    return user_1.UserModel.countDocuments({
        activo: true,
        roles: { $regex: rolesRegex("administrador") },
        ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
    });
}
async function listUsers(query) {
    await (0, mongoose_1.connectToDatabase)();
    const filter = buildFilter(query);
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
        user_1.UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
        user_1.UserModel.countDocuments(filter),
    ]);
    return {
        data: items.map((item) => toDto(item)),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    };
}
async function createUser(input) {
    await (0, mongoose_1.connectToDatabase)();
    const email = (0, utils_1.normalizeEmail)(input.email);
    const existing = await user_1.UserModel.findOne({ email }).lean();
    if (existing) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ya existe un usuario con ese email", 409, { email: "Ya existe un usuario con ese email" });
    }
    const currentHeaders = await (0, headers_1.headers)();
    const response = await (0, auth_1.getAuth)().api.createUser({
        headers: currentHeaders,
        body: {
            email,
            password: input.password,
            name: (0, utils_1.normalizeName)(input.nombre),
            role: input.roles.includes("administrador") ? "admin" : "user",
            data: {
                apellido: (0, utils_1.normalizeName)(input.apellido),
                activo: true,
                roles: (0, utils_1.joinRoles)(input.roles),
            },
        },
    });
    const user = await user_1.UserModel.findById(response.user.id);
    if (!user) {
        throw new api_1.AppError("INTERNAL_ERROR", "No se pudo crear el usuario", 500);
    }
    user.apellido = (0, utils_1.normalizeName)(input.apellido);
    user.roles = (0, utils_1.joinRoles)(input.roles);
    user.activo = true;
    user.role = input.roles.includes("administrador") ? "admin" : "user";
    await user.save();
    return toDto(user.toObject());
}
async function updateUser(id, input) {
    await (0, mongoose_1.connectToDatabase)();
    const user = await user_1.UserModel.findById(id);
    if (!user) {
        throw new api_1.AppError("NOT_FOUND", "Usuario no encontrado", 404);
    }
    const email = (0, utils_1.normalizeEmail)(input.email);
    const duplicate = await user_1.UserModel.findOne({ email, _id: { $ne: id } }).lean();
    if (duplicate) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ya existe un usuario con ese email", 409, { email: "Ya existe un usuario con ese email" });
    }
    const willStayAdmin = input.roles.includes("administrador") && input.activo;
    if (!willStayAdmin && (0, utils_1.splitRoles)(user.roles).includes("administrador")) {
        const adminsRemaining = await countActiveAdmins(id);
        if (adminsRemaining < 1) {
            throw new api_1.AppError("VALIDATION_ERROR", "No se puede quitar o desactivar al ultimo administrador activo", 400);
        }
    }
    user.name = (0, utils_1.normalizeName)(input.nombre);
    user.apellido = (0, utils_1.normalizeName)(input.apellido);
    user.email = email;
    user.roles = (0, utils_1.joinRoles)(input.roles);
    user.activo = input.activo;
    user.role = input.roles.includes("administrador") ? "admin" : "user";
    await user.save();
    return toDto(user.toObject());
}
async function setUserStatus(id, activo) {
    await (0, mongoose_1.connectToDatabase)();
    const user = await user_1.UserModel.findById(id);
    if (!user) {
        throw new api_1.AppError("NOT_FOUND", "Usuario no encontrado", 404);
    }
    if (!activo && (0, utils_1.splitRoles)(user.roles).includes("administrador")) {
        const adminsRemaining = await countActiveAdmins(id);
        if (adminsRemaining < 1) {
            throw new api_1.AppError("VALIDATION_ERROR", "No se puede desactivar al ultimo administrador activo", 400);
        }
    }
    user.activo = activo;
    await user.save();
    return toDto(user.toObject());
}
async function setUserPassword(userId, password) {
    const currentHeaders = await (0, headers_1.headers)();
    const auth = (0, auth_1.getAuth)();
    await auth.api.setUserPassword({
        headers: currentHeaders,
        body: {
            userId,
            newPassword: password,
        },
    });
    return { status: true };
}
async function seedAdminUser() {
    await (0, mongoose_1.connectToDatabase)();
    const env = (0, env_1.getServerEnv)();
    const auth = (0, auth_1.getAuth)();
    const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME, SEED_ADMIN_LAST_NAME, } = env;
    if (!SEED_ADMIN_EMAIL ||
        !SEED_ADMIN_PASSWORD ||
        !SEED_ADMIN_NAME ||
        !SEED_ADMIN_LAST_NAME) {
        throw new Error("Faltan variables SEED_ADMIN_* para crear el administrador inicial");
    }
    const email = (0, utils_1.normalizeEmail)(SEED_ADMIN_EMAIL);
    let user = await user_1.UserModel.findOne({ email });
    if (!user) {
        await auth.api.signUpEmail({
            headers: new Headers({
                "x-histia-internal-secret": env.BETTER_AUTH_SECRET,
            }),
            body: {
                email,
                password: SEED_ADMIN_PASSWORD,
                name: (0, utils_1.normalizeName)(SEED_ADMIN_NAME),
            },
        });
        user = await user_1.UserModel.findOne({ email });
    }
    if (!user) {
        throw new Error("No se pudo crear el administrador inicial");
    }
    user.name = (0, utils_1.normalizeName)(SEED_ADMIN_NAME);
    user.apellido = (0, utils_1.normalizeName)(SEED_ADMIN_LAST_NAME);
    user.activo = true;
    user.roles = (0, utils_1.joinRoles)(["administrador"]);
    user.role = "admin";
    await user.save();
    return toDto(user.toObject());
}
