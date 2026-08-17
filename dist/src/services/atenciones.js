"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAttentionAssignableUsers = listAttentionAssignableUsers;
exports.listAttentions = listAttentions;
exports.getAttentionById = getAttentionById;
exports.getAttentionLookups = getAttentionLookups;
exports.createAttention = createAttention;
exports.updateAttention = updateAttention;
const mongoose_1 = require("mongoose");
const api_1 = require("@/lib/api");
const mongoose_2 = require("@/lib/db/mongoose");
const utils_1 = require("@/lib/utils");
const attention_1 = require("@/models/attention");
const codigo_obra_social_1 = require("@/models/codigo-obra-social");
const obra_social_1 = require("@/models/obra-social");
const paciente_1 = require("@/models/paciente");
const user_1 = require("@/models/user");
const pacientes_1 = require("@/services/pacientes");
function hasAdministrativeAccess(user) {
    return user.roles.includes("administrador");
}
function isPopulatedPacienteRef(value) {
    return (value !== null &&
        value !== undefined &&
        typeof value === "object" &&
        "nombre" in value &&
        "apellido" in value &&
        "dni" in value);
}
function isPopulatedObraSocialRef(value) {
    return (value !== null &&
        value !== undefined &&
        typeof value === "object" &&
        "nombre" in value);
}
function isPopulatedUserRef(value) {
    return (value !== null &&
        value !== undefined &&
        typeof value === "object" &&
        "name" in value);
}
function getObjectIdString(value) {
    if (!value) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "object" &&
        value !== null &&
        "toHexString" in value &&
        typeof value.toHexString === "function") {
        return value.toHexString();
    }
    if (typeof value === "object" && value !== null) {
        const nestedId = "_id" in value
            ? value._id
            : "id" in value
                ? value.id
                : undefined;
        if (nestedId) {
            return getObjectIdString(nestedId);
        }
    }
    return String(value);
}
function isSameObjectId(left, right) {
    return getObjectIdString(left) === right;
}
function normalizeOptionalText(value) {
    if (!value) {
        return null;
    }
    const normalized = (0, utils_1.normalizeWhitespace)(value);
    return normalized || null;
}
function normalizeOptionalPiece(value) {
    return normalizeOptionalText(value);
}
function hasAnyPaidConcept(line) {
    return (line.codePaymentStatus === "pagado" ||
        line.coseguroOdontoPaymentStatus === "pagado");
}
function isCodePaid(line) {
    return line.codePaymentStatus === "pagado";
}
function isCoseguroOdontoPaid(line) {
    return line.coseguroOdontoPaymentStatus === "pagado";
}
function ensureAttentionOwnership(attention, currentUser) {
    if (hasAdministrativeAccess(currentUser)) {
        return;
    }
    if (!isSameObjectId(attention.usuarioCargaId, currentUser.id)) {
        throw new api_1.AppError("FORBIDDEN", "No tenes permisos para acceder a esta atencion", 403);
    }
}
function ensureEditableAttentionShape(currentAttention, input) {
    if ((0, utils_1.formatDateOnlyValue)(currentAttention.fecha) !== input.fecha) {
        throw new api_1.AppError("VALIDATION_ERROR", "No podes modificar la fecha de una atencion ya creada desde esta vista", 400);
    }
    if (!input.pacienteId || !isSameObjectId(currentAttention.pacienteId, input.pacienteId)) {
        throw new api_1.AppError("VALIDATION_ERROR", "No podes modificar el paciente de una atencion ya creada desde esta vista", 400);
    }
    if (normalizeOptionalText(currentAttention.observacionGeneral) !== normalizeOptionalText(input.observacionGeneral)) {
        throw new api_1.AppError("VALIDATION_ERROR", "La observacion general solo puede modificarse desde la vista administrativa", 400);
    }
    if (currentAttention.codigos.length !== input.codigos.length) {
        throw new api_1.AppError("VALIDATION_ERROR", "No podes agregar ni quitar codigos en una atencion ya creada desde esta vista", 400);
    }
}
function ensureEditableLineState(persistedLine, inputLine, index) {
    if (persistedLine.estado !== inputLine.estado) {
        throw new api_1.AppError("VALIDATION_ERROR", "Una o mas lineas fueron auditadas mientras editabas la atencion. Recarga la pagina para continuar.", 409, {
            [`codigos.${index}.estado`]: "La fila fue auditada mientras editabas la atencion. Recarga la pagina.",
        });
    }
}
function ensureAuditedLineUnchanged(persistedLine, inputLine, index) {
    ensureEditableLineState(persistedLine, inputLine, index);
    const sameCode = persistedLine.codigoObraSocialId === inputLine.codigoObraSocialId;
    const samePiece = normalizeOptionalPiece(persistedLine.pieza) === normalizeOptionalPiece(inputLine.pieza);
    const sameCoseguro = (persistedLine.coseguroCentavos ?? null) === (inputLine.coseguroCentavos ?? null);
    const sameObservation = normalizeOptionalText(persistedLine.observacion) ===
        normalizeOptionalText(inputLine.observacion);
    const samePago = persistedLine.pagoOdontologoCentavos === inputLine.pagoOdontologoCentavos;
    const sameCoseguroOdonto = (persistedLine.coseguroOdontoCentavos ?? null) ===
        (inputLine.coseguroOdontoCentavos ?? null);
    if (sameCode &&
        samePiece &&
        sameCoseguro &&
        sameObservation &&
        samePago &&
        sameCoseguroOdonto) {
        return;
    }
    throw new api_1.AppError("VALIDATION_ERROR", "Solo podes editar filas que sigan en estado pendiente", 400, {
        [`codigos.${index}`]: "La fila ya fue auditada y no puede modificarse desde esta vista",
    });
}
function ensurePaidLineProtected(persistedLine, persistedPaymentState, inputLine, index) {
    if (persistedPaymentState.codePaymentStatus === "pagado") {
        const sameCode = persistedLine.codigoObraSocialId === inputLine.codigoObraSocialId;
        const samePiece = normalizeOptionalPiece(persistedLine.pieza) === normalizeOptionalPiece(inputLine.pieza);
        const sameCoseguro = (persistedLine.coseguroCentavos ?? null) === (inputLine.coseguroCentavos ?? null);
        const sameObservation = normalizeOptionalText(persistedLine.observacion) ===
            normalizeOptionalText(inputLine.observacion);
        const samePago = persistedLine.pagoOdontologoCentavos === inputLine.pagoOdontologoCentavos;
        const sameStatus = persistedLine.estado === inputLine.estado;
        if (!sameCode || !samePiece || !sameCoseguro || !sameObservation || !samePago || !sameStatus) {
            throw new api_1.AppError("VALIDATION_ERROR", "No podes modificar un codigo que ya fue pagado", 400, {
                [`codigos.${index}`]: "El codigo ya fue pagado y sus datos principales quedan bloqueados",
            });
        }
    }
    if (persistedPaymentState.coseguroOdontoPaymentStatus === "pagado") {
        const sameCoseguroOdonto = (persistedLine.coseguroOdontoCentavos ?? null) ===
            (inputLine.coseguroOdontoCentavos ?? null);
        if (!sameCoseguroOdonto) {
            throw new api_1.AppError("VALIDATION_ERROR", "No podes modificar un coseguro odonto que ya fue pagado", 400, {
                [`codigos.${index}.coseguroOdontoCentavos`]: "El coseguro odonto ya fue pagado y no puede modificarse",
            });
        }
    }
}
function buildAdministrativeProtectedLine(params) {
    const { persistedLine, nextLine } = params;
    const protectedLine = {
        ...nextLine,
        _id: persistedLine._id,
        codePaymentStatus: persistedLine.codePaymentStatus ?? "pendiente",
        codePaymentId: persistedLine.codePaymentId ?? null,
        codePaidAt: persistedLine.codePaidAt ?? null,
        coseguroOdontoPaymentStatus: persistedLine.coseguroOdontoPaymentStatus ?? "pendiente",
        coseguroOdontoPaymentId: persistedLine.coseguroOdontoPaymentId ?? null,
        coseguroOdontoPaidAt: persistedLine.coseguroOdontoPaidAt ?? null,
    };
    if (isCodePaid(persistedLine)) {
        protectedLine.codigoObraSocialId = persistedLine.codigoObraSocialId;
        protectedLine.pieza = persistedLine.pieza;
        protectedLine.coseguroCentavos = persistedLine.coseguroCentavos;
        protectedLine.observacion = persistedLine.observacion;
        protectedLine.pagoOdontologoCentavos = persistedLine.pagoOdontologoCentavos;
        protectedLine.estado = persistedLine.estado;
    }
    if (isCoseguroOdontoPaid(persistedLine)) {
        protectedLine.coseguroOdontoCentavos = persistedLine.coseguroOdontoCentavos;
    }
    return protectedLine;
}
function toAttentionCodeLineDto(line, codigoDetalle) {
    return {
        lineId: String(line._id ?? ""),
        codigoObraSocialId: String(line.codigoObraSocialId),
        codigoNombre: codigoDetalle?.nombre ?? "Codigo sin datos",
        codigo: codigoDetalle?.codigo ?? "",
        pieza: line.pieza,
        coseguroCentavos: line.coseguroCentavos,
        coseguroOdontoCentavos: line.coseguroOdontoCentavos,
        observacion: line.observacion,
        pagoOdontologoCentavos: line.pagoOdontologoCentavos,
        estado: line.estado,
        codePaymentStatus: line.codePaymentStatus ?? "pendiente",
        coseguroOdontoPaymentStatus: line.coseguroOdontoPaymentStatus ?? "pendiente",
    };
}
function toAttentionDto(row) {
    const codigosById = new Map((row.codigosDetalle ?? []).map((codigo) => [String(codigo._id), codigo]));
    const codigos = row.codigos.map((line) => toAttentionCodeLineDto(line, codigosById.get(String(line.codigoObraSocialId))));
    const totalCoseguroCentavos = codigos.reduce((sum, line) => sum + (line.coseguroCentavos ?? 0), 0);
    const totalCoseguroOdontoCentavos = codigos.reduce((sum, line) => sum + (line.coseguroOdontoCentavos ?? 0), 0);
    const totalPagoOdontologoCentavos = codigos.reduce((sum, line) => sum + line.pagoOdontologoCentavos, 0);
    return {
        id: String(row._id),
        fecha: (0, utils_1.formatDateOnlyValue)(row.fecha),
        pacienteId: String(row.pacienteId),
        pacienteNombreCompleto: row.paciente
            ? `${row.paciente.apellido}, ${row.paciente.nombre}`
            : "Paciente sin datos",
        pacienteDni: row.paciente?.dni ?? "",
        obraSocialId: String(row.obraSocialId),
        obraSocialNombre: row.obraSocial?.nombre ?? "Obra social sin datos",
        usuarioCargaId: String(row.usuarioCargaId),
        usuarioCargaNombre: (0, utils_1.normalizeWhitespace)(`${row.usuarioCarga?.apellido ?? ""}, ${row.usuarioCarga?.name ?? ""}`),
        observacionGeneral: row.observacionGeneral,
        codigos,
        cantidadCodigos: codigos.length,
        totalCoseguroCentavos,
        totalCoseguroOdontoCentavos,
        totalPagoOdontologoCentavos,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}
function buildDateMatch(query) {
    const fecha = {};
    if (query.dateFrom) {
        fecha.$gte = (0, utils_1.parseDateOnlyAsUtc)(query.dateFrom);
    }
    if (query.dateTo) {
        fecha.$lte = (0, utils_1.parseDateOnlyAsUtc)(query.dateTo, { endOfDay: true });
    }
    return Object.keys(fecha).length > 0 ? fecha : undefined;
}
function getMonthRange(fecha) {
    const baseDate = typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
        ? (0, utils_1.parseDateOnlyAsUtc)(fecha)
        : new Date(fecha);
    const start = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { start, end };
}
async function getMonthlyUsage(params) {
    const { start, end } = getMonthRange(params.fecha);
    const match = {
        pacienteId: new mongoose_1.Types.ObjectId(params.pacienteId),
        obraSocialId: new mongoose_1.Types.ObjectId(params.obraSocialId),
        fecha: {
            $gte: start,
            $lte: end,
        },
    };
    if (params.excludeAttentionId) {
        match._id = { $ne: new mongoose_1.Types.ObjectId(params.excludeAttentionId) };
    }
    const rows = await attention_1.AttentionModel.aggregate([
        { $match: match },
        {
            $project: {
                cantidadCodigos: { $size: "$codigos" },
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: "$cantidadCodigos" },
            },
        },
    ]);
    return rows[0]?.total ?? 0;
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
        throw new api_1.AppError("VALIDATION_ERROR", "Debes seleccionar un paciente o crearlo en el flujo", 400);
    }
    const dni = (0, utils_1.normalizeDni)(input.paciente.dni);
    const existingPaciente = await paciente_1.PacienteModel.findOne({ dni }).lean();
    if (existingPaciente) {
        return existingPaciente;
    }
    const createdPaciente = await (0, pacientes_1.createPaciente)({
        ...input.paciente,
        dni,
    });
    const paciente = await paciente_1.PacienteModel.findById(createdPaciente.id).lean();
    if (!paciente) {
        throw new api_1.AppError("INTERNAL_ERROR", "No se pudo resolver el paciente", 500);
    }
    return paciente;
}
async function resolveActiveObraSocial(paciente) {
    if (!paciente.activo) {
        throw new api_1.AppError("INACTIVE_RELATED_RECORD", "El paciente debe estar activo", 409);
    }
    const obraSocialId = paciente.currentAttentionObraSocialId ?? paciente.obraSocialId;
    if (!obraSocialId) {
        throw new api_1.AppError("VALIDATION_ERROR", "El paciente debe tener una obra social activa para registrar atenciones", 400, {
            pacienteId: "El paciente debe tener una obra social activa para registrar atenciones",
        });
    }
    const obraSocial = await obra_social_1.ObraSocialModel.findById(obraSocialId).lean();
    if (!obraSocial) {
        throw new api_1.AppError("NOT_FOUND", "La obra social del paciente no existe", 404);
    }
    if (!obraSocial.activo) {
        throw new api_1.AppError("INACTIVE_RELATED_RECORD", "La obra social del paciente debe estar activa", 409);
    }
    return obraSocial;
}
async function resolveAttentionCodes(obraSocialId, lines) {
    const codeIds = Array.from(new Set(lines.map((line) => line.codigoObraSocialId).filter(Boolean)));
    const codes = await codigo_obra_social_1.CodigoObraSocialModel.find()
        .where("_id")
        .in(codeIds)
        .lean();
    const codesById = new Map(codes.map((code) => [String(code._id), code]));
    return lines.map((line, index) => {
        const code = codesById.get(line.codigoObraSocialId);
        if (!code) {
            throw new api_1.AppError("NOT_FOUND", "Uno de los codigos seleccionados no existe", 404, {
                [`codigos.${index}.codigoObraSocialId`]: "El codigo no existe",
            });
        }
        if (!code.activo) {
            throw new api_1.AppError("INACTIVE_RELATED_RECORD", "Todos los codigos deben estar activos", 409, {
                [`codigos.${index}.codigoObraSocialId`]: "El codigo seleccionado debe estar activo",
            });
        }
        if (String(code.obraSocialId) !== obraSocialId) {
            throw new api_1.AppError("VALIDATION_ERROR", "Todos los codigos deben pertenecer a la obra social del paciente", 400, {
                [`codigos.${index}.codigoObraSocialId`]: "El codigo no pertenece a la obra social del paciente",
            });
        }
        return {
            codigoObraSocialId: new mongoose_1.Types.ObjectId(line.codigoObraSocialId),
            pieza: line.pieza ? (0, utils_1.normalizeWhitespace)(line.pieza) : null,
            coseguroCentavos: line.coseguroCentavos ?? null,
            coseguroOdontoCentavos: line.coseguroOdontoCentavos ?? null,
            observacion: line.observacion ? (0, utils_1.normalizeWhitespace)(line.observacion) : null,
            pagoOdontologoCentavos: line.pagoOdontologoCentavos ?? code.valorCentavos,
            estado: line.estado,
            codePaymentStatus: "pendiente",
            codePaymentId: null,
            codePaidAt: null,
            coseguroOdontoPaymentStatus: "pendiente",
            coseguroOdontoPaymentId: null,
            coseguroOdontoPaidAt: null,
        };
    });
}
function buildAttentionPipeline(match) {
    return [
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
                localField: "obraSocialId",
                foreignField: "_id",
                as: "obraSocial",
            },
        },
        { $unwind: "$obraSocial" },
        {
            $lookup: {
                from: "users",
                localField: "usuarioCargaId",
                foreignField: "_id",
                as: "usuarioCarga",
            },
        },
        { $unwind: "$usuarioCarga" },
        {
            $lookup: {
                from: "codigos_obras_sociales",
                localField: "codigos.codigoObraSocialId",
                foreignField: "_id",
                as: "codigosDetalle",
            },
        },
    ];
}
async function listAttentionAssignableUsers() {
    await (0, mongoose_2.connectToDatabase)();
    return (await user_1.UserModel.find({ activo: true })
        .sort({ apellido: 1, name: 1 })
        .lean())
        .filter((user) => {
        const roles = String(user.roles ?? "");
        return roles.includes("odontologo") || roles.includes("administrador");
    })
        .map((user) => ({
        id: String(user._id),
        label: (0, utils_1.normalizeWhitespace)(`${user.apellido ?? ""}, ${user.name}`),
    }));
}
async function listAttentions(query, currentUser) {
    await (0, mongoose_2.connectToDatabase)();
    const match = {};
    const search = query.search?.trim();
    const dateMatch = buildDateMatch(query);
    if (dateMatch) {
        match.fecha = dateMatch;
    }
    if (!hasAdministrativeAccess(currentUser)) {
        match.usuarioCargaId = new mongoose_1.Types.ObjectId(currentUser.id);
    }
    else if (query.userId) {
        match.usuarioCargaId = new mongoose_1.Types.ObjectId(query.userId);
    }
    if (query.obraSocialId) {
        match.obraSocialId = new mongoose_1.Types.ObjectId(query.obraSocialId);
    }
    if (query.patientId) {
        match.pacienteId = new mongoose_1.Types.ObjectId(query.patientId);
    }
    if (query.attentionStatus) {
        match["codigos.estado"] = query.attentionStatus;
    }
    const pipeline = buildAttentionPipeline(match);
    if (search) {
        pipeline.push({
            $match: {
                $or: [
                    { "paciente.dni": { $regex: search, $options: "i" } },
                    { "paciente.nombre": { $regex: search, $options: "i" } },
                    { "paciente.apellido": { $regex: search, $options: "i" } },
                    { "obraSocial.nombre": { $regex: search, $options: "i" } },
                    { "usuarioCarga.name": { $regex: search, $options: "i" } },
                    { "usuarioCarga.apellido": { $regex: search, $options: "i" } },
                    { "codigosDetalle.nombre": { $regex: search, $options: "i" } },
                    { "codigosDetalle.codigo": { $regex: search, $options: "i" } },
                ],
            },
        });
    }
    const skip = (query.page - 1) * query.limit;
    const [rows, totalRows] = await Promise.all([
        attention_1.AttentionModel.aggregate([
            ...pipeline,
            { $sort: { fecha: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: query.limit },
        ]),
        attention_1.AttentionModel.aggregate([...pipeline, { $count: "total" }]),
    ]);
    const total = totalRows[0]?.total ?? 0;
    return {
        data: rows.map((row) => toAttentionDto(row)),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    };
}
async function getAttentionById(id, currentUser) {
    await (0, mongoose_2.connectToDatabase)();
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new api_1.AppError("NOT_FOUND", "La atencion no existe", 404);
    }
    const attention = await attention_1.AttentionModel.findById(id)
        .populate("pacienteId", "nombre apellido dni")
        .populate("obraSocialId", "nombre")
        .populate("usuarioCargaId", "name apellido")
        .lean();
    if (!attention) {
        throw new api_1.AppError("NOT_FOUND", "La atencion no existe", 404);
    }
    ensureAttentionOwnership(attention, currentUser);
    const codeIds = Array.from(new Set(attention.codigos.map((line) => String(line.codigoObraSocialId))));
    const codeDetails = await codigo_obra_social_1.CodigoObraSocialModel.find()
        .where("_id")
        .in(codeIds)
        .select("_id nombre codigo")
        .lean();
    const row = {
        _id: attention._id,
        fecha: attention.fecha,
        pacienteId: attention.pacienteId?._id ?? attention.pacienteId,
        obraSocialId: attention.obraSocialId?._id ?? attention.obraSocialId,
        usuarioCargaId: attention.usuarioCargaId?._id ?? attention.usuarioCargaId,
        observacionGeneral: attention.observacionGeneral,
        codigos: attention.codigos,
        createdAt: attention.createdAt,
        updatedAt: attention.updatedAt,
        paciente: isPopulatedPacienteRef(attention.pacienteId)
            ? {
                nombre: attention.pacienteId.nombre,
                apellido: attention.pacienteId.apellido,
                dni: attention.pacienteId.dni,
            }
            : null,
        obraSocial: isPopulatedObraSocialRef(attention.obraSocialId)
            ? {
                nombre: attention.obraSocialId.nombre,
            }
            : null,
        usuarioCarga: isPopulatedUserRef(attention.usuarioCargaId)
            ? {
                name: attention.usuarioCargaId.name,
                apellido: attention.usuarioCargaId.apellido,
            }
            : null,
        codigosDetalle: codeDetails.map((code) => ({
            _id: code._id,
            nombre: code.nombre,
            codigo: code.codigo,
        })),
    };
    return toAttentionDto(row);
}
async function getAttentionLookups(input) {
    await (0, mongoose_2.connectToDatabase)();
    const obrasSociales = (await obra_social_1.ObraSocialModel.find({ activo: true }).sort({ nombre: 1 }).lean()).map((obraSocial) => ({
        id: String(obraSocial._id),
        nombre: obraSocial.nombre,
        cantidadPrestacionesMes: obraSocial.cantidadPrestacionesMes,
    }));
    const usuariosCarga = await listAttentionAssignableUsers();
    let paciente = null;
    let codigos = [];
    let resumenMensual = null;
    let pacienteDoc = null;
    let obraSocialIdForCodes = input?.obraSocialId ?? null;
    let attentionObraSocial = null;
    if (input?.attentionId) {
        const attentionDoc = await attention_1.AttentionModel.findById(input.attentionId)
            .populate("obraSocialId", "nombre activo cantidadPrestacionesMes")
            .lean();
        const populatedObraSocial = attentionDoc?.obraSocialId;
        if (attentionDoc && populatedObraSocial) {
            attentionObraSocial = {
                ...populatedObraSocial,
                pacienteId: attentionDoc.pacienteId,
            };
            obraSocialIdForCodes = String(populatedObraSocial._id);
        }
    }
    if (input?.patientId) {
        pacienteDoc = await paciente_1.PacienteModel.findById(input.patientId)
            .populate("obraSocialId", "nombre activo cantidadPrestacionesMes")
            .lean();
    }
    else if (input?.dni) {
        pacienteDoc = await paciente_1.PacienteModel.findOne({ dni: (0, utils_1.normalizeDni)(input.dni) })
            .populate("obraSocialId", "nombre activo cantidadPrestacionesMes")
            .lean();
    }
    if (pacienteDoc) {
        const currentPacienteObraSocial = pacienteDoc.obraSocialId;
        const shouldUseAttentionObraSocial = Boolean(attentionObraSocial) &&
            String(attentionObraSocial?.pacienteId) === String(pacienteDoc._id);
        const obraSocial = shouldUseAttentionObraSocial
            ? {
                _id: attentionObraSocial._id,
                nombre: attentionObraSocial.nombre,
                activo: attentionObraSocial.activo,
                cantidadPrestacionesMes: attentionObraSocial.cantidadPrestacionesMes,
            }
            : currentPacienteObraSocial;
        paciente = {
            id: String(pacienteDoc._id),
            nombre: pacienteDoc.nombre,
            apellido: pacienteDoc.apellido,
            dni: pacienteDoc.dni,
            activo: pacienteDoc.activo,
            obraSocialId: obraSocial ? String(obraSocial._id) : null,
            obraSocialNombre: obraSocial?.nombre ?? null,
            obraSocialActiva: Boolean(obraSocial?.activo),
        };
        if (pacienteDoc.activo && obraSocial?.activo && obraSocial._id) {
            obraSocialIdForCodes = String(obraSocial._id);
            const usadasMes = await getMonthlyUsage({
                pacienteId: String(pacienteDoc._id),
                obraSocialId: String(obraSocial._id),
                fecha: input?.fecha ?? new Date(),
                excludeAttentionId: input?.attentionId,
            });
            const limiteMensual = obraSocial.cantidadPrestacionesMes ?? 0;
            resumenMensual = {
                limiteMensual,
                usadasMes,
                disponibles: Math.max(limiteMensual - usadasMes, 0),
                superaTope: usadasMes > limiteMensual,
            };
        }
    }
    if (obraSocialIdForCodes) {
        const obraSocial = await obra_social_1.ObraSocialModel.findById(obraSocialIdForCodes).lean();
        if (obraSocial?.activo) {
            codigos = (await codigo_obra_social_1.CodigoObraSocialModel.find({
                obraSocialId: obraSocial._id,
                activo: true,
            })
                .sort({ nombre: 1, codigo: 1 })
                .lean()).map((codigo) => ({
                id: String(codigo._id),
                nombre: codigo.nombre,
                codigo: codigo.codigo,
                valorCentavos: codigo.valorCentavos,
            }));
            if (!resumenMensual) {
                resumenMensual = {
                    limiteMensual: obraSocial.cantidadPrestacionesMes,
                    usadasMes: 0,
                    disponibles: obraSocial.cantidadPrestacionesMes,
                    superaTope: false,
                };
            }
        }
    }
    return {
        paciente,
        codigos,
        obrasSociales,
        usuariosCarga,
        resumenMensual,
    };
}
async function createAttention(input, currentUser) {
    await (0, mongoose_2.connectToDatabase)();
    const paciente = await resolvePaciente(input);
    const obraSocial = await resolveActiveObraSocial(paciente);
    const codigos = await resolveAttentionCodes(String(obraSocial._id), input.codigos);
    const attention = await attention_1.AttentionModel.create({
        fecha: (0, utils_1.parseDateOnlyAsUtc)(input.fecha),
        pacienteId: new mongoose_1.Types.ObjectId(String(paciente._id)),
        obraSocialId: new mongoose_1.Types.ObjectId(String(obraSocial._id)),
        usuarioCargaId: new mongoose_1.Types.ObjectId(currentUser.id),
        observacionGeneral: input.observacionGeneral
            ? (0, utils_1.normalizeWhitespace)(input.observacionGeneral)
            : null,
        codigos,
    });
    return getAttentionById(String(attention._id), currentUser);
}
async function updateAttention(id, input, currentUser, options) {
    await (0, mongoose_2.connectToDatabase)();
    const attention = await attention_1.AttentionModel.findById(id);
    if (!attention) {
        throw new api_1.AppError("NOT_FOUND", "La atencion no existe", 404);
    }
    ensureAttentionOwnership(attention, currentUser);
    const isAdministrative = Boolean(options?.isAdministrative && hasAdministrativeAccess(currentUser));
    if (!isAdministrative) {
        ensureEditableAttentionShape({
            fecha: attention.fecha,
            pacienteId: attention.pacienteId,
            observacionGeneral: attention.observacionGeneral,
            codigos: attention.codigos.map((line) => ({
                codigoObraSocialId: String(line.codigoObraSocialId),
                pieza: line.pieza,
                coseguroCentavos: line.coseguroCentavos,
                coseguroOdontoCentavos: line.coseguroOdontoCentavos,
                observacion: line.observacion,
                pagoOdontologoCentavos: line.pagoOdontologoCentavos,
                estado: line.estado,
            })),
        }, input);
    }
    const paciente = await resolvePaciente(input);
    const shouldReuseCurrentAttentionObraSocial = String(attention.pacienteId) === String(paciente._id);
    const obraSocial = await resolveActiveObraSocial({
        ...paciente,
        currentAttentionObraSocialId: shouldReuseCurrentAttentionObraSocial
            ? attention.obraSocialId
            : null,
    });
    const codigos = await resolveAttentionCodes(String(obraSocial._id), input.codigos);
    if (isAdministrative) {
        const persistedLinesById = new Map(attention.codigos.map((line) => [String(line._id), line]));
        const incomingLineIds = new Set(input.codigos
            .map((line) => line.lineId)
            .filter((lineId) => Boolean(lineId)));
        const removedPaidLine = attention.codigos.find((line) => !incomingLineIds.has(String(line._id)) && hasAnyPaidConcept(line));
        if (removedPaidLine) {
            throw new api_1.AppError("VALIDATION_ERROR", "No podes quitar una linea que ya tenga conceptos pagados", 400);
        }
        attention.fecha = (0, utils_1.parseDateOnlyAsUtc)(input.fecha);
        attention.pacienteId = new mongoose_1.Types.ObjectId(String(paciente._id));
        attention.obraSocialId = new mongoose_1.Types.ObjectId(String(obraSocial._id));
        attention.observacionGeneral = input.observacionGeneral
            ? (0, utils_1.normalizeWhitespace)(input.observacionGeneral)
            : null;
        attention.codigos = codigos.map((nextLine, index) => {
            const inputLine = input.codigos[index];
            const persistedLine = (inputLine?.lineId
                ? persistedLinesById.get(inputLine.lineId)
                : undefined) ?? attention.codigos[index];
            if (!persistedLine) {
                return nextLine;
            }
            if (hasAnyPaidConcept(persistedLine)) {
                ensurePaidLineProtected({
                    codigoObraSocialId: String(persistedLine.codigoObraSocialId),
                    pieza: persistedLine.pieza,
                    coseguroCentavos: persistedLine.coseguroCentavos,
                    coseguroOdontoCentavos: persistedLine.coseguroOdontoCentavos,
                    observacion: persistedLine.observacion,
                    pagoOdontologoCentavos: persistedLine.pagoOdontologoCentavos,
                    estado: persistedLine.estado,
                }, {
                    codePaymentStatus: persistedLine.codePaymentStatus,
                    coseguroOdontoPaymentStatus: persistedLine.coseguroOdontoPaymentStatus,
                }, inputLine, index);
                return buildAdministrativeProtectedLine({
                    persistedLine,
                    nextLine,
                });
            }
            return buildAdministrativeProtectedLine({
                persistedLine,
                nextLine,
            });
        });
    }
    else {
        attention.codigos = attention.codigos.map((persistedLine, index) => {
            const inputLine = input.codigos[index];
            const nextLine = codigos[index];
            if (!inputLine || !nextLine) {
                throw new api_1.AppError("VALIDATION_ERROR", "No podes agregar ni quitar codigos en una atencion ya creada desde esta vista", 400);
            }
            const persistedComparable = {
                codigoObraSocialId: String(persistedLine.codigoObraSocialId),
                pieza: persistedLine.pieza,
                coseguroCentavos: persistedLine.coseguroCentavos,
                coseguroOdontoCentavos: persistedLine.coseguroOdontoCentavos,
                observacion: persistedLine.observacion,
                pagoOdontologoCentavos: persistedLine.pagoOdontologoCentavos,
                estado: persistedLine.estado,
            };
            if (persistedLine.estado !== "pendiente") {
                ensureAuditedLineUnchanged(persistedComparable, inputLine, index);
                return persistedLine;
            }
            if (hasAnyPaidConcept(persistedLine)) {
                ensurePaidLineProtected(persistedComparable, {
                    codePaymentStatus: persistedLine.codePaymentStatus,
                    coseguroOdontoPaymentStatus: persistedLine.coseguroOdontoPaymentStatus,
                }, inputLine, index);
                return persistedLine;
            }
            ensureEditableLineState(persistedComparable, inputLine, index);
            return {
                ...nextLine,
                _id: persistedLine._id,
                pagoOdontologoCentavos: persistedLine.pagoOdontologoCentavos,
                coseguroOdontoCentavos: persistedLine.coseguroOdontoCentavos,
                estado: persistedLine.estado,
                codePaymentStatus: persistedLine.codePaymentStatus ?? "pendiente",
                codePaymentId: persistedLine.codePaymentId ?? null,
                codePaidAt: persistedLine.codePaidAt ?? null,
                coseguroOdontoPaymentStatus: persistedLine.coseguroOdontoPaymentStatus ?? "pendiente",
                coseguroOdontoPaymentId: persistedLine.coseguroOdontoPaymentId ?? null,
                coseguroOdontoPaidAt: persistedLine.coseguroOdontoPaidAt ?? null,
            };
        });
    }
    await attention.save();
    return getAttentionById(id, currentUser);
}
