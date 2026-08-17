"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPaymentCandidates = listPaymentCandidates;
exports.listPaymentLookups = listPaymentLookups;
exports.listPayments = listPayments;
exports.createPayment = createPayment;
const mongoose_1 = require("mongoose");
const api_1 = require("@/lib/api");
const mongoose_2 = require("@/lib/db/mongoose");
const utils_1 = require("@/lib/utils");
const attention_1 = require("@/models/attention");
const payment_1 = require("@/models/payment");
const user_1 = require("@/models/user");
const movimientos_1 = require("@/services/movimientos");
const APP_TIMEZONE = "America/Argentina/Buenos_Aires";
function getMonthRangeFromKey(monthKey) {
    const [yearValue, monthValue] = monthKey.split("-");
    const year = Number(yearValue);
    const monthIndex = Number(monthValue) - 1;
    if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
        throw new api_1.AppError("VALIDATION_ERROR", "El mes seleccionado no es valido", 400);
    }
    const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    return { start, end };
}
function canPayCode(line) {
    return line.estado === "ok" && line.codePaymentStatus === "pendiente";
}
function canPayCoseguroOdonto(line) {
    return ((line.coseguroOdontoCentavos ?? 0) > 0 &&
        line.coseguroOdontoPaymentStatus === "pendiente");
}
function toPaymentCandidateDto(row) {
    return {
        attentionId: String(row.attentionId),
        attentionFecha: row.attentionFecha.toISOString(),
        attentionMonth: row.attentionMonth,
        userId: String(row.userId),
        userName: row.userName,
        pacienteId: String(row.pacienteId),
        pacienteNombreCompleto: row.pacienteNombreCompleto,
        pacienteDni: row.pacienteDni,
        obraSocialId: String(row.obraSocialId),
        obraSocialNombre: row.obraSocialNombre,
        lineId: String(row.lineId),
        codigoObraSocialId: String(row.codigoObraSocialId),
        codigo: row.codigo,
        codigoNombre: row.codigoNombre,
        pieza: row.pieza,
        estado: row.estado,
        pagoOdontologoCentavos: row.pagoOdontologoCentavos,
        coseguroOdontoCentavos: row.coseguroOdontoCentavos,
        codePaymentStatus: row.codePaymentStatus,
        coseguroOdontoPaymentStatus: row.coseguroOdontoPaymentStatus,
        canPayCode: canPayCode(row),
        canPayCoseguroOdonto: canPayCoseguroOdonto(row),
    };
}
function toPaymentDto(payment) {
    return {
        id: String(payment._id),
        usuarioId: String(payment.usuarioId),
        usuarioNombreSnapshot: payment.usuarioNombreSnapshot,
        attentionMonth: payment.attentionMonth,
        paidAt: payment.paidAt.toISOString(),
        createdByUserId: String(payment.createdByUserId),
        totalPagoCodigosCentavos: payment.totalPagoCodigosCentavos,
        totalCoseguroOdontoCentavos: payment.totalCoseguroOdontoCentavos,
        totalHonorariosCentavos: payment.totalHonorariosCentavos,
        quantityConceptsPaid: payment.quantityConceptsPaid,
        lineItems: payment.lineItems,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
    };
}
async function ensureLineIdsForPayments(match) {
    const connection = await (0, mongoose_2.connectToDatabase)();
    const collection = connection.connection.db.collection("attentions");
    const attentions = await collection.find(match).toArray();
    for (const attention of attentions) {
        let changed = false;
        const normalizedLines = (attention.codigos ?? []).map((line) => {
            const nextLine = {
                ...line,
                _id: line._id ? new mongoose_1.Types.ObjectId(String(line._id)) : new mongoose_1.Types.ObjectId(),
                codePaymentStatus: line.codePaymentStatus ?? "pendiente",
                codePaymentId: line.codePaymentId ?? null,
                codePaidAt: line.codePaidAt ?? null,
                coseguroOdontoPaymentStatus: line.coseguroOdontoPaymentStatus ?? "pendiente",
                coseguroOdontoPaymentId: line.coseguroOdontoPaymentId ?? null,
                coseguroOdontoPaidAt: line.coseguroOdontoPaidAt ?? null,
            };
            if (!line._id ||
                !line.codePaymentStatus ||
                !line.coseguroOdontoPaymentStatus) {
                changed = true;
            }
            return nextLine;
        });
        if (changed) {
            await collection.updateOne({ _id: attention._id }, { $set: { codigos: normalizedLines } });
        }
    }
}
function buildCandidateBaseMatch(query) {
    const match = {};
    if (query.userId) {
        match.usuarioCargaId = new mongoose_1.Types.ObjectId(query.userId);
    }
    if (query.attentionMonth) {
        const { start, end } = getMonthRangeFromKey(query.attentionMonth);
        match.fecha = {
            $gte: start,
            $lte: end,
        };
    }
    return match;
}
function buildCandidatePipeline(query) {
    const baseMatch = buildCandidateBaseMatch(query);
    const search = query.search?.trim();
    const pipeline = [
        { $match: baseMatch },
        { $unwind: "$codigos" },
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
                as: "codigoDetalle",
            },
        },
        { $unwind: "$codigoDetalle" },
    ];
    if (query.attentionStatus) {
        pipeline.push({
            $match: {
                "codigos.estado": query.attentionStatus,
            },
        });
    }
    if (search) {
        pipeline.push({
            $match: {
                $or: [
                    { "paciente.dni": { $regex: search, $options: "i" } },
                    { "paciente.nombre": { $regex: search, $options: "i" } },
                    { "paciente.apellido": { $regex: search, $options: "i" } },
                    { "obraSocial.nombre": { $regex: search, $options: "i" } },
                    { "codigoDetalle.codigo": { $regex: search, $options: "i" } },
                    { "codigoDetalle.nombre": { $regex: search, $options: "i" } },
                    { "usuarioCarga.name": { $regex: search, $options: "i" } },
                    { "usuarioCarga.apellido": { $regex: search, $options: "i" } },
                ],
            },
        });
    }
    pipeline.push({
        $project: {
            attentionId: "$_id",
            attentionFecha: "$fecha",
            attentionMonth: {
                $dateToString: {
                    format: "%Y-%m",
                    date: "$fecha",
                    timezone: APP_TIMEZONE,
                },
            },
            userId: "$usuarioCarga._id",
            userName: {
                $trim: {
                    input: {
                        $concat: [
                            { $ifNull: ["$usuarioCarga.apellido", ""] },
                            ", ",
                            { $ifNull: ["$usuarioCarga.name", ""] },
                        ],
                    },
                },
            },
            pacienteId: "$paciente._id",
            pacienteNombreCompleto: {
                $trim: {
                    input: {
                        $concat: [
                            { $ifNull: ["$paciente.apellido", ""] },
                            ", ",
                            { $ifNull: ["$paciente.nombre", ""] },
                        ],
                    },
                },
            },
            pacienteDni: "$paciente.dni",
            obraSocialId: "$obraSocial._id",
            obraSocialNombre: "$obraSocial.nombre",
            lineId: "$codigos._id",
            codigoObraSocialId: "$codigoDetalle._id",
            codigo: "$codigoDetalle.codigo",
            codigoNombre: "$codigoDetalle.nombre",
            pieza: "$codigos.pieza",
            estado: "$codigos.estado",
            pagoOdontologoCentavos: "$codigos.pagoOdontologoCentavos",
            coseguroOdontoCentavos: "$codigos.coseguroOdontoCentavos",
            codePaymentStatus: {
                $ifNull: ["$codigos.codePaymentStatus", "pendiente"],
            },
            coseguroOdontoPaymentStatus: {
                $ifNull: ["$codigos.coseguroOdontoPaymentStatus", "pendiente"],
            },
        },
    });
    return pipeline;
}
async function getCandidateRows(query) {
    await ensureLineIdsForPayments(buildCandidateBaseMatch(query));
    const skip = (query.page - 1) * query.limit;
    const pipeline = buildCandidatePipeline(query);
    const [rows, totalRows] = await Promise.all([
        attention_1.AttentionModel.aggregate([
            ...pipeline,
            { $sort: { attentionFecha: -1, pacienteNombreCompleto: 1, codigo: 1 } },
            { $skip: skip },
            { $limit: query.limit },
        ]),
        attention_1.AttentionModel.aggregate([...pipeline, { $count: "total" }]),
    ]);
    return {
        rows: rows,
        total: totalRows[0]?.total ?? 0,
    };
}
async function getFreshSelectedCandidates(input) {
    await ensureLineIdsForPayments(buildCandidateBaseMatch(input));
    const pipeline = buildCandidatePipeline({
        page: 1,
        limit: Math.max(input.selectedItems.length, 1),
        userId: input.userId,
        attentionMonth: input.attentionMonth,
    });
    pipeline.push({
        $match: {
            lineId: {
                $in: input.selectedItems.map((item) => new mongoose_1.Types.ObjectId(item.lineId)),
            },
        },
    });
    const rows = await attention_1.AttentionModel.aggregate(pipeline);
    return rows.map(toPaymentCandidateDto);
}
function buildPaymentSummary(candidates, selectedItems, userId, attentionMonth) {
    const selectedByLineId = new Map(selectedItems.map((item) => [item.lineId, item]));
    let totalPagoCodigosCentavos = 0;
    let totalCoseguroOdontoCentavos = 0;
    let quantityConceptsPaid = 0;
    candidates.forEach((candidate) => {
        const selection = selectedByLineId.get(candidate.lineId);
        if (!selection) {
            return;
        }
        if (selection.payCode) {
            totalPagoCodigosCentavos += candidate.pagoOdontologoCentavos;
            quantityConceptsPaid += 1;
        }
        if (selection.payCoseguroOdonto) {
            totalCoseguroOdontoCentavos += candidate.coseguroOdontoCentavos ?? 0;
            quantityConceptsPaid += 1;
        }
    });
    return {
        userId,
        attentionMonth,
        selectedItems,
        totalPagoCodigosCentavos,
        totalCoseguroOdontoCentavos,
        totalHonorariosCentavos: totalPagoCodigosCentavos + totalCoseguroOdontoCentavos,
        quantityConceptsPaid,
    };
}
async function listPaymentCandidates(query) {
    await (0, mongoose_2.connectToDatabase)();
    const { rows, total } = await getCandidateRows(query);
    return {
        data: rows.map(toPaymentCandidateDto),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    };
}
async function listPaymentLookups() {
    await (0, mongoose_2.connectToDatabase)();
    const users = (await user_1.UserModel.find({ activo: true })
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
    const monthRows = await attention_1.AttentionModel.aggregate([
        {
            $project: {
                month: {
                    $dateToString: {
                        format: "%Y-%m",
                        date: "$fecha",
                        timezone: APP_TIMEZONE,
                    },
                },
            },
        },
        { $group: { _id: "$month" } },
        { $sort: { _id: -1 } },
    ]);
    return {
        users,
        months: monthRows.map((row) => row._id),
    };
}
async function listPayments(query) {
    await (0, mongoose_2.connectToDatabase)();
    const match = {};
    if (query.userId) {
        match.usuarioId = new mongoose_1.Types.ObjectId(query.userId);
    }
    if (query.attentionMonth) {
        match.attentionMonth = query.attentionMonth;
    }
    const skip = (query.page - 1) * query.limit;
    const [payments, total] = await Promise.all([
        payment_1.PaymentModel.find(match)
            .sort({ paidAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        payment_1.PaymentModel.countDocuments(match),
    ]);
    return {
        data: payments.map((payment) => toPaymentDto({
            ...payment,
            lineItems: payment.lineItems.map((lineItem) => ({
                attentionId: String(lineItem.attentionId),
                attentionFecha: lineItem.attentionFecha.toISOString(),
                pacienteId: String(lineItem.pacienteId),
                pacienteNombre: lineItem.pacienteNombre,
                pacienteDni: lineItem.pacienteDni,
                obraSocialId: String(lineItem.obraSocialId),
                obraSocialNombre: lineItem.obraSocialNombre,
                codigoObraSocialId: String(lineItem.codigoObraSocialId),
                codigo: lineItem.codigo,
                codigoNombre: lineItem.codigoNombre,
                pieza: lineItem.pieza,
                estadoAtencionSnapshot: lineItem.estadoAtencionSnapshot,
                pagoOdontologoCentavos: lineItem.pagoOdontologoCentavos,
                coseguroOdontoCentavos: lineItem.coseguroOdontoCentavos,
                includesCodePayment: lineItem.includesCodePayment,
                includesCoseguroOdontoPayment: lineItem.includesCoseguroOdontoPayment,
                totalLineaCentavos: lineItem.totalLineaCentavos,
            })),
        })),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    };
}
async function rollbackPaymentOperation(paymentId, selectedItems) {
    const connection = await (0, mongoose_2.connectToDatabase)();
    const collection = connection.connection.db.collection("attentions");
    for (const selection of selectedItems) {
        const lineId = new mongoose_1.Types.ObjectId(selection.lineId);
        if (selection.payCode) {
            await collection.updateOne({
                codigos: {
                    $elemMatch: {
                        _id: lineId,
                        codePaymentId: paymentId,
                    },
                },
            }, {
                $set: {
                    "codigos.$.codePaymentStatus": "pendiente",
                    "codigos.$.codePaymentId": null,
                    "codigos.$.codePaidAt": null,
                },
            });
        }
        if (selection.payCoseguroOdonto) {
            await collection.updateOne({
                codigos: {
                    $elemMatch: {
                        _id: lineId,
                        coseguroOdontoPaymentId: paymentId,
                    },
                },
            }, {
                $set: {
                    "codigos.$.coseguroOdontoPaymentStatus": "pendiente",
                    "codigos.$.coseguroOdontoPaymentId": null,
                    "codigos.$.coseguroOdontoPaidAt": null,
                },
            });
        }
    }
    await (0, movimientos_1.deleteMovementByOrigin)("payment", paymentId);
    await payment_1.PaymentModel.deleteOne({ _id: String(paymentId) });
}
async function createPayment(input, currentUserId) {
    await (0, mongoose_2.connectToDatabase)();
    const selectedItems = input.selectedItems.filter((item) => item.payCode || item.payCoseguroOdonto);
    if (selectedItems.length === 0) {
        throw new api_1.AppError("VALIDATION_ERROR", "Debes seleccionar al menos un concepto para liquidar", 400);
    }
    const selectedByLineId = new Map();
    selectedItems.forEach((item) => {
        const existing = selectedByLineId.get(item.lineId);
        if (existing) {
            existing.payCode = existing.payCode || item.payCode;
            existing.payCoseguroOdonto =
                existing.payCoseguroOdonto || item.payCoseguroOdonto;
            return;
        }
        selectedByLineId.set(item.lineId, { ...item });
    });
    const normalizedSelection = Array.from(selectedByLineId.values());
    const candidates = await getFreshSelectedCandidates({
        ...input,
        selectedItems: normalizedSelection,
    });
    const candidatesByLineId = new Map(candidates.map((item) => [item.lineId, item]));
    if (candidatesByLineId.size !== normalizedSelection.length) {
        throw new api_1.AppError("NOT_FOUND", "Una o mas lineas seleccionadas ya no estan disponibles para este usuario o mes", 404);
    }
    normalizedSelection.forEach((selection) => {
        const candidate = candidatesByLineId.get(selection.lineId);
        if (!candidate) {
            throw new api_1.AppError("NOT_FOUND", "Una linea seleccionada ya no existe", 404);
        }
        if (selection.payCode && !candidate.canPayCode) {
            throw new api_1.AppError("VALIDATION_ERROR", "Uno de los codigos seleccionados ya no puede liquidarse", 409);
        }
        if (selection.payCoseguroOdonto && !candidate.canPayCoseguroOdonto) {
            throw new api_1.AppError("VALIDATION_ERROR", "Uno de los coseguros odonto seleccionados ya no puede liquidarse", 409);
        }
    });
    const summary = buildPaymentSummary(candidates, normalizedSelection, input.userId, input.attentionMonth);
    if (summary.quantityConceptsPaid === 0) {
        throw new api_1.AppError("VALIDATION_ERROR", "No hay conceptos validos para liquidar", 400);
    }
    const firstCandidate = candidates[0];
    const paymentId = new mongoose_1.Types.ObjectId();
    const paidAt = new Date();
    const lineItems = candidates.map((candidate) => {
        const selection = selectedByLineId.get(candidate.lineId);
        const totalLineaCentavos = (selection.payCode ? candidate.pagoOdontologoCentavos : 0) +
            (selection.payCoseguroOdonto ? candidate.coseguroOdontoCentavos ?? 0 : 0);
        return {
            attentionId: candidate.attentionId,
            attentionFecha: candidate.attentionFecha,
            pacienteId: candidate.pacienteId,
            pacienteNombre: candidate.pacienteNombreCompleto,
            pacienteDni: candidate.pacienteDni,
            obraSocialId: candidate.obraSocialId,
            obraSocialNombre: candidate.obraSocialNombre,
            codigoObraSocialId: candidate.codigoObraSocialId,
            codigo: candidate.codigo,
            codigoNombre: candidate.codigoNombre,
            pieza: candidate.pieza,
            estadoAtencionSnapshot: candidate.estado,
            pagoOdontologoCentavos: candidate.pagoOdontologoCentavos,
            coseguroOdontoCentavos: candidate.coseguroOdontoCentavos,
            includesCodePayment: selection.payCode,
            includesCoseguroOdontoPayment: selection.payCoseguroOdonto,
            totalLineaCentavos,
        };
    });
    await payment_1.PaymentModel.create({
        _id: paymentId,
        usuarioId: new mongoose_1.Types.ObjectId(input.userId),
        usuarioNombreSnapshot: firstCandidate.userName,
        attentionMonth: input.attentionMonth,
        paidAt,
        createdByUserId: new mongoose_1.Types.ObjectId(currentUserId),
        lineItems: lineItems.map((lineItem) => ({
            ...lineItem,
            attentionId: new mongoose_1.Types.ObjectId(lineItem.attentionId),
            attentionFecha: new Date(lineItem.attentionFecha),
            pacienteId: new mongoose_1.Types.ObjectId(lineItem.pacienteId),
            obraSocialId: new mongoose_1.Types.ObjectId(lineItem.obraSocialId),
            codigoObraSocialId: new mongoose_1.Types.ObjectId(lineItem.codigoObraSocialId),
        })),
        totalPagoCodigosCentavos: summary.totalPagoCodigosCentavos,
        totalCoseguroOdontoCentavos: summary.totalCoseguroOdontoCentavos,
        totalHonorariosCentavos: summary.totalHonorariosCentavos,
        quantityConceptsPaid: summary.quantityConceptsPaid,
    });
    try {
        await (0, movimientos_1.createPaymentMovement)({
            paymentId,
            paidAt,
            usuarioId: input.userId,
            usuarioNombreSnapshot: firstCandidate.userName,
            attentionMonth: input.attentionMonth,
            totalPagoCodigosCentavos: summary.totalPagoCodigosCentavos,
            totalCoseguroOdontoCentavos: summary.totalCoseguroOdontoCentavos,
            totalHonorariosCentavos: summary.totalHonorariosCentavos,
            quantityConceptsPaid: summary.quantityConceptsPaid,
            createdByUserId: currentUserId,
        });
        const connection = await (0, mongoose_2.connectToDatabase)();
        const collection = connection.connection.db.collection("attentions");
        for (const selection of normalizedSelection) {
            const candidate = candidatesByLineId.get(selection.lineId);
            if (!candidate) {
                throw new api_1.AppError("NOT_FOUND", "Una linea seleccionada ya no existe", 404);
            }
            const lineId = new mongoose_1.Types.ObjectId(selection.lineId);
            const attentionId = new mongoose_1.Types.ObjectId(candidate.attentionId);
            if (selection.payCode) {
                const result = await collection.updateOne({
                    _id: attentionId,
                    codigos: {
                        $elemMatch: {
                            _id: lineId,
                            estado: "ok",
                            codePaymentStatus: { $ne: "pagado" },
                        },
                    },
                }, {
                    $set: {
                        "codigos.$.codePaymentStatus": "pagado",
                        "codigos.$.codePaymentId": paymentId,
                        "codigos.$.codePaidAt": paidAt,
                    },
                });
                if (result.modifiedCount !== 1) {
                    throw new api_1.AppError("DUPLICATE_RECORD", "Uno de los codigos seleccionados ya fue liquidado o dejo de estar en OK", 409);
                }
            }
            if (selection.payCoseguroOdonto) {
                const result = await collection.updateOne({
                    _id: attentionId,
                    codigos: {
                        $elemMatch: {
                            _id: lineId,
                            coseguroOdontoCentavos: { $gt: 0 },
                            coseguroOdontoPaymentStatus: { $ne: "pagado" },
                        },
                    },
                }, {
                    $set: {
                        "codigos.$.coseguroOdontoPaymentStatus": "pagado",
                        "codigos.$.coseguroOdontoPaymentId": paymentId,
                        "codigos.$.coseguroOdontoPaidAt": paidAt,
                    },
                });
                if (result.modifiedCount !== 1) {
                    throw new api_1.AppError("DUPLICATE_RECORD", "Uno de los coseguros odonto seleccionados ya fue liquidado o no tiene importe", 409);
                }
            }
        }
    }
    catch (error) {
        await rollbackPaymentOperation(paymentId, normalizedSelection);
        throw error;
    }
    const payment = await payment_1.PaymentModel.findById(paymentId).lean();
    if (!payment) {
        throw new api_1.AppError("INTERNAL_ERROR", "No se pudo recuperar el pago generado", 500);
    }
    return toPaymentDto({
        ...payment,
        lineItems: payment.lineItems.map((lineItem) => ({
            attentionId: String(lineItem.attentionId),
            attentionFecha: lineItem.attentionFecha.toISOString(),
            pacienteId: String(lineItem.pacienteId),
            pacienteNombre: lineItem.pacienteNombre,
            pacienteDni: lineItem.pacienteDni,
            obraSocialId: String(lineItem.obraSocialId),
            obraSocialNombre: lineItem.obraSocialNombre,
            codigoObraSocialId: String(lineItem.codigoObraSocialId),
            codigo: lineItem.codigo,
            codigoNombre: lineItem.codigoNombre,
            pieza: lineItem.pieza,
            estadoAtencionSnapshot: lineItem.estadoAtencionSnapshot,
            pagoOdontologoCentavos: lineItem.pagoOdontologoCentavos,
            coseguroOdontoCentavos: lineItem.coseguroOdontoCentavos,
            includesCodePayment: lineItem.includesCodePayment,
            includesCoseguroOdontoPayment: lineItem.includesCoseguroOdontoPayment,
            totalLineaCentavos: lineItem.totalLineaCentavos,
        })),
    });
}
