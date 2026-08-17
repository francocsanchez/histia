"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCodigosObrasSociales = listCodigosObrasSociales;
exports.createCodigoObraSocial = createCodigoObraSocial;
exports.updateCodigoObraSocial = updateCodigoObraSocial;
exports.setCodigoObraSocialStatus = setCodigoObraSocialStatus;
const mongoose_1 = require("mongoose");
const api_1 = require("@/lib/api");
const mongoose_2 = require("@/lib/db/mongoose");
const permissions_1 = require("@/lib/permissions");
const utils_1 = require("@/lib/utils");
const codigo_obra_social_1 = require("@/models/codigo-obra-social");
const obra_social_1 = require("@/models/obra-social");
function toDto(document) {
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
function buildFilter(query, user) {
    const filter = {};
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
        filter.obraSocialId = new mongoose_1.Types.ObjectId(query.obraSocialId);
    }
    if (!(0, permissions_1.can)(user, "codigos-obras-sociales", "write")) {
        filter.activo = true;
    }
    return filter;
}
async function listCodigosObrasSociales(query, user) {
    await (0, mongoose_2.connectToDatabase)();
    const filter = buildFilter(query, user);
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
        codigo_obra_social_1.CodigoObraSocialModel.find(filter)
            .populate("obraSocialId", "nombre")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        codigo_obra_social_1.CodigoObraSocialModel.countDocuments(filter),
    ]);
    return {
        data: items.map((item) => toDto({
            ...item,
            obraSocial: item.obraSocialId,
        })),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    };
}
async function createCodigoObraSocial(input) {
    await (0, mongoose_2.connectToDatabase)();
    const obraSocial = await obra_social_1.ObraSocialModel.findById(input.obraSocialId).lean();
    if (!obraSocial) {
        throw new api_1.AppError("NOT_FOUND", "La obra social no existe", 404);
    }
    if (!obraSocial.activo) {
        throw new api_1.AppError("INACTIVE_RELATED_RECORD", "La obra social debe estar activa", 409);
    }
    const nombre = (0, utils_1.normalizeName)(input.nombre);
    const codigo = (0, utils_1.normalizeCode)(input.codigo);
    const codigoNormalizado = (0, utils_1.normalizeTextKey)(codigo);
    const duplicate = await codigo_obra_social_1.CodigoObraSocialModel.findOne()
        .where("obraSocialId")
        .equals(new mongoose_1.Types.ObjectId(input.obraSocialId))
        .where("codigoNormalizado")
        .equals(codigoNormalizado)
        .lean();
    if (duplicate) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ese codigo ya existe para la obra social seleccionada", 409, { codigo: "Ese codigo ya existe para la obra social seleccionada" });
    }
    const codigoObraSocial = new codigo_obra_social_1.CodigoObraSocialModel();
    codigoObraSocial.nombre = nombre;
    codigoObraSocial.codigo = codigo;
    codigoObraSocial.codigoNormalizado = codigoNormalizado;
    codigoObraSocial.obraSocialId = new mongoose_1.Types.ObjectId(input.obraSocialId);
    codigoObraSocial.valorCentavos = input.valorCentavos;
    codigoObraSocial.activo = true;
    await codigoObraSocial.save();
    await codigoObraSocial.populate("obraSocialId", "nombre");
    return toDto({
        ...codigoObraSocial.toObject(),
        obraSocial: codigoObraSocial.obraSocialId,
    });
}
async function updateCodigoObraSocial(id, input) {
    await (0, mongoose_2.connectToDatabase)();
    const codigoObraSocial = await codigo_obra_social_1.CodigoObraSocialModel.findById(id);
    if (!codigoObraSocial) {
        throw new api_1.AppError("NOT_FOUND", "Codigo no encontrado", 404);
    }
    const obraSocial = await obra_social_1.ObraSocialModel.findById(input.obraSocialId).lean();
    if (!obraSocial) {
        throw new api_1.AppError("NOT_FOUND", "La obra social no existe", 404);
    }
    if (!obraSocial.activo) {
        throw new api_1.AppError("INACTIVE_RELATED_RECORD", "La obra social debe estar activa", 409);
    }
    const codigo = (0, utils_1.normalizeCode)(input.codigo);
    const codigoNormalizado = (0, utils_1.normalizeTextKey)(codigo);
    const duplicate = await codigo_obra_social_1.CodigoObraSocialModel.findOne()
        .where("obraSocialId")
        .equals(new mongoose_1.Types.ObjectId(input.obraSocialId))
        .where("codigoNormalizado")
        .equals(codigoNormalizado)
        .where("_id")
        .ne(id)
        .lean();
    if (duplicate) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ese codigo ya existe para la obra social seleccionada", 409, { codigo: "Ese codigo ya existe para la obra social seleccionada" });
    }
    codigoObraSocial.nombre = (0, utils_1.normalizeName)(input.nombre);
    codigoObraSocial.codigo = codigo;
    codigoObraSocial.codigoNormalizado = codigoNormalizado;
    codigoObraSocial.obraSocialId = new mongoose_1.Types.ObjectId(input.obraSocialId);
    codigoObraSocial.valorCentavos = input.valorCentavos;
    await codigoObraSocial.save();
    await codigoObraSocial.populate("obraSocialId", "nombre");
    return toDto({
        ...codigoObraSocial.toObject(),
        obraSocial: codigoObraSocial.obraSocialId,
    });
}
async function setCodigoObraSocialStatus(id, activo) {
    await (0, mongoose_2.connectToDatabase)();
    const codigo = await codigo_obra_social_1.CodigoObraSocialModel.findById(id);
    if (!codigo) {
        throw new api_1.AppError("NOT_FOUND", "Codigo no encontrado", 404);
    }
    codigo.activo = activo;
    await codigo.save();
    await codigo.populate("obraSocialId", "nombre");
    return toDto({
        ...codigo.toObject(),
        obraSocial: codigo.obraSocialId,
    });
}
