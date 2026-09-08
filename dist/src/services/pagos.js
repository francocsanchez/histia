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
const orthodontic_treatment_1 = require("@/models/orthodontic-treatment");
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
function getMonthKey(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}
function canPayCode(line) {
    return line.estado === "ok" && line.codePaymentStatus === "pendiente";
}
function canPayCoseguroOdonto(line) {
    return ((line.coseguroOdontoCentavos ?? 0) > 0 &&
        line.coseguroOdontoPaymentStatus === "pendiente");
}
function toAttentionCandidateDto(row) {
    return {
        sourceType: "attention",
        sourceLabel: "Atenciones",
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
        orthodonticTreatmentId: null,
        orthodonticTreatmentType: null,
        orthodonticPaymentId: null,
        orthodonticPaymentDate: null,
        orthodonticPaymentAmountCentavos: null,
        orthodonticPaymentPercentage: null,
    };
}
function toPaymentDto(payment) {
    return {
        id: String(payment._id),
        usuarioId: String(payment.usuarioId),
        usuarioNombreSnapshot: payment.usuarioNombreSnapshot,
        attentionMonth: payment.attentionMonth,
        attentionMonths: payment.attentionMonths && payment.attentionMonths.length > 0
            ? payment.attentionMonths
            : [payment.attentionMonth],
        paidAt: payment.paidAt.toISOString(),
        createdByUserId: String(payment.createdByUserId),
        totalPagoCodigosCentavos: payment.totalPagoCodigosCentavos,
        totalCoseguroOdontoCentavos: payment.totalCoseguroOdontoCentavos,
        totalOrtodonciaCentavos: payment.totalOrtodonciaCentavos,
        totalHonorariosCentavos: payment.totalHonorariosCentavos,
        totalCreditosCentavos: payment.totalCreditosCentavos,
        totalDebitosCentavos: payment.totalDebitosCentavos,
        totalNetoPagarCentavos: payment.totalNetoPagarCentavos,
        quantityConceptsPaid: payment.quantityConceptsPaid,
        lineItems: payment.lineItems,
        debitItems: payment.debitItems,
        creditItems: payment.creditItems,
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
function buildAttentionCandidateBaseMatch(query) {
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
function buildAttentionCandidatePipeline(query) {
    const baseMatch = buildAttentionCandidateBaseMatch(query);
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
async function getAttentionCandidates(query) {
    await ensureLineIdsForPayments(buildAttentionCandidateBaseMatch(query));
    const rows = await attention_1.AttentionModel.aggregate([
        ...buildAttentionCandidatePipeline(query),
        { $sort: { attentionFecha: -1, pacienteNombreCompleto: 1, codigo: 1 } },
    ]);
    return rows.map(toAttentionCandidateDto);
}
async function getOrthodonticCandidates(query) {
    const match = {};
    if (query.userId) {
        match.usuarioOrtodoncistaId = new mongoose_1.Types.ObjectId(query.userId);
    }
    const treatments = await orthodontic_treatment_1.OrthodonticTreatmentModel.find(match)
        .populate("pacienteId", "nombre apellido dni")
        .populate("usuarioOrtodoncistaId", "name apellido")
        .sort({ fechaInicio: -1, createdAt: -1 })
        .lean();
    const search = query.search?.trim().toLowerCase();
    const month = query.attentionMonth ?? null;
    const candidates = [];
    treatments.forEach((treatment) => {
        const patient = treatment.pacienteId;
        const orthodontist = treatment.usuarioOrtodoncistaId;
        treatment.payments.forEach((payment) => {
            const paymentMonth = getMonthKey(payment.fecha);
            if (month && paymentMonth !== month) {
                return;
            }
            const patientName = `${patient.apellido}, ${patient.nombre}`;
            const userName = (0, utils_1.normalizeWhitespace)(`${orthodontist.apellido ?? ""}, ${orthodontist.name}`);
            const searchHaystack = [
                patient.dni,
                patient.nombre,
                patient.apellido,
                patientName,
                userName,
                treatment.tratamientoTipo,
            ]
                .join(" ")
                .toLowerCase();
            if (search && !searchHaystack.includes(search)) {
                return;
            }
            candidates.push({
                sourceType: "orthodontic-payment",
                sourceLabel: "Ortodoncia",
                attentionId: String(treatment._id),
                attentionFecha: treatment.fechaInicio.toISOString(),
                attentionMonth: paymentMonth,
                userId: String(orthodontist._id),
                userName,
                pacienteId: String(patient._id),
                pacienteNombreCompleto: patientName,
                pacienteDni: patient.dni,
                obraSocialId: "",
                obraSocialNombre: "-",
                lineId: String(payment._id),
                codigoObraSocialId: "",
                codigo: treatment.tratamientoTipo.toUpperCase(),
                codigoNombre: "Pago parcial de ortodoncia",
                pieza: null,
                estado: "ok",
                pagoOdontologoCentavos: payment.montoOrtodoncistaCentavos,
                coseguroOdontoCentavos: null,
                codePaymentStatus: payment.paymentStatus,
                coseguroOdontoPaymentStatus: "pendiente",
                canPayCode: payment.paymentStatus === "pendiente",
                canPayCoseguroOdonto: false,
                orthodonticTreatmentId: String(treatment._id),
                orthodonticTreatmentType: treatment.tratamientoTipo,
                orthodonticPaymentId: String(payment._id),
                orthodonticPaymentDate: payment.fecha.toISOString(),
                orthodonticPaymentAmountCentavos: payment.montoCentavos,
                orthodonticPaymentPercentage: payment.porcentajeOrtodoncista,
            });
        });
    });
    return candidates.sort((left, right) => {
        const dateDiff = new Date(right.orthodonticPaymentDate ?? right.attentionFecha).getTime() -
            new Date(left.orthodonticPaymentDate ?? left.attentionFecha).getTime();
        if (dateDiff !== 0) {
            return dateDiff;
        }
        return left.pacienteNombreCompleto.localeCompare(right.pacienteNombreCompleto);
    });
}
async function getAllCandidates(query) {
    const [attentionCandidates, orthodonticCandidates] = await Promise.all([
        getAttentionCandidates(query),
        getOrthodonticCandidates(query),
    ]);
    return [...attentionCandidates, ...orthodonticCandidates].sort((left, right) => {
        const rightDate = right.sourceType === "orthodontic-payment"
            ? right.orthodonticPaymentDate ?? right.attentionFecha
            : right.attentionFecha;
        const leftDate = left.sourceType === "orthodontic-payment"
            ? left.orthodonticPaymentDate ?? left.attentionFecha
            : left.attentionFecha;
        const dateDiff = new Date(rightDate).getTime() - new Date(leftDate).getTime();
        if (dateDiff !== 0) {
            return dateDiff;
        }
        return left.pacienteNombreCompleto.localeCompare(right.pacienteNombreCompleto);
    });
}
function normalizeSelection(selectedItems) {
    const selectedByLineId = new Map();
    selectedItems
        .filter((item) => item.payCode || item.payCoseguroOdonto)
        .forEach((item) => {
        const key = `${item.sourceType}:${item.lineId}`;
        const existing = selectedByLineId.get(key);
        if (existing) {
            existing.payCode = existing.payCode || item.payCode;
            existing.payCoseguroOdonto =
                existing.payCoseguroOdonto || item.payCoseguroOdonto;
            return;
        }
        selectedByLineId.set(key, { ...item });
    });
    return Array.from(selectedByLineId.values());
}
async function getFreshSelectedCandidates(input) {
    const allCandidates = await getAllCandidates({
        page: 1,
        limit: Math.max(input.selectedItems.length, 1),
        userId: input.userId,
    });
    const selectedKeys = new Set(input.selectedItems.map((item) => `${item.sourceType}:${item.lineId}`));
    return allCandidates.filter((candidate) => selectedKeys.has(`${candidate.sourceType}:${candidate.lineId}`));
}
function buildPaymentSummary(candidates, selectedItems, userId, attentionMonth, debitItems, creditItems) {
    const selectedByKey = new Map(selectedItems.map((item) => [`${item.sourceType}:${item.lineId}`, item]));
    let totalPagoCodigosCentavos = 0;
    let totalCoseguroOdontoCentavos = 0;
    let totalOrtodonciaCentavos = 0;
    let quantityConceptsPaid = 0;
    const totalDebitosCentavos = debitItems.reduce((total, item) => total + item.montoCentavos, 0);
    const totalCreditosCentavos = creditItems.reduce((total, item) => total + item.montoCentavos, 0);
    candidates.forEach((candidate) => {
        const selection = selectedByKey.get(`${candidate.sourceType}:${candidate.lineId}`);
        if (!selection) {
            return;
        }
        if (candidate.sourceType === "orthodontic-payment") {
            if (selection.payCode) {
                totalOrtodonciaCentavos += candidate.pagoOdontologoCentavos;
                quantityConceptsPaid += 1;
            }
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
        totalOrtodonciaCentavos,
        totalHonorariosCentavos: totalPagoCodigosCentavos +
            totalCoseguroOdontoCentavos +
            totalOrtodonciaCentavos,
        totalCreditosCentavos,
        totalDebitosCentavos,
        totalNetoPagarCentavos: totalPagoCodigosCentavos +
            totalCoseguroOdontoCentavos +
            totalOrtodonciaCentavos +
            totalCreditosCentavos -
            totalDebitosCentavos,
        quantityConceptsPaid,
    };
}
function mapPersistedLineItem(lineItem) {
    if (lineItem.sourceType === "orthodontic-payment") {
        return {
            sourceType: "orthodontic-payment",
            orthodonticTreatmentId: String(lineItem.orthodonticTreatmentId),
            orthodonticPaymentId: String(lineItem.orthodonticPaymentId),
            treatmentStartDate: new Date(String(lineItem.treatmentStartDate)).toISOString(),
            paymentDate: new Date(String(lineItem.paymentDate)).toISOString(),
            treatmentType: String(lineItem.treatmentType),
            patientId: String(lineItem.patientId),
            patientName: String(lineItem.patientName),
            patientDni: String(lineItem.patientDni),
            paymentAmountCentavos: Number(lineItem.paymentAmountCentavos ?? 0),
            percentageToOrthodontist: Number(lineItem.percentageToOrthodontist ?? 0),
            orthodontistAmountCentavos: Number(lineItem.orthodontistAmountCentavos ?? 0),
            totalLineaCentavos: Number(lineItem.totalLineaCentavos ?? 0),
        };
    }
    return {
        sourceType: "attention",
        attentionId: String(lineItem.attentionId),
        attentionFecha: new Date(String(lineItem.attentionFecha)).toISOString(),
        pacienteId: String(lineItem.pacienteId),
        pacienteNombre: String(lineItem.pacienteNombre),
        pacienteDni: String(lineItem.pacienteDni),
        obraSocialId: String(lineItem.obraSocialId),
        obraSocialNombre: String(lineItem.obraSocialNombre),
        codigoObraSocialId: String(lineItem.codigoObraSocialId),
        codigo: String(lineItem.codigo),
        codigoNombre: String(lineItem.codigoNombre),
        pieza: lineItem.pieza ? String(lineItem.pieza) : null,
        estadoAtencionSnapshot: String(lineItem.estadoAtencionSnapshot),
        pagoOdontologoCentavos: Number(lineItem.pagoOdontologoCentavos ?? 0),
        coseguroOdontoCentavos: lineItem.coseguroOdontoCentavos === null ||
            lineItem.coseguroOdontoCentavos === undefined
            ? null
            : Number(lineItem.coseguroOdontoCentavos),
        includesCodePayment: Boolean(lineItem.includesCodePayment),
        includesCoseguroOdontoPayment: Boolean(lineItem.includesCoseguroOdontoPayment),
        totalLineaCentavos: Number(lineItem.totalLineaCentavos ?? 0),
    };
}
async function listPaymentCandidates(query) {
    await (0, mongoose_2.connectToDatabase)();
    const allCandidates = await getAllCandidates(query);
    const skip = (query.page - 1) * query.limit;
    const data = query.all ? allCandidates : allCandidates.slice(skip, skip + query.limit);
    return {
        data,
        pagination: {
            page: query.page,
            limit: query.limit,
            total: allCandidates.length,
            totalPages: Math.max(1, Math.ceil(allCandidates.length / query.limit)),
        },
    };
}
async function listPaymentLookups() {
    await (0, mongoose_2.connectToDatabase)();
    const activeUsers = await user_1.UserModel.find({ activo: true })
        .sort({ apellido: 1, name: 1 })
        .lean();
    const users = activeUsers
        .filter((user) => {
        const roles = String(user.roles ?? "");
        return (roles.includes("odontologo") ||
            roles.includes("ortodoncista") ||
            roles.includes("administrador"));
    })
        .map((user) => ({
        id: String(user._id),
        label: (0, utils_1.normalizeWhitespace)(`${user.apellido ?? ""}, ${user.name}`),
    }));
    const [attentionMonths, orthodonticTreatments] = await Promise.all([
        attention_1.AttentionModel.aggregate([
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
        ]),
        orthodontic_treatment_1.OrthodonticTreatmentModel.find({}, { payments: 1 }).lean(),
    ]);
    const months = new Set(attentionMonths.map((row) => row._id));
    orthodonticTreatments.forEach((treatment) => {
        treatment.payments.forEach((payment) => {
            months.add(getMonthKey(payment.fecha));
        });
    });
    return {
        users,
        months: Array.from(months).sort((left, right) => right.localeCompare(left)),
    };
}
async function listPayments(query) {
    await (0, mongoose_2.connectToDatabase)();
    const match = {};
    if (query.userId) {
        match.usuarioId = new mongoose_1.Types.ObjectId(query.userId);
    }
    if (query.attentionMonth) {
        match.$or = [
            { attentionMonth: query.attentionMonth },
            { attentionMonths: query.attentionMonth },
        ];
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
            lineItems: (payment.lineItems ?? []).map((lineItem) => mapPersistedLineItem(lineItem)),
            totalOrtodonciaCentavos: payment.totalOrtodonciaCentavos ?? 0,
            totalCreditosCentavos: payment.totalCreditosCentavos ?? 0,
            totalDebitosCentavos: payment.totalDebitosCentavos ?? 0,
            totalNetoPagarCentavos: payment.totalNetoPagarCentavos ?? payment.totalHonorariosCentavos,
            debitItems: payment.debitItems ?? [],
            creditItems: payment.creditItems ?? [],
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
    const attentionCollection = connection.connection.db.collection("attentions");
    for (const selection of selectedItems) {
        const lineId = new mongoose_1.Types.ObjectId(selection.lineId);
        if (selection.sourceType === "attention") {
            if (selection.payCode) {
                await attentionCollection.updateOne({
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
                await attentionCollection.updateOne({
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
            continue;
        }
        await orthodontic_treatment_1.OrthodonticTreatmentModel.updateOne({
            "payments._id": lineId,
            "payments.paymentId": paymentId,
        }, {
            $set: {
                "payments.$.paymentStatus": "pendiente",
                "payments.$.paymentId": null,
                "payments.$.paidAt": null,
                "payments.$.updatedAt": new Date(),
            },
        });
    }
    await (0, movimientos_1.deleteMovementByOrigin)("payment", paymentId);
    await payment_1.PaymentModel.deleteOne({ _id: String(paymentId) });
}
async function createPayment(input, currentUserId) {
    await (0, mongoose_2.connectToDatabase)();
    const debitItems = (input.debitItems ?? []).map((item) => ({
        montoCentavos: item.montoCentavos,
        observacion: (0, utils_1.normalizeWhitespace)(item.observacion),
    }));
    const creditItems = (input.creditItems ?? []).map((item) => ({
        montoCentavos: item.montoCentavos,
        observacion: (0, utils_1.normalizeWhitespace)(item.observacion),
    }));
    if (debitItems.some((item) => !Number.isInteger(item.montoCentavos) ||
        item.montoCentavos <= 0 ||
        !item.observacion)) {
        throw new api_1.AppError("VALIDATION_ERROR", "Cada debito debe tener un importe valido y una observacion", 400);
    }
    if (creditItems.some((item) => !Number.isInteger(item.montoCentavos) ||
        item.montoCentavos <= 0 ||
        !item.observacion)) {
        throw new api_1.AppError("VALIDATION_ERROR", "Cada credito debe tener un importe valido y una observacion", 400);
    }
    const normalizedSelection = normalizeSelection(input.selectedItems);
    if (normalizedSelection.length === 0) {
        throw new api_1.AppError("VALIDATION_ERROR", "Debes seleccionar al menos un concepto para liquidar", 400);
    }
    const candidates = await getFreshSelectedCandidates({
        ...input,
        selectedItems: normalizedSelection,
    });
    const candidatesByKey = new Map(candidates.map((item) => [`${item.sourceType}:${item.lineId}`, item]));
    if (candidatesByKey.size !== normalizedSelection.length) {
        throw new api_1.AppError("NOT_FOUND", "Uno o mas conceptos seleccionados ya no estan disponibles para este usuario", 404);
    }
    normalizedSelection.forEach((selection) => {
        const candidate = candidatesByKey.get(`${selection.sourceType}:${selection.lineId}`);
        if (!candidate) {
            throw new api_1.AppError("NOT_FOUND", "Un concepto seleccionado ya no existe", 404);
        }
        if (selection.payCode && !candidate.canPayCode) {
            throw new api_1.AppError("VALIDATION_ERROR", "Uno de los conceptos seleccionados ya no puede liquidarse", 409);
        }
        if (selection.payCoseguroOdonto && !candidate.canPayCoseguroOdonto) {
            throw new api_1.AppError("VALIDATION_ERROR", "Uno de los coseguros odonto seleccionados ya no puede liquidarse", 409);
        }
    });
    const attentionMonths = Array.from(new Set(candidates.map((candidate) => candidate.attentionMonth))).sort((left, right) => right.localeCompare(left));
    const primaryAttentionMonth = attentionMonths[0];
    const summary = buildPaymentSummary(candidates, normalizedSelection, input.userId, primaryAttentionMonth, debitItems, creditItems);
    if (summary.quantityConceptsPaid === 0) {
        throw new api_1.AppError("VALIDATION_ERROR", "No hay conceptos validos para liquidar", 400);
    }
    if (summary.totalNetoPagarCentavos < 0) {
        throw new api_1.AppError("VALIDATION_ERROR", "Los debitos no pueden superar el total de la liquidacion incluyendo creditos", 400);
    }
    const firstCandidate = candidates[0];
    const paymentId = new mongoose_1.Types.ObjectId();
    const paidAt = new Date();
    const lineItems = candidates.map((candidate) => {
        const selection = candidatesByKey.get(`${candidate.sourceType}:${candidate.lineId}`) &&
            normalizedSelection.find((item) => item.sourceType === candidate.sourceType && item.lineId === candidate.lineId);
        if (!selection) {
            throw new api_1.AppError("INTERNAL_ERROR", "No se pudo resolver la seleccion", 500);
        }
        if (candidate.sourceType === "orthodontic-payment") {
            return {
                sourceType: "orthodontic-payment",
                orthodonticTreatmentId: candidate.orthodonticTreatmentId,
                orthodonticPaymentId: candidate.orthodonticPaymentId,
                treatmentStartDate: candidate.attentionFecha,
                paymentDate: candidate.orthodonticPaymentDate,
                treatmentType: candidate.orthodonticTreatmentType,
                patientId: candidate.pacienteId,
                patientName: candidate.pacienteNombreCompleto,
                patientDni: candidate.pacienteDni,
                paymentAmountCentavos: candidate.orthodonticPaymentAmountCentavos ?? 0,
                percentageToOrthodontist: candidate.orthodonticPaymentPercentage ?? 0,
                orthodontistAmountCentavos: candidate.pagoOdontologoCentavos,
                totalLineaCentavos: candidate.pagoOdontologoCentavos,
            };
        }
        const totalLineaCentavos = (selection.payCode ? candidate.pagoOdontologoCentavos : 0) +
            (selection.payCoseguroOdonto ? candidate.coseguroOdontoCentavos ?? 0 : 0);
        return {
            sourceType: "attention",
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
        attentionMonth: primaryAttentionMonth,
        attentionMonths,
        paidAt,
        createdByUserId: new mongoose_1.Types.ObjectId(currentUserId),
        lineItems,
        totalPagoCodigosCentavos: summary.totalPagoCodigosCentavos,
        totalCoseguroOdontoCentavos: summary.totalCoseguroOdontoCentavos,
        totalOrtodonciaCentavos: summary.totalOrtodonciaCentavos,
        totalHonorariosCentavos: summary.totalHonorariosCentavos,
        totalCreditosCentavos: summary.totalCreditosCentavos,
        totalDebitosCentavos: summary.totalDebitosCentavos,
        totalNetoPagarCentavos: summary.totalNetoPagarCentavos,
        quantityConceptsPaid: summary.quantityConceptsPaid,
        debitItems,
        creditItems,
    });
    try {
        const attentionCollection = (await (0, mongoose_2.connectToDatabase)()).connection.db.collection("attentions");
        for (const selection of normalizedSelection) {
            const candidate = candidatesByKey.get(`${selection.sourceType}:${selection.lineId}`);
            if (selection.sourceType === "attention") {
                if (selection.payCode) {
                    await attentionCollection.updateOne({
                        codigos: {
                            $elemMatch: {
                                _id: new mongoose_1.Types.ObjectId(selection.lineId),
                                codePaymentStatus: "pendiente",
                            },
                        },
                    }, {
                        $set: {
                            "codigos.$.codePaymentStatus": "pagado",
                            "codigos.$.codePaymentId": paymentId,
                            "codigos.$.codePaidAt": paidAt,
                        },
                    });
                }
                if (selection.payCoseguroOdonto) {
                    await attentionCollection.updateOne({
                        codigos: {
                            $elemMatch: {
                                _id: new mongoose_1.Types.ObjectId(selection.lineId),
                                coseguroOdontoPaymentStatus: "pendiente",
                            },
                        },
                    }, {
                        $set: {
                            "codigos.$.coseguroOdontoPaymentStatus": "pagado",
                            "codigos.$.coseguroOdontoPaymentId": paymentId,
                            "codigos.$.coseguroOdontoPaidAt": paidAt,
                        },
                    });
                }
                continue;
            }
            await orthodontic_treatment_1.OrthodonticTreatmentModel.updateOne({
                _id: new mongoose_1.Types.ObjectId(candidate.orthodonticTreatmentId),
                "payments._id": new mongoose_1.Types.ObjectId(selection.lineId),
                "payments.paymentStatus": "pendiente",
            }, {
                $set: {
                    "payments.$.paymentStatus": "pagado",
                    "payments.$.paymentId": paymentId,
                    "payments.$.paidAt": paidAt,
                    "payments.$.updatedAt": new Date(),
                },
            });
        }
        await (0, movimientos_1.createPaymentMovement)({
            paymentId,
            paidAt,
            usuarioId: input.userId,
            usuarioNombreSnapshot: firstCandidate.userName,
            attentionMonth: primaryAttentionMonth,
            attentionMonths,
            totalPagoCodigosCentavos: summary.totalPagoCodigosCentavos,
            totalCoseguroOdontoCentavos: summary.totalCoseguroOdontoCentavos,
            totalOrtodonciaCentavos: summary.totalOrtodonciaCentavos,
            totalHonorariosCentavos: summary.totalHonorariosCentavos,
            totalCreditosCentavos: summary.totalCreditosCentavos,
            totalDebitosCentavos: summary.totalDebitosCentavos,
            totalNetoPagarCentavos: summary.totalNetoPagarCentavos,
            quantityConceptsPaid: summary.quantityConceptsPaid,
            debitItems,
            creditItems,
            createdByUserId: currentUserId,
        });
    }
    catch (error) {
        await rollbackPaymentOperation(paymentId, normalizedSelection);
        throw error;
    }
    const created = await payment_1.PaymentModel.findById(paymentId).lean();
    if (!created) {
        throw new api_1.AppError("INTERNAL_ERROR", "No se pudo recuperar el pago creado", 500);
    }
    return toPaymentDto({
        ...created,
        lineItems: (created.lineItems ?? []).map((lineItem) => mapPersistedLineItem(lineItem)),
        totalOrtodonciaCentavos: created.totalOrtodonciaCentavos ?? 0,
        totalCreditosCentavos: created.totalCreditosCentavos ?? 0,
        totalDebitosCentavos: created.totalDebitosCentavos ?? 0,
        totalNetoPagarCentavos: created.totalNetoPagarCentavos ?? created.totalHonorariosCentavos,
        debitItems: created.debitItems ?? [],
        creditItems: created.creditItems ?? [],
    });
}
