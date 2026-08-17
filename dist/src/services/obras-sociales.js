"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listObrasSociales = listObrasSociales;
exports.listActiveObrasSociales = listActiveObrasSociales;
exports.createObraSocial = createObraSocial;
exports.updateObraSocial = updateObraSocial;
exports.setObraSocialStatus = setObraSocialStatus;
const api_1 = require("@/lib/api");
const mongoose_1 = require("@/lib/db/mongoose");
const permissions_1 = require("@/lib/permissions");
const utils_1 = require("@/lib/utils");
const obra_social_1 = require("@/models/obra-social");
function toDto(document) {
    return {
        id: document._id.toString(),
        nombre: document.nombre,
        cantidadPrestacionesMes: document.cantidadPrestacionesMes,
        activo: document.activo,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
    };
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
    if (!(0, permissions_1.can)(user, "obras-sociales", "write")) {
        filter.activo = true;
    }
    return filter;
}
async function listObrasSociales(query, user) {
    await (0, mongoose_1.connectToDatabase)();
    const filter = buildFilter(query, user);
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
        obra_social_1.ObraSocialModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        obra_social_1.ObraSocialModel.countDocuments(filter),
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
async function listActiveObrasSociales() {
    await (0, mongoose_1.connectToDatabase)();
    const items = await obra_social_1.ObraSocialModel.find({ activo: true })
        .sort({ nombre: 1 })
        .lean();
    return items.map((item) => toDto(item));
}
async function createObraSocial(input) {
    await (0, mongoose_1.connectToDatabase)();
    const nombre = (0, utils_1.normalizeName)(input.nombre);
    const nombreNormalizado = (0, utils_1.normalizeTextKey)(nombre);
    const existing = await obra_social_1.ObraSocialModel.findOne({ nombreNormalizado }).lean();
    if (existing) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ya existe una obra social con ese nombre", 409, { nombre: "Ya existe una obra social con ese nombre" });
    }
    const obraSocial = await obra_social_1.ObraSocialModel.create({
        nombre,
        nombreNormalizado,
        cantidadPrestacionesMes: input.cantidadPrestacionesMes,
        activo: true,
    });
    return toDto(obraSocial.toObject());
}
async function updateObraSocial(id, input) {
    await (0, mongoose_1.connectToDatabase)();
    const obraSocial = await obra_social_1.ObraSocialModel.findById(id);
    if (!obraSocial) {
        throw new api_1.AppError("NOT_FOUND", "Obra social no encontrada", 404);
    }
    const nombre = (0, utils_1.normalizeName)(input.nombre);
    const nombreNormalizado = (0, utils_1.normalizeTextKey)(nombre);
    const duplicate = await obra_social_1.ObraSocialModel.findOne({
        nombreNormalizado,
        _id: { $ne: obraSocial._id },
    }).lean();
    if (duplicate) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ya existe una obra social con ese nombre", 409, { nombre: "Ya existe una obra social con ese nombre" });
    }
    obraSocial.nombre = nombre;
    obraSocial.nombreNormalizado = nombreNormalizado;
    obraSocial.cantidadPrestacionesMes = input.cantidadPrestacionesMes;
    await obraSocial.save();
    return toDto(obraSocial.toObject());
}
async function setObraSocialStatus(id, activo) {
    await (0, mongoose_1.connectToDatabase)();
    const obraSocial = await obra_social_1.ObraSocialModel.findById(id);
    if (!obraSocial) {
        throw new api_1.AppError("NOT_FOUND", "Obra social no encontrada", 404);
    }
    obraSocial.activo = activo;
    await obraSocial.save();
    return toDto(obraSocial.toObject());
}
