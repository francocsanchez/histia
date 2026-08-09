import { Types } from "mongoose";

import { attentionStatusLabels } from "@/lib/attention-status";
import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { normalizeWhitespace } from "@/lib/utils";
import { AttentionModel } from "@/models/attention";
import { MovementModel } from "@/models/movement";
import { PacienteModel } from "@/models/paciente";
import { RxAttentionModel } from "@/models/rx-attention";
import { UserModel } from "@/models/user";
import { listAttentionAssignableUsers } from "@/services/atenciones";
import {
  AdminDashboardDto,
  attentionCodeStatusValues,
  DashboardMonthlyStatsDto,
  SessionUser,
} from "@/types/domain";

const BUSINESS_TIMEZONE = "America/Argentina/Buenos_Aires";

function isAdmin(user: SessionUser) {
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

function parseMonth(month?: string) {
  const value = month?.trim() || getCurrentMonth();

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "El mes debe tener formato YYYY-MM",
      400,
      { month: "El mes debe tener formato YYYY-MM" },
    );
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

function parseYear(year?: string) {
  const fallback = getCurrentYear();
  const value = year?.trim() || String(fallback);

  if (!/^\d{4}$/.test(value)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "El anio debe tener formato YYYY",
      400,
      { year: "El anio debe tener formato YYYY" },
    );
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

async function resolveDashboardUser(
  currentUser: SessionUser,
  requestedUserId?: string,
) {
  if (!isAdmin(currentUser)) {
    return {
      id: currentUser.id,
      nombreCompleto: normalizeWhitespace(`${currentUser.apellido}, ${currentUser.nombre}`),
      availableUsers: [] as DashboardMonthlyStatsDto["availableUsers"],
    };
  }

  const availableUsers = await listAttentionAssignableUsers();
  const fallbackUserId = availableUsers[0]?.id ?? currentUser.id;
  const targetUserId = requestedUserId?.trim() || currentUser.id || fallbackUserId;

  const selectedOption =
    availableUsers.find((user) => user.id === targetUserId) ??
    availableUsers.find((user) => user.id === currentUser.id) ??
    availableUsers[0];

  if (!selectedOption) {
    return {
      id: currentUser.id,
      nombreCompleto: normalizeWhitespace(`${currentUser.apellido}, ${currentUser.nombre}`),
      availableUsers: [],
    };
  }

  const selectedUser = await UserModel.findById(selectedOption.id).lean();

  if (!selectedUser || !selectedUser.activo) {
    throw new AppError("NOT_FOUND", "El usuario seleccionado no existe", 404);
  }

  return {
    id: String(selectedUser._id),
    nombreCompleto: normalizeWhitespace(
      `${selectedUser.apellido ?? ""}, ${selectedUser.name}`,
    ),
    availableUsers,
  };
}

export async function getDashboardMonthlyStats(params: {
  currentUser: SessionUser;
  month?: string;
  userId?: string;
}): Promise<DashboardMonthlyStatsDto> {
  await connectToDatabase();

  const month = parseMonth(params.month);
  const selectedUser = await resolveDashboardUser(params.currentUser, params.userId);
  const match = {
    usuarioCargaId: new Types.ObjectId(selectedUser.id),
    fecha: {
      $gte: month.start,
      $lte: month.end,
    },
  };

  const [dailyRows, statusRows, totalRows] = await Promise.all([
    AttentionModel.aggregate<{ _id: number; total: number }>([
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
    AttentionModel.aggregate<{ _id: string; total: number }>([
      { $match: match },
      { $unwind: "$codigos" },
      {
        $group: {
          _id: "$codigos.estado",
          total: { $sum: 1 },
        },
      },
    ]),
    AttentionModel.aggregate<{ _id: null; atenciones: number; codigos: number }>([
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
    statusSummary: attentionCodeStatusValues.map((status) => ({
      status,
      label: attentionStatusLabels[status],
      total: statusMap.get(status) ?? 0,
    })),
    totals: {
      atenciones: totals.atenciones,
      codigos: totals.codigos,
    },
  };
}

export async function getAdminDashboardStats(params: {
  currentUser: SessionUser;
  year?: string;
  month?: string;
}): Promise<AdminDashboardDto> {
  await connectToDatabase();

  if (!isAdmin(params.currentUser)) {
    throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
  }

  const year = parseYear(params.year);
  const month = parseMonth(params.month);
  const monthLabels = getMonthLabels();

  const [
    pacientesActivos,
    odontologosActivos,
    balanceRows,
    patientsByObraSocialRows,
    attentionsByMonthRows,
    rxByMonthRows,
    movementsByMonthRows,
    incomeByTypeRows,
    expenseByTypeRows,
    codesByStatusRows,
    dentistPerformanceRows,
    attentionYearRows,
    movementYearRows,
    attentionMonthRows,
  ] = await Promise.all([
    PacienteModel.countDocuments({ activo: true }),
    UserModel.countDocuments({
      activo: true,
      roles: { $regex: /(^|,)odontologo(,|$)/ },
    }),
    MovementModel.aggregate<{ _id: string; total: number }>([
      {
        $group: {
          _id: "$direccion",
          total: { $sum: "$montoCentavos" },
        },
      },
    ]),
    PacienteModel.aggregate<{
      _id: Types.ObjectId | null;
      total: number;
      obraSocialNombre?: string;
    }>([
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
    AttentionModel.aggregate<{ _id: number; total: number }>([
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
    RxAttentionModel.aggregate<{ _id: number; total: number }>([
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
    MovementModel.aggregate<{
      _id: { month: number; direction: string };
      total: number;
    }>([
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
    MovementModel.aggregate<{
      _id: { typeId: Types.ObjectId | null; type: string };
      total: number;
    }>([
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
    MovementModel.aggregate<{
      _id: { typeId: Types.ObjectId | null; type: string };
      total: number;
    }>([
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
    AttentionModel.aggregate<{ _id: string; total: number }>([
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
    AttentionModel.aggregate<{
      _id: { userId: Types.ObjectId; status: string };
      total: number;
      nombre: string;
      apellido: string;
    }>([
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
    AttentionModel.aggregate<{ _id: string }>([
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
    MovementModel.aggregate<{ _id: string }>([
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
    AttentionModel.aggregate<{ _id: string }>([
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
  const attentionMonthMap = new Map(attentionsByMonthRows.map((row) => [row._id, row.total]));
  const rxMonthMap = new Map(rxByMonthRows.map((row) => [row._id, row.total]));
  const codeStatusMap = new Map(codesByStatusRows.map((row) => [row._id, row.total]));
  const movementMonthMap = new Map(
    movementsByMonthRows.map((row) => [`${row._id.month}-${row._id.direction}`, row.total]),
  );
  const availableYears = Array.from(
    new Set(
      [...attentionYearRows, ...movementYearRows]
        .map((row) => Number(row._id))
        .filter((value) => Number.isFinite(value)),
    ),
  ).sort((left, right) => right - left);

  if (availableYears.length === 0) {
    availableYears.push(getCurrentYear());
  }

  const availableMonths = attentionMonthRows.map((row) => row._id);

  if (availableMonths.length === 0) {
    availableMonths.push(getCurrentMonth());
  }

  const dentistMap = new Map<
    string,
    {
      userId: string;
      nombreCompleto: string;
      total: number;
      statuses: Map<string, number>;
    }
  >();

  dentistPerformanceRows.forEach((row) => {
    const userId = String(row._id.userId);
    const existing =
      dentistMap.get(userId) ??
      {
        userId,
        nombreCompleto: normalizeWhitespace(
          `${row.apellido ?? ""}, ${row.nombre ?? ""}`,
        ),
        total: 0,
        statuses: new Map<string, number>(),
      };

    existing.total += row.total;
    existing.statuses.set(row._id.status, row.total);
    dentistMap.set(userId, existing);
  });

  return {
    year: year.value,
    month: month.value,
    availableYears,
    availableMonths,
    summary: {
      pacientesActivos,
      odontologosActivos,
      balanceTotalCentavos:
        (balanceMap.get("ingreso") ?? 0) - (balanceMap.get("egreso") ?? 0),
    },
    patientsByObraSocial: patientsByObraSocialRows
      .map((row) => ({
        id: row._id ? String(row._id) : "sin-obra-social",
        label: row.obraSocialNombre?.trim() || "Sin obra social",
        total: row.total,
      }))
      .sort((left, right) => right.total - left.total),
    attentionsByMonth: monthLabels.map((label, index) => ({
      month: index + 1,
      label,
      total: attentionMonthMap.get(index + 1) ?? 0,
    })),
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
    codesByStatus: attentionCodeStatusValues.map((status) => ({
      status,
      label: attentionStatusLabels[status],
      total: codeStatusMap.get(status) ?? 0,
    })),
    dentistPerformanceByMonth: Array.from(dentistMap.values())
      .map((item) => ({
        userId: item.userId,
        nombreCompleto: item.nombreCompleto,
        total: item.total,
        statuses: attentionCodeStatusValues.map((status) => ({
          status,
          label: attentionStatusLabels[status],
          total: item.statuses.get(status) ?? 0,
        })),
      }))
      .sort((left, right) => right.total - left.total),
  };
}
