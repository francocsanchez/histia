"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRxAttentions = listRxAttentions;
exports.getRxLookups = getRxLookups;
exports.createRxAttention = createRxAttention;
exports.updateRxAttention = updateRxAttention;
exports.getRxAttentionById = getRxAttentionById;
const mongoose_1 = require("mongoose");
const api_1 = require("@/lib/api");
const mongoose_2 = require("@/lib/db/mongoose");
const utils_1 = require("@/lib/utils");
const obra_social_1 = require("@/models/obra-social");
const paciente_1 = require("@/models/paciente");
const rx_attention_1 = require("@/models/rx-attention");
const user_1 = require("@/models/user");
const pacientes_1 = require("@/services/pacientes");
function odontologoRegex() {
    return /(^|,)odontologo(,|$)/;
}
function toRxDto(document) {
    const pacienteNombre = document.paciente
        ? `${document.paciente.apellido}, ${document.paciente.nombre}`
        : "Paciente sin datos";
    const derivanteNombre = document.derivanteTipo === "interno"
        ? (0, utils_1.normalizeWhitespace)(`${document.derivanteInterno?.apellido ?? ""}, ${document.derivanteInterno?.name ?? ""}`)
        : document.derivanteExternoNombre ?? "";
    const usuarioGeneradorNombre = (0, utils_1.normalizeWhitespace)(`${document.usuarioGenerador?.apellido ?? ""}, ${document.usuarioGenerador?.name ?? ""}`);
    return {
        id: String(document._id),
        fecha: document.fecha.toISOString(),
        pacienteId: String(document.pacienteId),
        pacienteNombreCompleto: pacienteNombre,
        pacienteDni: document.paciente?.dni ?? "",
        pacienteObraSocialNombre: document.obraSocial?.nombre ?? null,
        derivanteTipo: document.derivanteTipo,
        derivanteUserId: document.derivanteUserId ? String(document.derivanteUserId) : null,
        derivanteNombre,
        tipoRx: document.tipoRx,
        valorCentavos: document.valorCentavos,
        usuarioGeneradorId: String(document.usuarioGeneradorId),
        usuarioGeneradorNombre,
        observaciones: document.observaciones,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
    };
}
function buildDateMatch(query) {
    const fecha = {};
    if (query.dateFrom) {
        fecha.$gte = new Date(`${query.dateFrom}T00:00:00.000`);
    }
    if (query.dateTo) {
        fecha.$lte = new Date(`${query.dateTo}T23:59:59.999`);
    }
    return Object.keys(fecha).length > 0 ? fecha : undefined;
}
async function listRxAttentions(query) {
    await (0, mongoose_2.connectToDatabase)();
    const match = {};
    const search = query.search?.trim();
    const dateMatch = buildDateMatch(query);
    if (query.rxType) {
        match.tipoRx = query.rxType;
    }
    if (dateMatch) {
        match.fecha = dateMatch;
    }
    const pipeline = [
        { $match: match },
        {
            $lookup: {
                from: "pacientes",
                localField: "pacienteId",
                foreignField: "_id",
                as: "paciente",
            },
        },
        { $unwind: "$paciente" },
        {
            $lookup: {
                from: "obras_sociales",
                localField: "paciente.obraSocialId",
                foreignField: "_id",
                as: "obraSocial",
            },
        },
        {
            $unwind: {
                path: "$obraSocial",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "derivanteUserId",
                foreignField: "_id",
                as: "derivanteInterno",
            },
        },
        {
            $unwind: {
                path: "$derivanteInterno",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "usuarioGeneradorId",
                foreignField: "_id",
                as: "usuarioGenerador",
            },
        },
        { $unwind: "$usuarioGenerador" },
    ];
    if (search) {
        pipeline.push({
            $match: {
                $or: [
                    { "paciente.dni": { $regex: search, $options: "i" } },
                    { "paciente.nombre": { $regex: search, $options: "i" } },
                    { "paciente.apellido": { $regex: search, $options: "i" } },
                    { derivanteExternoNombre: { $regex: search, $options: "i" } },
                    { "derivanteInterno.name": { $regex: search, $options: "i" } },
                    { "derivanteInterno.apellido": { $regex: search, $options: "i" } },
                ],
            },
        });
    }
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const [rows, totalRows] = await Promise.all([
        rx_attention_1.RxAttentionModel.aggregate([
            ...pipeline,
            { $sort: { fecha: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
        ]),
        rx_attention_1.RxAttentionModel.aggregate([
            ...pipeline,
            { $count: "total" },
        ]),
    ]);
    const total = totalRows[0]?.total ?? 0;
    return {
        data: rows.map((row) => toRxDto(row)),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    };
}
async function getRxLookups(dni) {
    await (0, mongoose_2.connectToDatabase)();
    const odontologos = await user_1.UserModel.find({
        activo: true,
        roles: { $regex: odontologoRegex() },
    })
        .sort({ apellido: 1, name: 1 })
        .lean();
    const result = {
        paciente: null,
        odontologos: odontologos.map((user) => ({
            id: String(user._id),
            label: (0, utils_1.normalizeWhitespace)(`${user.apellido ?? ""}, ${user.name}`),
        })),
        obrasSociales: [],
    };
    result.obrasSociales = (await obra_social_1.ObraSocialModel.find({ activo: true }).sort({ nombre: 1 }).lean()).map((obra) => ({
        id: String(obra._id),
        nombre: obra.nombre,
    }));
    if (dni) {
        const paciente = await paciente_1.PacienteModel.findOne({ dni }).populate("obraSocialId", "nombre").lean();
        if (paciente) {
            result.paciente = {
                id: String(paciente._id),
                nombre: paciente.nombre,
                apellido: paciente.apellido,
                dni: paciente.dni,
                obraSocialId: paciente.obraSocialId ? String(paciente.obraSocialId) : null,
                obraSocialNombre: paciente.obraSocialId?.nombre ?? null,
            };
        }
    }
    return result;
}
async function resolvePaciente(input) {
    if (input.pacienteId) {
        const paciente = await paciente_1.PacienteModel.findById(input.pacienteId).lean();
        if (!paciente) {
            throw new api_1.AppError("NOT_FOUND", "El paciente no existe", 404);
        }
        return paciente;
    }
    if (!input.paciente) {
        throw new api_1.AppError("VALIDATION_ERROR", "Debes indicar un paciente para la RX", 400);
    }
    const existingPaciente = await paciente_1.PacienteModel.findOne({ dni: input.paciente.dni }).lean();
    if (existingPaciente) {
        return existingPaciente;
    }
    const created = await (0, pacientes_1.createPaciente)(input.paciente);
    const createdPaciente = await paciente_1.PacienteModel.findById(created.id).lean();
    if (!createdPaciente) {
        throw new api_1.AppError("INTERNAL_ERROR", "No se pudo crear el paciente", 500);
    }
    return createdPaciente;
}
async function resolveDerivante(input) {
    if (input.derivanteTipo === "interno") {
        if (!input.derivanteUserId) {
            throw new api_1.AppError("VALIDATION_ERROR", "Debes seleccionar un odontologo interno", 400);
        }
        const odontologo = await user_1.UserModel.findById(input.derivanteUserId).lean();
        if (!odontologo) {
            throw new api_1.AppError("NOT_FOUND", "El odontologo no existe", 404);
        }
        if (!odontologo.activo || !odontologo.roles?.match(odontologoRegex())) {
            throw new api_1.AppError("VALIDATION_ERROR", "El derivante interno debe ser un odontologo activo", 400);
        }
        return {
            derivanteUserId: new mongoose_1.Types.ObjectId(input.derivanteUserId),
            derivanteExternoNombre: null,
        };
    }
    const derivanteExternoNombre = (0, utils_1.normalizeName)(input.derivanteExternoNombre ?? "");
    if (!derivanteExternoNombre) {
        throw new api_1.AppError("VALIDATION_ERROR", "Debes indicar el profesional derivante externo", 400);
    }
    return {
        derivanteUserId: null,
        derivanteExternoNombre,
    };
}
async function createRxAttention(input, currentUser) {
    await (0, mongoose_2.connectToDatabase)();
    const paciente = await resolvePaciente({
        pacienteId: input.pacienteId,
        paciente: input.paciente,
    });
    const derivante = await resolveDerivante(input);
    const rx = await rx_attention_1.RxAttentionModel.create({
        fecha: new Date(input.fecha),
        pacienteId: new mongoose_1.Types.ObjectId(String(paciente._id)),
        derivanteTipo: input.derivanteTipo,
        derivanteUserId: derivante.derivanteUserId,
        derivanteExternoNombre: derivante.derivanteExternoNombre,
        tipoRx: input.tipoRx,
        valorCentavos: input.valorCentavos ?? null,
        usuarioGeneradorId: new mongoose_1.Types.ObjectId(currentUser.id),
        observaciones: input.observaciones
            ? (0, utils_1.normalizeWhitespace)(input.observaciones)
            : null,
    });
    return await getRxAttentionById(String(rx._id));
}
async function updateRxAttention(id, input) {
    await (0, mongoose_2.connectToDatabase)();
    const rx = await rx_attention_1.RxAttentionModel.findById(id);
    if (!rx) {
        throw new api_1.AppError("NOT_FOUND", "La atencion RX no existe", 404);
    }
    const paciente = await resolvePaciente({
        pacienteId: input.pacienteId,
        paciente: input.paciente,
    });
    const derivante = await resolveDerivante(input);
    rx.fecha = new Date(input.fecha);
    rx.pacienteId = new mongoose_1.Types.ObjectId(String(paciente._id));
    rx.derivanteTipo = input.derivanteTipo;
    rx.derivanteUserId = derivante.derivanteUserId;
    rx.derivanteExternoNombre = derivante.derivanteExternoNombre;
    rx.tipoRx = input.tipoRx;
    rx.valorCentavos = input.valorCentavos ?? null;
    rx.observaciones = input.observaciones
        ? (0, utils_1.normalizeWhitespace)(input.observaciones)
        : null;
    await rx.save();
    return await getRxAttentionById(id);
}
async function getRxAttentionById(id) {
    await (0, mongoose_2.connectToDatabase)();
    const rows = await rx_attention_1.RxAttentionModel.aggregate([
        {
            $match: {
                _id: new mongoose_1.Types.ObjectId(id),
            },
        },
        {
            $lookup: {
                from: "pacientes",
                localField: "pacienteId",
                foreignField: "_id",
                as: "paciente",
            },
        },
        { $unwind: "$paciente" },
        {
            $lookup: {
                from: "obras_sociales",
                localField: "paciente.obraSocialId",
                foreignField: "_id",
                as: "obraSocial",
            },
        },
        {
            $unwind: {
                path: "$obraSocial",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "derivanteUserId",
                foreignField: "_id",
                as: "derivanteInterno",
            },
        },
        {
            $unwind: {
                path: "$derivanteInterno",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "usuarioGeneradorId",
                foreignField: "_id",
                as: "usuarioGenerador",
            },
        },
        { $unwind: "$usuarioGenerador" },
    ]);
    const row = rows[0];
    if (!row) {
        throw new api_1.AppError("NOT_FOUND", "La atencion RX no existe", 404);
    }
    return toRxDto(row);
}
