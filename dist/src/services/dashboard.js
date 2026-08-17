"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardMonthlyStats = getDashboardMonthlyStats;
exports.getAdminDashboardStats = getAdminDashboardStats;
const mongoose_1 = require("mongoose");
const attention_status_1 = require("@/lib/attention-status");
const api_1 = require("@/lib/api");
const mongoose_2 = require("@/lib/db/mongoose");
const utils_1 = require("@/lib/utils");
const attention_1 = require("@/models/attention");
const movement_1 = require("@/models/movement");
const paciente_1 = require("@/models/paciente");
const rx_attention_1 = require("@/models/rx-attention");
const user_1 = require("@/models/user");
const atenciones_1 = require("@/services/atenciones");
const domain_1 = require("@/types/domain");
const BUSINESS_TIMEZONE = "America/Argentina/Buenos_Aires";
const DOLAR_API_OFICIAL_URL = "https://dolarapi.com/v1/dolares/oficial";
function isAdmin(user) {
    return user.roles.includes("administrador");
}
function getCurrentMonth() {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    return `${now.getFullYear()}-${month}`;
}
function getCurrentYear() {
    return new Date().getFullYear();
}
function parseMonth(month) {
    const value = month?.trim() || getCurrentMonth();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
        throw new api_1.AppError("VALIDATION_ERROR", "El mes debe tener formato YYYY-MM", 400, { month: "El mes debe tener formato YYYY-MM" });
    }
    const [yearValue, monthValue] = value.split("-");
    const year = Number(yearValue);
    const monthIndex = Number(monthValue) - 1;
    return {
        value,
        year,
        monthIndex,
        start: new Date(year, monthIndex, 1, 0, 0, 0, 0),
        end: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
        totalDays: new Date(year, monthIndex + 1, 0).getDate(),
    };
}
function parseYear(year) {
    const fallback = getCurrentYear();
    const value = year?.trim() || String(fallback);
    if (!/^\d{4}$/.test(value)) {
        throw new api_1.AppError("VALIDATION_ERROR", "El anio debe tener formato YYYY", 400, { year: "El anio debe tener formato YYYY" });
    }
    const numericYear = Number(value);
    return {
        value: numericYear,
        start: new Date(numericYear, 0, 1, 0, 0, 0, 0),
        end: new Date(numericYear, 11, 31, 23, 59, 59, 999),
    };
}
function getMonthLabels() {
    return [
        "Ene",
        "Feb",
        "Mar",
        "Abr",
        "May",
        "Jun",
        "Jul",
        "Ago",
        "Sep",
        "Oct",
        "Nov",
        "Dic",
    ];
}
async function getOfficialDollarVenta() {
    try {
        const response = await fetch(DOLAR_API_OFICIAL_URL, {
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
            return null;
        }
        const payload = (await response.json());
        const venta = payload.venta;
        if (typeof venta !== "number" || !Number.isFinite(venta) || venta <= 0) {
            return null;
        }
        return venta;
    }
    catch {
        return null;
    }
}
async function resolveDashboardUser(currentUser, requestedUserId) {
    if (!isAdmin(currentUser)) {
        return {
            id: currentUser.id,
            nombreCompleto: (0, utils_1.normalizeWhitespace)(`${currentUser.apellido}, ${currentUser.nombre}`),
            availableUsers: [],
        };
    }
    const availableUsers = await (0, atenciones_1.listAttentionAssignableUsers)();
    const fallbackUserId = availableUsers[0]?.id ?? currentUser.id;
    const targetUserId = requestedUserId?.trim() || currentUser.id || fallbackUserId;
    const selectedOption = availableUsers.find((user) => user.id === targetUserId) ??
        availableUsers.find((user) => user.id === currentUser.id) ??
        availableUsers[0];
    if (!selectedOption) {
        return {
            id: currentUser.id,
            nombreCompleto: (0, utils_1.normalizeWhitespace)(`${currentUser.apellido}, ${currentUser.nombre}`),
            availableUsers: [],
        };
    }
    const selectedUser = await user_1.UserModel.findById(selectedOption.id).lean();
    if (!selectedUser || !selectedUser.activo) {
        throw new api_1.AppError("NOT_FOUND", "El usuario seleccionado no existe", 404);
    }
    return {
        id: String(selectedUser._id),
        nombreCompleto: (0, utils_1.normalizeWhitespace)(`${selectedUser.apellido ?? ""}, ${selectedUser.name}`),
        availableUsers,
    };
}
async function getDashboardMonthlyStats(params) {
    await (0, mongoose_2.connectToDatabase)();
    const month = parseMonth(params.month);
    const selectedUser = await resolveDashboardUser(params.currentUser, params.userId);
    const match = {
        usuarioCargaId: new mongoose_1.Types.ObjectId(selectedUser.id),
        fecha: {
            $gte: month.start,
            $lte: month.end,
        },
    };
    const [dailyRows, statusRows, totalRows] = await Promise.all([
        attention_1.AttentionModel.aggregate([
            { $match: match },
            {
                $group: {
                    _id: {
                        $dayOfMonth: {
                            date: "$fecha",
                            timezone: BUSINESS_TIMEZONE,
                        },
                    },
                    total: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        attention_1.AttentionModel.aggregate([
            { $match: match },
            { $unwind: "$codigos" },
            {
                $group: {
                    _id: "$codigos.estado",
                    total: { $sum: 1 },
                },
            },
        ]),
        attention_1.AttentionModel.aggregate([
            { $match: match },
            {
                $project: {
                    cantidadCodigos: { $size: "$codigos" },
                },
            },
            {
                $group: {
                    _id: null,
                    atenciones: { $sum: 1 },
                    codigos: { $sum: "$cantidadCodigos" },
                },
            },
        ]),
    ]);
    const dailyMap = new Map(dailyRows.map((row) => [row._id, row.total]));
    const statusMap = new Map(statusRows.map((row) => [row._id, row.total]));
    const totals = totalRows[0] ?? { _id: null, atenciones: 0, codigos: 0 };
    return {
        month: month.value,
        selectedUser: {
            id: selectedUser.id,
            nombreCompleto: selectedUser.nombreCompleto,
        },
        availableUsers: selectedUser.availableUsers,
        dailyAttentions: Array.from({ length: month.totalDays }, (_, index) => {
            const day = index + 1;
            const date = new Date(month.year, month.monthIndex, day);
            const monthValue = `${month.monthIndex + 1}`.padStart(2, "0");
            const dayValue = `${day}`.padStart(2, "0");
            return {
                day,
                date: `${date.getFullYear()}-${monthValue}-${dayValue}`,
                total: dailyMap.get(day) ?? 0,
            };
        }),
        statusSummary: domain_1.attentionCodeStatusValues.map((status) => ({
            status,
            label: attention_status_1.attentionStatusLabels[status],
            total: statusMap.get(status) ?? 0,
        })),
        totals: {
            atenciones: totals.atenciones,
            codigos: totals.codigos,
        },
    };
}
async function getAdminDashboardStats(params) {
    await (0, mongoose_2.connectToDatabase)();
    if (!isAdmin(params.currentUser)) {
        throw new api_1.AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }
    const year = parseYear(params.year);
    const month = parseMonth(params.month);
    const monthLabels = getMonthLabels();
    const [pacientesActivos, odontologosActivos, dolarOficialVenta, balanceRows, patientsByObraSocialRows, attentionsByMonthRows, rxByMonthRows, movementsByMonthRows, incomeByTypeRows, expenseByTypeRows, codesByStatusRows, dentistPerformanceRows, attentionYearRows, movementYearRows, attentionMonthRows,] = await Promise.all([
        paciente_1.PacienteModel.countDocuments({ activo: true }),
        user_1.UserModel.countDocuments({
            activo: true,
            roles: { $regex: /(^|,)odontologo(,|$)/ },
        }),
        getOfficialDollarVenta(),
        movement_1.MovementModel.aggregate([
            {
                $group: {
                    _id: "$direccion",
                    total: { $sum: "$montoCentavos" },
                },
            },
        ]),
        paciente_1.PacienteModel.aggregate([
            { $match: { activo: true } },
            {
                $lookup: {
                    from: "obras_sociales",
                    localField: "obraSocialId",
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
                $group: {
                    _id: "$obraSocialId",
                    total: { $sum: 1 },
                    obraSocialNombre: { $first: "$obraSocial.nombre" },
                },
            },
        ]),
        attention_1.AttentionModel.aggregate([
            {
                $match: {
                    fecha: {
                        $gte: year.start,
                        $lte: year.end,
                    },
                },
            },
            {
                $lookup: {
                    from: "obras_sociales",
                    localField: "obraSocialId",
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
                $group: {
                    _id: {
                        month: {
                            $month: {
                                date: "$fecha",
                                timezone: BUSINESS_TIMEZONE,
                            },
                        },
                        obraSocialId: "$obraSocialId",
                    },
                    total: { $sum: 1 },
                    obraSocialNombre: { $first: "$obraSocial.nombre" },
                },
            },
            { $sort: { "_id.month": 1, obraSocialNombre: 1 } },
        ]),
        rx_attention_1.RxAttentionModel.aggregate([
            {
                $match: {
                    fecha: {
                        $gte: year.start,
                        $lte: year.end,
                    },
                },
            },
            {
                $group: {
                    _id: {
                        $month: {
                            date: "$fecha",
                            timezone: BUSINESS_TIMEZONE,
                        },
                    },
                    total: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        movement_1.MovementModel.aggregate([
            {
                $match: {
                    fecha: {
                        $gte: year.start,
                        $lte: year.end,
                    },
                },
            },
            {
                $group: {
                    _id: {
                        month: {
                            $month: {
                                date: "$fecha",
                                timezone: BUSINESS_TIMEZONE,
                            },
                        },
                        direction: "$direccion",
                    },
                    total: { $sum: "$montoCentavos" },
                },
            },
            { $sort: { "_id.month": 1 } },
        ]),
        movement_1.MovementModel.aggregate([
            {
                $match: {
                    direccion: "ingreso",
                    fecha: {
                        $gte: year.start,
                        $lte: year.end,
                    },
                },
            },
            {
                $group: {
                    _id: {
                        typeId: "$tipoMovimientoId",
                        type: "$tipo",
                    },
                    total: { $sum: "$montoCentavos" },
                },
            },
            { $sort: { total: -1 } },
        ]),
        movement_1.MovementModel.aggregate([
            {
                $match: {
                    direccion: "egreso",
                    fecha: {
                        $gte: year.start,
                        $lte: year.end,
                    },
                },
            },
            {
                $group: {
                    _id: {
                        typeId: "$tipoMovimientoId",
                        type: "$tipo",
                    },
                    total: { $sum: "$montoCentavos" },
                },
            },
            { $sort: { total: -1 } },
        ]),
        attention_1.AttentionModel.aggregate([
            {
                $match: {
                    fecha: {
                        $gte: year.start,
                        $lte: year.end,
                    },
                },
            },
            { $unwind: "$codigos" },
            {
                $group: {
                    _id: "$codigos.estado",
                    total: { $sum: 1 },
                },
            },
        ]),
        attention_1.AttentionModel.aggregate([
            {
                $match: {
                    fecha: {
                        $gte: month.start,
                        $lte: month.end,
                    },
                },
            },
            { $unwind: "$codigos" },
            {
                $lookup: {
                    from: "users",
                    localField: "usuarioCargaId",
                    foreignField: "_id",
                    as: "usuario",
                },
            },
            {
                $unwind: {
                    path: "$usuario",
                    preserveNullAndEmptyArrays: false,
                },
            },
            {
                $group: {
                    _id: {
                        userId: "$usuarioCargaId",
                        status: "$codigos.estado",
                    },
                    total: { $sum: 1 },
                    nombre: { $first: "$usuario.name" },
                    apellido: { $first: "$usuario.apellido" },
                },
            },
        ]),
        attention_1.AttentionModel.aggregate([
            {
                $project: {
                    year: {
                        $dateToString: {
                            format: "%Y",
                            date: "$fecha",
                            timezone: BUSINESS_TIMEZONE,
                        },
                    },
                },
            },
            { $group: { _id: "$year" } },
            { $sort: { _id: -1 } },
        ]),
        movement_1.MovementModel.aggregate([
            {
                $project: {
                    year: {
                        $dateToString: {
                            format: "%Y",
                            date: "$fecha",
                            timezone: BUSINESS_TIMEZONE,
                        },
                    },
                },
            },
            { $group: { _id: "$year" } },
            { $sort: { _id: -1 } },
        ]),
        attention_1.AttentionModel.aggregate([
            {
                $project: {
                    month: {
                        $dateToString: {
                            format: "%Y-%m",
                            date: "$fecha",
                            timezone: BUSINESS_TIMEZONE,
                        },
                    },
                },
            },
            { $group: { _id: "$month" } },
            { $sort: { _id: -1 } },
        ]),
    ]);
    const balanceMap = new Map(balanceRows.map((row) => [row._id, row.total]));
    const balanceTotalCentavos = (balanceMap.get("ingreso") ?? 0) - (balanceMap.get("egreso") ?? 0);
    const rxMonthMap = new Map(rxByMonthRows.map((row) => [row._id, row.total]));
    const codeStatusMap = new Map(codesByStatusRows.map((row) => [row._id, row.total]));
    const movementMonthMap = new Map(movementsByMonthRows.map((row) => [`${row._id.month}-${row._id.direction}`, row.total]));
    const availableYears = Array.from(new Set([...attentionYearRows, ...movementYearRows]
        .map((row) => Number(row._id))
        .filter((value) => Number.isFinite(value)))).sort((left, right) => right - left);
    if (availableYears.length === 0) {
        availableYears.push(getCurrentYear());
    }
    const availableMonths = attentionMonthRows.map((row) => row._id);
    if (availableMonths.length === 0) {
        availableMonths.push(getCurrentMonth());
    }
    const dentistMap = new Map();
    dentistPerformanceRows.forEach((row) => {
        const userId = String(row._id.userId);
        const existing = dentistMap.get(userId) ??
            {
                userId,
                nombreCompleto: (0, utils_1.normalizeWhitespace)(`${row.apellido ?? ""}, ${row.nombre ?? ""}`),
                total: 0,
                statuses: new Map(),
            };
        existing.total += row.total;
        existing.statuses.set(row._id.status, row.total);
        dentistMap.set(userId, existing);
    });
    const attentionsByMonthMap = new Map();
    attentionsByMonthRows.forEach((row) => {
        const monthValue = row._id.month;
        const currentMonthRows = attentionsByMonthMap.get(monthValue) ?? [];
        currentMonthRows.push({
            id: row._id.obraSocialId ? String(row._id.obraSocialId) : "sin-obra-social",
            label: row.obraSocialNombre?.trim() || "Sin obra social",
            total: row.total,
        });
        attentionsByMonthMap.set(monthValue, currentMonthRows);
    });
    return {
        year: year.value,
        month: month.value,
        availableYears,
        availableMonths,
        summary: {
            pacientesActivos,
            odontologosActivos,
            balanceTotalCentavos,
            balanceTotalUsd: dolarOficialVenta !== null ? balanceTotalCentavos / 100 / dolarOficialVenta : null,
        },
        patientsByObraSocial: patientsByObraSocialRows
            .map((row) => ({
            id: row._id ? String(row._id) : "sin-obra-social",
            label: row.obraSocialNombre?.trim() || "Sin obra social",
            total: row.total,
        }))
            .sort((left, right) => right.total - left.total),
        attentionsByMonth: monthLabels.map((label, index) => {
            const monthValue = index + 1;
            const segments = (attentionsByMonthMap.get(monthValue) ?? []).sort((left, right) => right.total - left.total);
            return {
                month: monthValue,
                label,
                total: segments.reduce((sum, item) => sum + item.total, 0),
                segments,
            };
        }),
        rxByMonth: monthLabels.map((label, index) => ({
            month: index + 1,
            label,
            total: rxMonthMap.get(index + 1) ?? 0,
        })),
        movementsByMonth: monthLabels.map((label, index) => ({
            month: index + 1,
            label,
            ingresosCentavos: movementMonthMap.get(`${index + 1}-ingreso`) ?? 0,
            egresosCentavos: movementMonthMap.get(`${index + 1}-egreso`) ?? 0,
        })),
        incomeByMovementType: incomeByTypeRows.map((row) => ({
            id: row._id.typeId ? String(row._id.typeId) : row._id.type,
            label: row._id.type,
            total: row.total,
        })),
        expenseByMovementType: expenseByTypeRows.map((row) => ({
            id: row._id.typeId ? String(row._id.typeId) : row._id.type,
            label: row._id.type,
            total: row.total,
        })),
        codesByStatus: domain_1.attentionCodeStatusValues.map((status) => ({
            status,
            label: attention_status_1.attentionStatusLabels[status],
            total: codeStatusMap.get(status) ?? 0,
        })),
        dentistPerformanceByMonth: Array.from(dentistMap.values())
            .map((item) => ({
            userId: item.userId,
            nombreCompleto: item.nombreCompleto,
            total: item.total,
            statuses: domain_1.attentionCodeStatusValues.map((status) => ({
                status,
                label: attention_status_1.attentionStatusLabels[status],
                total: item.statuses.get(status) ?? 0,
            })),
        }))
            .sort((left, right) => right.total - left.total),
    };
}
