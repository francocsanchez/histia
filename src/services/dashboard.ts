import { Types } from "mongoose";

import { attentionStatusLabels } from "@/lib/attention-status";
import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { normalizeWhitespace } from "@/lib/utils";
import { AttentionModel } from "@/models/attention";
import { UserModel } from "@/models/user";
import { listAttentionAssignableUsers } from "@/services/atenciones";
import {
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
