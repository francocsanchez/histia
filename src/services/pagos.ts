import { PipelineStage, Types } from "mongoose";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { normalizeWhitespace } from "@/lib/utils";
import { AttentionModel } from "@/models/attention";
import { PaymentModel } from "@/models/payment";
import { UserModel } from "@/models/user";
import {
  AttentionCodeStatus,
  PaymentCandidateLineDto,
  PaymentCandidateSelectionDto,
  PaymentDto,
  PaymentLineItemDto,
  PaymentSummaryDto,
} from "@/types/domain";

const APP_TIMEZONE = "America/Argentina/Buenos_Aires";

type PaymentCandidateQuery = {
  page: number;
  limit: number;
  userId?: string;
  attentionMonth?: string;
  attentionStatus?: AttentionCodeStatus;
  search?: string;
};

type PaymentCreateInput = {
  userId: string;
  attentionMonth: string;
  selectedItems: PaymentCandidateSelectionDto[];
};

type PaymentHistoryQuery = {
  page: number;
  limit: number;
  userId?: string;
  attentionMonth?: string;
};

type PaymentCandidateRow = {
  attentionId: unknown;
  attentionFecha: Date;
  attentionMonth: string;
  userId: unknown;
  userName: string;
  pacienteId: unknown;
  pacienteNombreCompleto: string;
  pacienteDni: string;
  obraSocialId: unknown;
  obraSocialNombre: string;
  lineId: unknown;
  codigoObraSocialId: unknown;
  codigo: string;
  codigoNombre: string;
  pieza: string | null;
  estado: AttentionCodeStatus;
  pagoOdontologoCentavos: number;
  coseguroOdontoCentavos: number | null;
  codePaymentStatus: "pendiente" | "pagado";
  coseguroOdontoPaymentStatus: "pendiente" | "pagado";
};

function getMonthRangeFromKey(monthKey: string) {
  const [yearValue, monthValue] = monthKey.split("-");
  const year = Number(yearValue);
  const monthIndex = Number(monthValue) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new AppError("VALIDATION_ERROR", "El mes seleccionado no es valido", 400);
  }

  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  return { start, end };
}

function canPayCode(line: {
  estado: AttentionCodeStatus;
  codePaymentStatus: "pendiente" | "pagado";
}) {
  return line.estado === "ok" && line.codePaymentStatus === "pendiente";
}

function canPayCoseguroOdonto(line: {
  coseguroOdontoCentavos: number | null;
  coseguroOdontoPaymentStatus: "pendiente" | "pagado";
}) {
  return (
    (line.coseguroOdontoCentavos ?? 0) > 0 &&
    line.coseguroOdontoPaymentStatus === "pendiente"
  );
}

function toPaymentCandidateDto(row: PaymentCandidateRow): PaymentCandidateLineDto {
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

function toPaymentDto(payment: {
  _id: unknown;
  usuarioId: unknown;
  usuarioNombreSnapshot: string;
  attentionMonth: string;
  paidAt: Date;
  createdByUserId: unknown;
  totalPagoCodigosCentavos: number;
  totalCoseguroOdontoCentavos: number;
  totalHonorariosCentavos: number;
  quantityConceptsPaid: number;
  lineItems: PaymentLineItemDto[];
  createdAt: Date;
  updatedAt: Date;
}): PaymentDto {
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

async function ensureLineIdsForPayments(match: Record<string, unknown>) {
  const connection = await connectToDatabase();
  const collection = connection.connection.db!.collection("attentions");
  const attentions = await collection.find(match).toArray();

  for (const attention of attentions) {
    let changed = false;

    const normalizedLines = (attention.codigos ?? []).map((line: Record<string, unknown>) => {
      const nextLine = {
        ...line,
        _id: line._id ? new Types.ObjectId(String(line._id)) : new Types.ObjectId(),
        codePaymentStatus: line.codePaymentStatus ?? "pendiente",
        codePaymentId: line.codePaymentId ?? null,
        codePaidAt: line.codePaidAt ?? null,
        coseguroOdontoPaymentStatus:
          line.coseguroOdontoPaymentStatus ?? "pendiente",
        coseguroOdontoPaymentId: line.coseguroOdontoPaymentId ?? null,
        coseguroOdontoPaidAt: line.coseguroOdontoPaidAt ?? null,
      };

      if (
        !line._id ||
        !line.codePaymentStatus ||
        !line.coseguroOdontoPaymentStatus
      ) {
        changed = true;
      }

      return nextLine;
    });

    if (changed) {
      await collection.updateOne(
        { _id: attention._id },
        { $set: { codigos: normalizedLines } },
      );
    }
  }
}

function buildCandidateBaseMatch(query: PaymentCandidateQuery | PaymentCreateInput) {
  const match: Record<string, unknown> = {};

  if (query.userId) {
    match.usuarioCargaId = new Types.ObjectId(query.userId);
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

function buildCandidatePipeline(query: PaymentCandidateQuery): PipelineStage[] {
  const baseMatch = buildCandidateBaseMatch(query);
  const search = query.search?.trim();

  const pipeline: PipelineStage[] = [
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

async function getCandidateRows(query: PaymentCandidateQuery) {
  await ensureLineIdsForPayments(buildCandidateBaseMatch(query));

  const skip = (query.page - 1) * query.limit;
  const pipeline = buildCandidatePipeline(query);
  const [rows, totalRows] = await Promise.all([
    AttentionModel.aggregate<PaymentCandidateRow>([
      ...pipeline,
      { $sort: { attentionFecha: -1, pacienteNombreCompleto: 1, codigo: 1 } },
      { $skip: skip },
      { $limit: query.limit },
    ]),
    AttentionModel.aggregate<{ total: number }>([...pipeline, { $count: "total" }]),
  ]);

  return {
    rows: rows as PaymentCandidateRow[],
    total: totalRows[0]?.total ?? 0,
  };
}

async function getFreshSelectedCandidates(input: PaymentCreateInput) {
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
        $in: input.selectedItems.map((item) => new Types.ObjectId(item.lineId)),
      },
    },
  });

  const rows = await AttentionModel.aggregate<PaymentCandidateRow>(pipeline);
  return (rows as PaymentCandidateRow[]).map(toPaymentCandidateDto);
}

function buildPaymentSummary(
  candidates: PaymentCandidateLineDto[],
  selectedItems: PaymentCandidateSelectionDto[],
  userId: string,
  attentionMonth: string,
) {
  const selectedByLineId = new Map(
    selectedItems.map((item) => [item.lineId, item]),
  );

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
    totalHonorariosCentavos:
      totalPagoCodigosCentavos + totalCoseguroOdontoCentavos,
    quantityConceptsPaid,
  } satisfies PaymentSummaryDto;
}

export async function listPaymentCandidates(query: PaymentCandidateQuery) {
  await connectToDatabase();

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

export async function listPaymentLookups() {
  await connectToDatabase();

  const users = (
    await UserModel.find({ activo: true })
      .sort({ apellido: 1, name: 1 })
      .lean()
  )
    .filter((user) => {
      const roles = String(user.roles ?? "");
      return roles.includes("odontologo") || roles.includes("administrador");
    })
    .map((user) => ({
      id: String(user._id),
      label: normalizeWhitespace(`${user.apellido ?? ""}, ${user.name}`),
    }));

  const monthRows = await AttentionModel.aggregate([
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
    months: monthRows.map((row) => row._id as string),
  };
}

export async function listPayments(query: PaymentHistoryQuery) {
  await connectToDatabase();

  const match: Record<string, unknown> = {};

  if (query.userId) {
    match.usuarioId = new Types.ObjectId(query.userId);
  }

  if (query.attentionMonth) {
    match.attentionMonth = query.attentionMonth;
  }

  const skip = (query.page - 1) * query.limit;
  const [payments, total] = await Promise.all([
    PaymentModel.find(match)
      .sort({ paidAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    PaymentModel.countDocuments(match),
  ]);

  return {
    data: payments.map((payment) =>
      toPaymentDto({
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
      }),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

async function rollbackPaymentMarks(
  paymentId: Types.ObjectId,
  selectedItems: PaymentCandidateSelectionDto[],
) {
  const connection = await connectToDatabase();
  const collection = connection.connection.db!.collection("attentions");

  for (const selection of selectedItems) {
    const lineId = new Types.ObjectId(selection.lineId);

    if (selection.payCode) {
      await collection.updateOne(
        {
          codigos: {
            $elemMatch: {
              _id: lineId,
              codePaymentId: paymentId,
            },
          },
        },
        {
          $set: {
            "codigos.$.codePaymentStatus": "pendiente",
            "codigos.$.codePaymentId": null,
            "codigos.$.codePaidAt": null,
          },
        },
      );
    }

    if (selection.payCoseguroOdonto) {
      await collection.updateOne(
        {
          codigos: {
            $elemMatch: {
              _id: lineId,
              coseguroOdontoPaymentId: paymentId,
            },
          },
        },
        {
          $set: {
            "codigos.$.coseguroOdontoPaymentStatus": "pendiente",
            "codigos.$.coseguroOdontoPaymentId": null,
            "codigos.$.coseguroOdontoPaidAt": null,
          },
        },
      );
    }
  }

  await PaymentModel.deleteOne({ _id: String(paymentId) });
}

export async function createPayment(input: PaymentCreateInput, currentUserId: string) {
  await connectToDatabase();

  const selectedItems = input.selectedItems.filter(
    (item) => item.payCode || item.payCoseguroOdonto,
  );

  if (selectedItems.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Debes seleccionar al menos un concepto para liquidar",
      400,
    );
  }

  const selectedByLineId = new Map<string, PaymentCandidateSelectionDto>();

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
    throw new AppError(
      "NOT_FOUND",
      "Una o mas lineas seleccionadas ya no estan disponibles para este usuario o mes",
      404,
    );
  }

  normalizedSelection.forEach((selection) => {
    const candidate = candidatesByLineId.get(selection.lineId);

    if (!candidate) {
      throw new AppError("NOT_FOUND", "Una linea seleccionada ya no existe", 404);
    }

    if (selection.payCode && !candidate.canPayCode) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Uno de los codigos seleccionados ya no puede liquidarse",
        409,
      );
    }

    if (selection.payCoseguroOdonto && !candidate.canPayCoseguroOdonto) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Uno de los coseguros odonto seleccionados ya no puede liquidarse",
        409,
      );
    }
  });

  const summary = buildPaymentSummary(
    candidates,
    normalizedSelection,
    input.userId,
    input.attentionMonth,
  );

  if (summary.quantityConceptsPaid === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "No hay conceptos validos para liquidar",
      400,
    );
  }

  const firstCandidate = candidates[0];
  const paymentId = new Types.ObjectId();
  const paidAt = new Date();

  const lineItems: PaymentLineItemDto[] = candidates.map((candidate) => {
    const selection = selectedByLineId.get(candidate.lineId)!;
    const totalLineaCentavos =
      (selection.payCode ? candidate.pagoOdontologoCentavos : 0) +
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

  await PaymentModel.create({
    _id: paymentId,
    usuarioId: new Types.ObjectId(input.userId),
    usuarioNombreSnapshot: firstCandidate.userName,
    attentionMonth: input.attentionMonth,
    paidAt,
    createdByUserId: new Types.ObjectId(currentUserId),
    lineItems: lineItems.map((lineItem) => ({
      ...lineItem,
      attentionId: new Types.ObjectId(lineItem.attentionId),
      attentionFecha: new Date(lineItem.attentionFecha),
      pacienteId: new Types.ObjectId(lineItem.pacienteId),
      obraSocialId: new Types.ObjectId(lineItem.obraSocialId),
      codigoObraSocialId: new Types.ObjectId(lineItem.codigoObraSocialId),
    })),
    totalPagoCodigosCentavos: summary.totalPagoCodigosCentavos,
    totalCoseguroOdontoCentavos: summary.totalCoseguroOdontoCentavos,
    totalHonorariosCentavos: summary.totalHonorariosCentavos,
    quantityConceptsPaid: summary.quantityConceptsPaid,
  });

  try {
    const connection = await connectToDatabase();
    const collection = connection.connection.db!.collection("attentions");

    for (const selection of normalizedSelection) {
      const candidate = candidatesByLineId.get(selection.lineId);

      if (!candidate) {
        throw new AppError("NOT_FOUND", "Una linea seleccionada ya no existe", 404);
      }

      const lineId = new Types.ObjectId(selection.lineId);
      const attentionId = new Types.ObjectId(candidate.attentionId);

      if (selection.payCode) {
        const result = await collection.updateOne(
          {
            _id: attentionId,
            codigos: {
              $elemMatch: {
                _id: lineId,
                estado: "ok",
                codePaymentStatus: { $ne: "pagado" },
              },
            },
          },
          {
            $set: {
              "codigos.$.codePaymentStatus": "pagado",
              "codigos.$.codePaymentId": paymentId,
              "codigos.$.codePaidAt": paidAt,
            },
          },
        );

        if (result.modifiedCount !== 1) {
          throw new AppError(
            "DUPLICATE_RECORD",
            "Uno de los codigos seleccionados ya fue liquidado o dejo de estar en OK",
            409,
          );
        }
      }

      if (selection.payCoseguroOdonto) {
        const result = await collection.updateOne(
          {
            _id: attentionId,
            codigos: {
              $elemMatch: {
                _id: lineId,
                coseguroOdontoCentavos: { $gt: 0 },
                coseguroOdontoPaymentStatus: { $ne: "pagado" },
              },
            },
          },
          {
            $set: {
              "codigos.$.coseguroOdontoPaymentStatus": "pagado",
              "codigos.$.coseguroOdontoPaymentId": paymentId,
              "codigos.$.coseguroOdontoPaidAt": paidAt,
            },
          },
        );

        if (result.modifiedCount !== 1) {
          throw new AppError(
            "DUPLICATE_RECORD",
            "Uno de los coseguros odonto seleccionados ya fue liquidado o no tiene importe",
            409,
          );
        }
      }
    }
  } catch (error) {
    await rollbackPaymentMarks(paymentId, normalizedSelection);
    throw error;
  }

  const payment = await PaymentModel.findById(paymentId).lean();

  if (!payment) {
    throw new AppError("INTERNAL_ERROR", "No se pudo recuperar el pago generado", 500);
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
