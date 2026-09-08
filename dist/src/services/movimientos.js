"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMovements = listMovements;
exports.createManualMovement = createManualMovement;
exports.updateMovementDetails = updateMovementDetails;
exports.createPaymentMovement = createPaymentMovement;
exports.deleteMovementByOrigin = deleteMovementByOrigin;
const mongoose_1 = require("mongoose");
const api_1 = require("@/lib/api");
const mongoose_2 = require("@/lib/db/mongoose");
const movement_1 = require("@/lib/movement");
const utils_1 = require("@/lib/utils");
const movement_2 = require("@/models/movement");
const tipos_movimientos_1 = require("@/services/tipos-movimientos");
function buildMovementMatch(query) {
    const match = {};
    const dateFrom = parseOptionalDate(query.dateFrom);
    const dateTo = parseOptionalDate(query.dateTo, { endOfDay: true });
    if (dateFrom || dateTo) {
        match.fecha = {};
        if (dateFrom) {
            match.fecha.$gte = dateFrom;
        }
        if (dateTo) {
            match.fecha.$lte = dateTo;
        }
    }
    if (query.direction) {
        match.direccion = query.direction;
    }
    if (query.typeId) {
        match.tipoMovimientoId = new mongoose_1.Types.ObjectId(query.typeId);
    }
    return match;
}
function toMovementDto(movement) {
    return {
        id: String(movement._id),
        fecha: movement.fecha.toISOString(),
        descripcion: movement.descripcion,
        direccion: movement.direccion,
        tipoMovimientoId: movement.tipoMovimientoId ? String(movement.tipoMovimientoId) : null,
        tipo: movement.tipo,
        montoCentavos: movement.montoCentavos,
        origenTipo: movement.origenTipo,
        origenId: movement.origenId ? String(movement.origenId) : null,
        creadoAutomaticamente: movement.creadoAutomaticamente,
        metadata: movement.metadata,
        createdByUserId: String(movement.createdByUserId),
        createdAt: movement.createdAt.toISOString(),
        updatedAt: movement.updatedAt.toISOString(),
    };
}
function parseOptionalDate(value, options) {
    if (!value) {
        return undefined;
    }
    try {
        return (0, utils_1.parseDateOnlyAsUtc)(value, options);
    }
    catch {
        throw new api_1.AppError("VALIDATION_ERROR", "La fecha debe tener formato YYYY-MM-DD", 400, { [options?.endOfDay ? "dateTo" : "dateFrom"]: "La fecha debe tener formato YYYY-MM-DD" });
    }
}
async function listMovements(query) {
    await (0, mongoose_2.connectToDatabase)();
    const match = buildMovementMatch(query);
    const skip = (query.page - 1) * query.limit;
    const [items, total, summaryRows] = await Promise.all([
        movement_2.MovementModel.find(match)
            .sort({ fecha: -1, createdAt: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        movement_2.MovementModel.countDocuments(match),
        movement_2.MovementModel.aggregate([
            { $match: match },
            {
                $group: {
                    _id: "$direccion",
                    total: { $sum: "$montoCentavos" },
                },
            },
        ]),
    ]);
    const summary = {
        ingresosCentavos: 0,
        egresosCentavos: 0,
        saldoCentavos: 0,
    };
    summaryRows.forEach((row) => {
        if (row._id === "ingreso") {
            summary.ingresosCentavos = row.total;
        }
        if (row._id === "egreso") {
            summary.egresosCentavos = row.total;
        }
    });
    summary.saldoCentavos =
        summary.ingresosCentavos - summary.egresosCentavos;
    return {
        data: items.map(toMovementDto),
        summary,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    };
}
async function createManualMovement(input, currentUserId) {
    await (0, mongoose_2.connectToDatabase)();
    const movementType = await (0, tipos_movimientos_1.getMovementTypeById)(input.movementTypeId, {
        requireActive: true,
    });
    const movement = await movement_2.MovementModel.create({
        fecha: (0, utils_1.parseDateOnlyAsUtc)(input.fecha),
        descripcion: input.descripcion?.trim()
            ? (0, utils_1.normalizeWhitespace)(input.descripcion)
            : null,
        direccion: movementType.direccion,
        tipoMovimientoId: new mongoose_1.Types.ObjectId(movementType.id),
        tipo: movementType.nombre,
        montoCentavos: input.montoCentavos,
        origenTipo: "manual",
        origenId: null,
        creadoAutomaticamente: false,
        metadata: null,
        createdByUserId: new mongoose_1.Types.ObjectId(currentUserId),
    });
    return toMovementDto(movement.toObject());
}
async function updateMovementDetails(movementId, input) {
    await (0, mongoose_2.connectToDatabase)();
    const movement = await movement_2.MovementModel.findById(movementId);
    if (!movement) {
        throw new api_1.AppError("NOT_FOUND", "Movimiento no encontrado", 404);
    }
    const movementType = await (0, tipos_movimientos_1.getMovementTypeById)(input.movementTypeId, {
        requireActive: true,
    });
    if (movementType.direccion !== movement.direccion) {
        throw new api_1.AppError("VALIDATION_ERROR", "El concepto debe coincidir con la direccion del movimiento", 409, { movementTypeId: "El concepto debe coincidir con la direccion del movimiento" });
    }
    movement.tipoMovimientoId = new mongoose_1.Types.ObjectId(movementType.id);
    movement.tipo = movementType.nombre;
    movement.descripcion = input.descripcion?.trim()
        ? (0, utils_1.normalizeWhitespace)(input.descripcion)
        : null;
    await movement.save();
    return toMovementDto(movement.toObject());
}
async function createPaymentMovement(input) {
    await (0, mongoose_2.connectToDatabase)();
    const movementType = await (0, tipos_movimientos_1.getSystemMovementType)("payment-honorarios");
    const metadata = {
        kind: "payment",
        paymentId: String(input.paymentId),
        usuarioId: input.usuarioId,
        usuarioNombreSnapshot: input.usuarioNombreSnapshot,
        attentionMonth: input.attentionMonth,
        attentionMonths: input.attentionMonths,
        totalPagoCodigosCentavos: input.totalPagoCodigosCentavos,
        totalCoseguroOdontoCentavos: input.totalCoseguroOdontoCentavos,
        totalOrtodonciaCentavos: input.totalOrtodonciaCentavos,
        totalHonorariosCentavos: input.totalHonorariosCentavos,
        totalCreditosCentavos: input.totalCreditosCentavos,
        totalDebitosCentavos: input.totalDebitosCentavos,
        totalNetoPagarCentavos: input.totalNetoPagarCentavos,
        quantityConceptsPaid: input.quantityConceptsPaid,
        debitItems: input.debitItems,
        creditItems: input.creditItems,
    };
    try {
        const movement = await movement_2.MovementModel.create({
            fecha: input.paidAt,
            descripcion: (0, movement_1.buildPaymentMovementDescription)(input.usuarioNombreSnapshot, input.attentionMonths.join(", ")),
            direccion: movementType.direccion,
            tipoMovimientoId: new mongoose_1.Types.ObjectId(movementType.id),
            tipo: movementType.nombre,
            montoCentavos: input.totalNetoPagarCentavos,
            origenTipo: "payment",
            origenId: input.paymentId,
            creadoAutomaticamente: true,
            metadata,
            createdByUserId: new mongoose_1.Types.ObjectId(input.createdByUserId),
        });
        return toMovementDto(movement.toObject());
    }
    catch (error) {
        if (error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === 11000) {
            const existing = await movement_2.MovementModel.findOne({
                origenTipo: "payment",
                origenId: input.paymentId,
            }).lean();
            if (existing) {
                return toMovementDto(existing);
            }
        }
        throw error;
    }
}
async function deleteMovementByOrigin(originType, originId) {
    await (0, mongoose_2.connectToDatabase)();
    await movement_2.MovementModel.deleteOne({ origenTipo: originType, origenId: originId });
}
