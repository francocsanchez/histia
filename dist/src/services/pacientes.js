"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPacientes = listPacientes;
exports.createPaciente = createPaciente;
exports.updatePaciente = updatePaciente;
exports.setPacienteStatus = setPacienteStatus;
const mongoose_1 = require("mongoose");
const api_1 = require("@/lib/api");
const mongoose_2 = require("@/lib/db/mongoose");
const permissions_1 = require("@/lib/permissions");
const utils_1 = require("@/lib/utils");
const obra_social_1 = require("@/models/obra-social");
const paciente_1 = require("@/models/paciente");
function normalizePacienteName(value) {
    return (0, utils_1.normalizeName)(value).toLocaleLowerCase("es-AR");
}
function extractObraSocialId(value) {
    if (!value) {
        return null;
    }
    if (value instanceof mongoose_1.Types.ObjectId) {
        return value.toString();
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "object" && "_id" in value) {
        const nestedId = value._id;
        if (nestedId instanceof mongoose_1.Types.ObjectId) {
            return nestedId.toString();
        }
        if (typeof nestedId === "string") {
            return nestedId;
        }
    }
    return String(value);
}
function toDto(document) {
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
function buildFilter(query, user) {
    const filter = {};
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
        filter.obraSocialId = new mongoose_1.Types.ObjectId(query.obraSocialId);
    }
    if (!(0, permissions_1.can)(user, "pacientes", "write")) {
        filter.activo = true;
    }
    return filter;
}
async function listPacientes(query, user) {
    await (0, mongoose_2.connectToDatabase)();
    const filter = buildFilter(query, user);
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
        paciente_1.PacienteModel.find(filter)
            .populate("obraSocialId", "nombre")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        paciente_1.PacienteModel.countDocuments(filter),
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
async function createPaciente(input) {
    await (0, mongoose_2.connectToDatabase)();
    const dni = (0, utils_1.normalizeDni)(input.dni);
    const duplicate = await paciente_1.PacienteModel.findOne({ dni }).lean();
    if (duplicate) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ya existe un paciente con ese DNI", 409, { dni: "Ya existe un paciente con ese DNI" });
    }
    let obraSocialId = null;
    if (input.obraSocialId) {
        const obraSocial = await obra_social_1.ObraSocialModel.findById(input.obraSocialId).lean();
        if (!obraSocial) {
            throw new api_1.AppError("NOT_FOUND", "La obra social no existe", 404);
        }
        if (!obraSocial.activo) {
            throw new api_1.AppError("INACTIVE_RELATED_RECORD", "La obra social debe estar activa", 409);
        }
        obraSocialId = input.obraSocialId;
    }
    const paciente = await paciente_1.PacienteModel.create({
        nombre: normalizePacienteName(input.nombre),
        apellido: normalizePacienteName(input.apellido),
        dni,
        obraSocialId,
        activo: true,
    });
    await paciente.populate("obraSocialId", "nombre");
    return toDto({
        ...paciente.toObject(),
        obraSocial: paciente.obraSocialId,
    });
}
async function updatePaciente(id, input) {
    await (0, mongoose_2.connectToDatabase)();
    const paciente = await paciente_1.PacienteModel.findById(id);
    if (!paciente) {
        throw new api_1.AppError("NOT_FOUND", "Paciente no encontrado", 404);
    }
    const dni = (0, utils_1.normalizeDni)(input.dni);
    const duplicate = await paciente_1.PacienteModel.findOne({ dni, _id: { $ne: id } }).lean();
    if (duplicate) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ya existe un paciente con ese DNI", 409, { dni: "Ya existe un paciente con ese DNI" });
    }
    let obraSocialId = null;
    if (input.obraSocialId) {
        const obraSocial = await obra_social_1.ObraSocialModel.findById(input.obraSocialId).lean();
        if (!obraSocial) {
            throw new api_1.AppError("NOT_FOUND", "La obra social no existe", 404);
        }
        const keepsCurrentInactiveObraSocial = !obraSocial.activo &&
            paciente.obraSocialId &&
            String(paciente.obraSocialId) === input.obraSocialId;
        if (!obraSocial.activo && !keepsCurrentInactiveObraSocial) {
            throw new api_1.AppError("INACTIVE_RELATED_RECORD", "La obra social debe estar activa", 409);
        }
        obraSocialId = new mongoose_1.Types.ObjectId(input.obraSocialId);
    }
    paciente.nombre = normalizePacienteName(input.nombre);
    paciente.apellido = normalizePacienteName(input.apellido);
    paciente.dni = dni;
    paciente.obraSocialId = obraSocialId;
    await paciente.save();
    await paciente.populate("obraSocialId", "nombre");
    return toDto({
        ...paciente.toObject(),
        obraSocial: paciente.obraSocialId,
    });
}
async function setPacienteStatus(id, activo) {
    await (0, mongoose_2.connectToDatabase)();
    const paciente = await paciente_1.PacienteModel.findById(id);
    if (!paciente) {
        throw new api_1.AppError("NOT_FOUND", "Paciente no encontrado", 404);
    }
    paciente.activo = activo;
    await paciente.save();
    await paciente.populate("obraSocialId", "nombre");
    return toDto({
        ...paciente.toObject(),
        obraSocial: paciente.obraSocialId,
    });
}
