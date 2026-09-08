"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOrthodonticTreatments = listOrthodonticTreatments;
exports.getOrthodonticTreatment = getOrthodonticTreatment;
exports.getOrthodonticLookups = getOrthodonticLookups;
exports.createOrthodonticTreatment = createOrthodonticTreatment;
exports.updateOrthodonticTreatment = updateOrthodonticTreatment;
exports.addOrthodonticPayment = addOrthodonticPayment;
exports.updateOrthodonticPayment = updateOrthodonticPayment;
exports.deleteOrthodonticPayment = deleteOrthodonticPayment;
exports.getOrthodonticPaymentMonthKey = getOrthodonticPaymentMonthKey;
const mongoose_1 = require("mongoose");
const api_1 = require("@/lib/api");
const mongoose_2 = require("@/lib/db/mongoose");
const utils_1 = require("@/lib/utils");
const orthodontic_treatment_1 = require("@/models/orthodontic-treatment");
const paciente_1 = require("@/models/paciente");
const user_1 = require("@/models/user");
const pacientes_1 = require("@/services/pacientes");
function isAdmin(user) {
    return user.roles.includes("administrador");
}
function orthodontistRegex() {
    return /(^|,)ortodoncista(,|$)/;
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
function normalizeOptionalText(value) {
    if (!value) {
        return null;
    }
    const normalized = (0, utils_1.normalizeWhitespace)(value);
    return normalized || null;
}
function calculateOrthodontistAmount(montoCentavos, porcentajeOrtodoncista) {
    return Math.round(montoCentavos * (porcentajeOrtodoncista / 100));
}
function buildTotals(input) {
    const totalPresupuestadoCentavos = input.valorTratamientoCentavos + input.valorMaterialesCentavos;
    const totalPagadoPacienteCentavos = input.payments.reduce((acc, payment) => acc + payment.montoCentavos, 0);
    const totalLiquidableOrtodoncistaCentavos = input.payments.reduce((acc, payment) => acc + payment.montoOrtodoncistaCentavos, 0);
    const totalPagadoOrtodoncistaCentavos = input.payments.reduce((acc, payment) => acc +
        (payment.paymentStatus === "pagado"
            ? payment.montoOrtodoncistaCentavos
            : 0), 0);
    const saldoPacienteCentavos = Math.max(totalPresupuestadoCentavos - totalPagadoPacienteCentavos, 0);
    const porcentajePagado = totalPresupuestadoCentavos > 0
        ? Math.min(100, Number(((totalPagadoPacienteCentavos / totalPresupuestadoCentavos) *
            100).toFixed(2)))
        : 0;
    return {
        totalPresupuestadoCentavos,
        totalPagadoPacienteCentavos,
        saldoPacienteCentavos,
        porcentajePagado,
        totalLiquidableOrtodoncistaCentavos,
        totalPendienteOrtodoncistaCentavos: totalLiquidableOrtodoncistaCentavos - totalPagadoOrtodoncistaCentavos,
        totalPagadoOrtodoncistaCentavos,
    };
}
function toPaymentDto(payment) {
    return {
        id: getObjectIdString(payment._id),
        fecha: payment.fecha.toISOString(),
        montoCentavos: payment.montoCentavos,
        porcentajeOrtodoncista: payment.porcentajeOrtodoncista,
        montoOrtodoncistaCentavos: payment.montoOrtodoncistaCentavos,
        paymentStatus: payment.paymentStatus,
        paymentId: payment.paymentId ? getObjectIdString(payment.paymentId) : null,
        paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
        createdAt: (payment.createdAt ?? payment.fecha).toISOString(),
        updatedAt: (payment.updatedAt ?? payment.fecha).toISOString(),
    };
}
function toTreatmentDto(document) {
    const patient = typeof document.pacienteId === "object" && document.pacienteId !== null
        ? document.pacienteId
        : null;
    const orthodontist = typeof document.usuarioOrtodoncistaId === "object" &&
        document.usuarioOrtodoncistaId !== null
        ? document.usuarioOrtodoncistaId
        : null;
    const payments = [...document.payments]
        .sort((left, right) => left.fecha.getTime() - right.fecha.getTime())
        .map(toPaymentDto);
    return {
        id: getObjectIdString(document._id),
        fechaInicio: document.fechaInicio.toISOString(),
        pacienteId: patient ? getObjectIdString(patient._id) : getObjectIdString(document.pacienteId),
        pacienteNombreCompleto: patient
            ? `${patient.apellido}, ${patient.nombre}`
            : "",
        pacienteDni: patient?.dni ?? "",
        usuarioOrtodoncistaId: orthodontist
            ? getObjectIdString(orthodontist._id)
            : getObjectIdString(document.usuarioOrtodoncistaId),
        usuarioOrtodoncistaNombre: orthodontist
            ? (0, utils_1.normalizeWhitespace)(`${orthodontist.apellido ?? ""}, ${orthodontist.name}`)
            : "",
        tratamientoTipo: document.tratamientoTipo,
        valorTratamientoCentavos: document.valorTratamientoCentavos,
        valorMaterialesCentavos: document.valorMaterialesCentavos,
        estado: document.estado,
        payments,
        totals: buildTotals({
            valorTratamientoCentavos: document.valorTratamientoCentavos,
            valorMaterialesCentavos: document.valorMaterialesCentavos,
            payments: payments.map((payment) => ({
                montoCentavos: payment.montoCentavos,
                montoOrtodoncistaCentavos: payment.montoOrtodoncistaCentavos,
                paymentStatus: payment.paymentStatus,
            })),
        }),
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
    };
}
async function resolveOrthodontistUser(requestedUserId, currentUser) {
    if (isAdmin(currentUser) && !requestedUserId) {
        throw new api_1.AppError("VALIDATION_ERROR", "Debes seleccionar un ortodoncista", 400, {
            usuarioOrtodoncistaId: "Debes seleccionar un ortodoncista",
        });
    }
    const targetUserId = isAdmin(currentUser) ? requestedUserId : currentUser.id;
    const user = await user_1.UserModel.findById(targetUserId).lean();
    if (!user) {
        throw new api_1.AppError("NOT_FOUND", "El ortodoncista no existe", 404);
    }
    if (!user.activo || !String(user.roles ?? "").match(orthodontistRegex())) {
        throw new api_1.AppError("INACTIVE_RELATED_RECORD", "Debes seleccionar un ortodoncista activo", 409);
    }
    return user;
}
async function resolvePaciente(input) {
    if (input.pacienteId) {
        const paciente = await paciente_1.PacienteModel.findById(input.pacienteId).lean();
        if (!paciente) {
            throw new api_1.AppError("NOT_FOUND", "El paciente no existe", 404);
        }
        if (!paciente.activo) {
            throw new api_1.AppError("INACTIVE_RELATED_RECORD", "El paciente debe estar activo", 409);
        }
        return paciente;
    }
    if (!input.paciente) {
        throw new api_1.AppError("VALIDATION_ERROR", "Debes seleccionar un paciente o crearlo en el flujo", 400);
    }
    const duplicate = await paciente_1.PacienteModel.findOne({
        dni: (0, utils_1.normalizeDni)(input.paciente.dni),
    }).lean();
    if (duplicate) {
        if (!duplicate.activo) {
            throw new api_1.AppError("INACTIVE_RELATED_RECORD", "El paciente encontrado esta inactivo", 409);
        }
        return duplicate;
    }
    const createdPaciente = await (0, pacientes_1.createPaciente)({
        ...input.paciente,
        obraSocialId: input.paciente.obraSocialId ?? null,
    });
    const paciente = await paciente_1.PacienteModel.findById(createdPaciente.id).lean();
    if (!paciente) {
        throw new api_1.AppError("INTERNAL_ERROR", "No se pudo resolver el paciente", 500);
    }
    return paciente;
}
async function ensureNoOtherActiveTreatment(pacienteId, excludeId) {
    const duplicate = await orthodontic_treatment_1.OrthodonticTreatmentModel.findOne({
        pacienteId: new mongoose_1.Types.ObjectId(pacienteId),
        estado: "activo",
        ...(excludeId ? { _id: { $ne: new mongoose_1.Types.ObjectId(excludeId) } } : {}),
    }).lean();
    if (duplicate) {
        throw new api_1.AppError("DUPLICATE_RECORD", "El paciente ya tiene un tratamiento de ortodoncia activo", 409, {
            pacienteId: "El paciente ya tiene un tratamiento de ortodoncia activo",
        });
    }
}
async function loadTreatmentOrFail(id) {
    const treatment = await orthodontic_treatment_1.OrthodonticTreatmentModel.findById(id)
        .populate("pacienteId", "nombre apellido dni")
        .populate("usuarioOrtodoncistaId", "name apellido roles activo")
        .lean();
    if (!treatment) {
        throw new api_1.AppError("NOT_FOUND", "Tratamiento no encontrado", 404);
    }
    return treatment;
}
function ensureOwnership(treatment, currentUser) {
    if (isAdmin(currentUser)) {
        return;
    }
    if (getObjectIdString(treatment.usuarioOrtodoncistaId) !== currentUser.id) {
        throw new api_1.AppError("FORBIDDEN", "No tenes permisos para acceder a este tratamiento", 403);
    }
}
async function listOrthodonticTreatments(query, currentUser) {
    await (0, mongoose_2.connectToDatabase)();
    const match = {};
    if (query.status === "active") {
        match.estado = "activo";
    }
    if (query.status === "inactive") {
        match.estado = { $in: ["cerrado", "cancelado"] };
    }
    if (query.orthodonticTreatmentStatus) {
        match.estado = query.orthodonticTreatmentStatus;
    }
    if (query.userId) {
        match.usuarioOrtodoncistaId = new mongoose_1.Types.ObjectId(query.userId);
    }
    if (!isAdmin(currentUser)) {
        match.usuarioOrtodoncistaId = new mongoose_1.Types.ObjectId(currentUser.id);
    }
    if (query.dateFrom || query.dateTo) {
        match.fechaInicio = {};
        if (query.dateFrom) {
            match.fechaInicio.$gte = (0, utils_1.parseDateOnlyAsUtc)(query.dateFrom);
        }
        if (query.dateTo) {
            match.fechaInicio.$lte = (0, utils_1.parseDateOnlyAsUtc)(query.dateTo, { endOfDay: true });
        }
    }
    if (query.patientId) {
        match.pacienteId = new mongoose_1.Types.ObjectId(query.patientId);
    }
    const skip = (query.page - 1) * query.limit;
    const search = query.search?.trim();
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
                from: "users",
                localField: "usuarioOrtodoncistaId",
                foreignField: "_id",
                as: "ortodoncista",
            },
        },
        { $unwind: "$ortodoncista" },
        {
            $set: {
                pacienteId: "$paciente",
                usuarioOrtodoncistaId: "$ortodoncista",
            },
        },
    ];
    if (search) {
        pipeline.push({
            $match: {
                $or: [
                    { "paciente.dni": { $regex: search, $options: "i" } },
                    { "paciente.nombre": { $regex: search, $options: "i" } },
                    { "paciente.apellido": { $regex: search, $options: "i" } },
                    { tratamientoTipo: { $regex: search, $options: "i" } },
                    { "ortodoncista.name": { $regex: search, $options: "i" } },
                    { "ortodoncista.apellido": { $regex: search, $options: "i" } },
                ],
            },
        });
    }
    const [rows, totalRows] = await Promise.all([
        orthodontic_treatment_1.OrthodonticTreatmentModel.aggregate([
            ...pipeline,
            { $sort: { fechaInicio: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: query.limit },
        ]),
        orthodontic_treatment_1.OrthodonticTreatmentModel.aggregate([
            ...pipeline,
            { $count: "total" },
        ]),
    ]);
    return {
        data: rows.map(toTreatmentDto),
        pagination: {
            page: query.page,
            limit: query.limit,
            total: totalRows[0]?.total ?? 0,
            totalPages: Math.max(1, Math.ceil((totalRows[0]?.total ?? 0) / query.limit)),
        },
    };
}
async function getOrthodonticTreatment(id, currentUser) {
    await (0, mongoose_2.connectToDatabase)();
    const treatment = await loadTreatmentOrFail(id);
    ensureOwnership(treatment, currentUser);
    return toTreatmentDto(treatment);
}
async function getOrthodonticLookups(input) {
    await (0, mongoose_2.connectToDatabase)();
    const patientDoc = input?.dni
        ? await paciente_1.PacienteModel.findOne({ dni: (0, utils_1.normalizeDni)(input.dni) }).lean()
        : null;
    const orthodontists = (await user_1.UserModel.find({
        activo: true,
        roles: { $regex: orthodontistRegex() },
    })
        .sort({ apellido: 1, name: 1 })
        .lean()).map((user) => ({
        id: String(user._id),
        label: (0, utils_1.normalizeWhitespace)(`${user.apellido ?? ""}, ${user.name}`),
    }));
    return {
        paciente: patientDoc
            ? {
                id: String(patientDoc._id),
                nombre: patientDoc.nombre,
                apellido: patientDoc.apellido,
                dni: patientDoc.dni,
                obraSocialId: patientDoc.obraSocialId ? String(patientDoc.obraSocialId) : null,
                obraSocialNombre: null,
            }
            : null,
        ortodoncistas: orthodontists,
    };
}
async function createOrthodonticTreatment(input, currentUser) {
    await (0, mongoose_2.connectToDatabase)();
    const paciente = await resolvePaciente(input);
    const ortodoncista = await resolveOrthodontistUser(input.usuarioOrtodoncistaId, currentUser);
    if (input.estado === "activo") {
        await ensureNoOtherActiveTreatment(String(paciente._id));
    }
    const created = await orthodontic_treatment_1.OrthodonticTreatmentModel.create({
        fechaInicio: (0, utils_1.parseDateOnlyAsUtc)(input.fechaInicio),
        pacienteId: new mongoose_1.Types.ObjectId(String(paciente._id)),
        usuarioOrtodoncistaId: new mongoose_1.Types.ObjectId(String(ortodoncista._id)),
        tratamientoTipo: input.tratamientoTipo,
        valorTratamientoCentavos: input.valorTratamientoCentavos,
        valorMaterialesCentavos: input.valorMaterialesCentavos,
        estado: input.estado ?? "activo",
        payments: [],
    });
    return getOrthodonticTreatment(String(created._id), currentUser);
}
async function updateOrthodonticTreatment(id, input, currentUser) {
    await (0, mongoose_2.connectToDatabase)();
    const treatment = await orthodontic_treatment_1.OrthodonticTreatmentModel.findById(id);
    if (!treatment) {
        throw new api_1.AppError("NOT_FOUND", "Tratamiento no encontrado", 404);
    }
    ensureOwnership(treatment, currentUser);
    const paciente = await resolvePaciente(input);
    const ortodoncista = await resolveOrthodontistUser(input.usuarioOrtodoncistaId || getObjectIdString(treatment.usuarioOrtodoncistaId), currentUser);
    if (input.estado === "activo") {
        await ensureNoOtherActiveTreatment(String(paciente._id), id);
    }
    treatment.fechaInicio = (0, utils_1.parseDateOnlyAsUtc)(input.fechaInicio);
    treatment.pacienteId = new mongoose_1.Types.ObjectId(String(paciente._id));
    treatment.usuarioOrtodoncistaId = new mongoose_1.Types.ObjectId(String(ortodoncista._id));
    treatment.tratamientoTipo = input.tratamientoTipo;
    treatment.valorTratamientoCentavos = input.valorTratamientoCentavos;
    treatment.valorMaterialesCentavos = input.valorMaterialesCentavos;
    treatment.estado = input.estado;
    await treatment.save();
    return getOrthodonticTreatment(id, currentUser);
}
async function addOrthodonticPayment(treatmentId, input, currentUser) {
    await (0, mongoose_2.connectToDatabase)();
    const treatment = await orthodontic_treatment_1.OrthodonticTreatmentModel.findById(treatmentId);
    if (!treatment) {
        throw new api_1.AppError("NOT_FOUND", "Tratamiento no encontrado", 404);
    }
    ensureOwnership(treatment, currentUser);
    treatment.payments.push({
        _id: new mongoose_1.Types.ObjectId(),
        fecha: (0, utils_1.parseDateOnlyAsUtc)(input.fecha),
        montoCentavos: input.montoCentavos,
        porcentajeOrtodoncista: input.porcentajeOrtodoncista,
        montoOrtodoncistaCentavos: calculateOrthodontistAmount(input.montoCentavos, input.porcentajeOrtodoncista),
        paymentStatus: "pendiente",
        paymentId: null,
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    await treatment.save();
    return getOrthodonticTreatment(treatmentId, currentUser);
}
async function updateOrthodonticPayment(treatmentId, paymentId, input, currentUser) {
    await (0, mongoose_2.connectToDatabase)();
    const treatment = await orthodontic_treatment_1.OrthodonticTreatmentModel.findById(treatmentId);
    if (!treatment) {
        throw new api_1.AppError("NOT_FOUND", "Tratamiento no encontrado", 404);
    }
    ensureOwnership(treatment, currentUser);
    const paymentIndex = treatment.payments.findIndex((item) => String(item._id) === paymentId);
    const payment = treatment.payments[paymentIndex];
    if (paymentIndex < 0 || !payment) {
        throw new api_1.AppError("NOT_FOUND", "Pago no encontrado", 404);
    }
    if (payment.paymentStatus === "pagado" || payment.paymentId) {
        throw new api_1.AppError("VALIDATION_ERROR", "No podes editar un pago de ortodoncia ya liquidado", 409);
    }
    payment.fecha = (0, utils_1.parseDateOnlyAsUtc)(input.fecha);
    payment.montoCentavos = input.montoCentavos;
    payment.porcentajeOrtodoncista = input.porcentajeOrtodoncista;
    payment.montoOrtodoncistaCentavos = calculateOrthodontistAmount(input.montoCentavos, input.porcentajeOrtodoncista);
    payment.updatedAt = new Date();
    await treatment.save();
    return getOrthodonticTreatment(treatmentId, currentUser);
}
async function deleteOrthodonticPayment(treatmentId, paymentId, currentUser) {
    await (0, mongoose_2.connectToDatabase)();
    const treatment = await orthodontic_treatment_1.OrthodonticTreatmentModel.findById(treatmentId);
    if (!treatment) {
        throw new api_1.AppError("NOT_FOUND", "Tratamiento no encontrado", 404);
    }
    ensureOwnership(treatment, currentUser);
    const paymentIndex = treatment.payments.findIndex((item) => String(item._id) === paymentId);
    const payment = treatment.payments[paymentIndex];
    if (paymentIndex < 0 || !payment) {
        throw new api_1.AppError("NOT_FOUND", "Pago no encontrado", 404);
    }
    if (payment.paymentStatus === "pagado" || payment.paymentId) {
        throw new api_1.AppError("VALIDATION_ERROR", "No podes eliminar un pago de ortodoncia ya liquidado", 409);
    }
    treatment.payments.splice(paymentIndex, 1);
    await treatment.save();
    return getOrthodonticTreatment(treatmentId, currentUser);
}
function getOrthodonticPaymentMonthKey(paymentDate) {
    return (0, utils_1.formatDateOnlyValue)(paymentDate).slice(0, 7);
}
