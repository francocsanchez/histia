"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDefaultMovementTypes = ensureDefaultMovementTypes;
exports.listMovementTypes = listMovementTypes;
exports.listActiveMovementTypes = listActiveMovementTypes;
exports.createMovementType = createMovementType;
exports.updateMovementType = updateMovementType;
exports.setMovementTypeStatus = setMovementTypeStatus;
exports.getMovementTypeById = getMovementTypeById;
exports.getSystemMovementType = getSystemMovementType;
const api_1 = require("@/lib/api");
const mongoose_1 = require("@/lib/db/mongoose");
const permissions_1 = require("@/lib/permissions");
const utils_1 = require("@/lib/utils");
const movement_type_1 = require("@/models/movement-type");
const defaultMovementTypes = [
    {
        systemKey: "payment-honorarios",
        nombre: "Pago honorarios",
        direccion: "egreso",
    },
    {
        systemKey: "other-income",
        nombre: "Otro ingreso",
        direccion: "ingreso",
    },
    {
        systemKey: "other-expense",
        nombre: "Otro egreso",
        direccion: "egreso",
    },
    {
        systemKey: "mercadopago-income",
        nombre: "Mercado Pago ingreso",
        direccion: "ingreso",
    },
    {
        systemKey: "mercadopago-expense",
        nombre: "Mercado Pago egreso",
        direccion: "egreso",
    },
    {
        systemKey: "mercadopago-tax-income",
        nombre: "Impuestos Mercado Pago ingreso",
        direccion: "ingreso",
    },
    {
        systemKey: "mercadopago-tax-expense",
        nombre: "Impuestos Mercado Pago egreso",
        direccion: "egreso",
    },
    {
        systemKey: "mercadopago-fee-income",
        nombre: "Comision Mercado Pago ingreso",
        direccion: "ingreso",
    },
    {
        systemKey: "mercadopago-fee-expense",
        nombre: "Comision Mercado Pago egreso",
        direccion: "egreso",
    },
];
let movementTypeIndexesPromise = null;
function toDto(document) {
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
async function ensureDefaultMovementTypes() {
    await (0, mongoose_1.connectToDatabase)();
    await ensureMovementTypeIndexes();
    await Promise.all(defaultMovementTypes.map(async (item) => {
        const nombre = (0, utils_1.normalizeName)(item.nombre);
        const nombreNormalizado = (0, utils_1.normalizeTextKey)(nombre);
        await movement_type_1.MovementTypeModel.updateOne({ systemKey: item.systemKey }, {
            $set: {
                nombre,
                nombreNormalizado,
                direccion: item.direccion,
                activo: true,
                systemKey: item.systemKey,
            },
        }, { upsert: true });
    }));
}
async function ensureMovementTypeIndexes() {
    if (!movementTypeIndexesPromise) {
        movementTypeIndexesPromise = movement_type_1.MovementTypeModel.syncIndexes().then(() => undefined);
    }
    await movementTypeIndexesPromise;
}
function buildFilter(query, user) {
    const filter = {};
    if (query.search) {
        filter.nombre = { $regex: query.search, $options: "i" };
    }
    if (query.status === "active") {
        filter.activo = true;
    }
    if (query.status === "inactive") {
        filter.activo = false;
    }
    if (!(0, permissions_1.can)(user, "tipos-movimientos", "write")) {
        filter.activo = true;
    }
    return filter;
}
async function listMovementTypes(query, user) {
    await ensureDefaultMovementTypes();
    const filter = buildFilter(query, user);
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
        movement_type_1.MovementTypeModel.find(filter)
            .sort({ direccion: 1, nombre: 1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        movement_type_1.MovementTypeModel.countDocuments(filter),
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
async function listActiveMovementTypes(direction) {
    await ensureDefaultMovementTypes();
    const filter = { activo: true };
    if (direction) {
        filter.direccion = direction;
    }
    const items = await movement_type_1.MovementTypeModel.find(filter).sort({ nombre: 1 }).lean();
    return items.map((item) => toDto(item));
}
async function createMovementType(input) {
    await ensureDefaultMovementTypes();
    const nombre = (0, utils_1.normalizeName)(input.nombre);
    const nombreNormalizado = (0, utils_1.normalizeTextKey)(nombre);
    const duplicate = await movement_type_1.MovementTypeModel.findOne({
        nombreNormalizado,
        direccion: input.direccion,
    }).lean();
    if (duplicate) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ya existe un tipo de movimiento con ese nombre para la misma direccion", 409, { nombre: "Ya existe un tipo de movimiento con ese nombre para la misma direccion" });
    }
    const movementType = await movement_type_1.MovementTypeModel.create({
        nombre,
        nombreNormalizado,
        direccion: input.direccion,
        activo: true,
        systemKey: null,
    });
    return toDto(movementType.toObject());
}
async function updateMovementType(id, input) {
    await ensureDefaultMovementTypes();
    const movementType = await movement_type_1.MovementTypeModel.findById(id);
    if (!movementType) {
        throw new api_1.AppError("NOT_FOUND", "Tipo de movimiento no encontrado", 404);
    }
    if (movementType.systemKey && movementType.direccion !== input.direccion) {
        throw new api_1.AppError("VALIDATION_ERROR", "Los tipos de sistema no pueden cambiar de direccion", 409, { direccion: "Los tipos de sistema no pueden cambiar de direccion" });
    }
    const nombre = (0, utils_1.normalizeName)(input.nombre);
    const nombreNormalizado = (0, utils_1.normalizeTextKey)(nombre);
    const duplicate = await movement_type_1.MovementTypeModel.findOne({
        nombreNormalizado,
        direccion: input.direccion,
        _id: { $ne: movementType._id },
    }).lean();
    if (duplicate) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ya existe un tipo de movimiento con ese nombre para la misma direccion", 409, { nombre: "Ya existe un tipo de movimiento con ese nombre para la misma direccion" });
    }
    movementType.nombre = nombre;
    movementType.nombreNormalizado = nombreNormalizado;
    movementType.direccion = input.direccion;
    await movementType.save();
    return toDto(movementType.toObject());
}
async function setMovementTypeStatus(id, activo) {
    await ensureDefaultMovementTypes();
    const movementType = await movement_type_1.MovementTypeModel.findById(id);
    if (!movementType) {
        throw new api_1.AppError("NOT_FOUND", "Tipo de movimiento no encontrado", 404);
    }
    if (movementType.systemKey && !activo) {
        throw new api_1.AppError("VALIDATION_ERROR", "Los tipos de sistema no pueden desactivarse", 409);
    }
    movementType.activo = activo;
    await movementType.save();
    return toDto(movementType.toObject());
}
async function getMovementTypeById(id, options) {
    await ensureDefaultMovementTypes();
    const movementType = await movement_type_1.MovementTypeModel.findById(id).lean();
    if (!movementType) {
        throw new api_1.AppError("NOT_FOUND", "Tipo de movimiento no encontrado", 404);
    }
    if (options?.requireActive && !movementType.activo) {
        throw new api_1.AppError("INACTIVE_RELATED_RECORD", "El tipo de movimiento debe estar activo", 409, { movementTypeId: "El tipo de movimiento debe estar activo" });
    }
    return toDto(movementType);
}
async function getSystemMovementType(systemKey) {
    await ensureDefaultMovementTypes();
    const movementType = await movement_type_1.MovementTypeModel.findOne({ systemKey, activo: true }).lean();
    if (!movementType) {
        throw new api_1.AppError("NOT_FOUND", "No se encontro el tipo de movimiento de sistema requerido", 404);
    }
    return toDto(movementType);
}
