import { PipelineStage, Types } from "mongoose";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { normalizeWhitespace } from "@/lib/utils";
import { AttentionModel } from "@/models/attention";
import { OrthodonticTreatmentModel } from "@/models/orthodontic-treatment";
import { PaymentModel } from "@/models/payment";
import { UserModel } from "@/models/user";
import {
  createPaymentMovement,
  deleteMovementByOrigin,
} from "@/services/movimientos";
import {
  AttentionCodeStatus,
  AttentionPaymentLineItemDto,
  OrthodonticPaymentLineItemDto,
  PaymentCandidateLineDto,
  PaymentCandidateSelectionDto,
  PaymentDto,
  PaymentDebitItemDto,
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
  debitItems?: PaymentDebitItemDto[];
};

type PaymentHistoryQuery = {
  page: number;
  limit: number;
  userId?: string;
  attentionMonth?: string;
};

type AttentionPaymentCandidateRow = {
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

function getMonthKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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

function toAttentionCandidateDto(
  row: AttentionPaymentCandidateRow,
): PaymentCandidateLineDto {
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

function toPaymentDto(payment: {
  _id: unknown;
  usuarioId: unknown;
  usuarioNombreSnapshot: string;
  attentionMonth: string;
  paidAt: Date;
  createdByUserId: unknown;
  totalPagoCodigosCentavos: number;
  totalCoseguroOdontoCentavos: number;
  totalOrtodonciaCentavos: number;
  totalHonorariosCentavos: number;
  totalDebitosCentavos: number;
  totalNetoPagarCentavos: number;
  quantityConceptsPaid: number;
  lineItems: PaymentLineItemDto[];
  debitItems: PaymentDebitItemDto[];
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
    totalOrtodonciaCentavos: payment.totalOrtodonciaCentavos,
    totalHonorariosCentavos: payment.totalHonorariosCentavos,
    totalDebitosCentavos: payment.totalDebitosCentavos,
    totalNetoPagarCentavos: payment.totalNetoPagarCentavos,
    quantityConceptsPaid: payment.quantityConceptsPaid,
    lineItems: payment.lineItems,
    debitItems: payment.debitItems,
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

function buildAttentionCandidateBaseMatch(
  query: PaymentCandidateQuery | PaymentCreateInput,
) {
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

function buildAttentionCandidatePipeline(query: PaymentCandidateQuery): PipelineStage[] {
  const baseMatch = buildAttentionCandidateBaseMatch(query);
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

async function getAttentionCandidates(
  query: PaymentCandidateQuery,
): Promise<PaymentCandidateLineDto[]> {
  await ensureLineIdsForPayments(buildAttentionCandidateBaseMatch(query));

  const rows = await AttentionModel.aggregate<AttentionPaymentCandidateRow>([
    ...buildAttentionCandidatePipeline(query),
    { $sort: { attentionFecha: -1, pacienteNombreCompleto: 1, codigo: 1 } },
  ]);

  return rows.map(toAttentionCandidateDto);
}

async function getOrthodonticCandidates(
  query: PaymentCandidateQuery,
): Promise<PaymentCandidateLineDto[]> {
  const match: Record<string, unknown> = {};

  if (query.userId) {
    match.usuarioOrtodoncistaId = new Types.ObjectId(query.userId);
  }

  const treatments = await OrthodonticTreatmentModel.find(match)
    .populate("pacienteId", "nombre apellido dni")
    .populate("usuarioOrtodoncistaId", "name apellido")
    .sort({ fechaInicio: -1, createdAt: -1 })
    .lean();

  const search = query.search?.trim().toLowerCase();
  const month = query.attentionMonth ?? null;
  const candidates: PaymentCandidateLineDto[] = [];

  treatments.forEach((treatment: (typeof treatments)[number]) => {
    const patient = treatment.pacienteId as unknown as {
      _id: Types.ObjectId;
      nombre: string;
      apellido: string;
      dni: string;
    };
    const orthodontist = treatment.usuarioOrtodoncistaId as unknown as {
      _id: Types.ObjectId;
      name: string;
      apellido?: string | null;
    };

    treatment.payments.forEach((payment: (typeof treatment.payments)[number]) => {
      const paymentMonth = getMonthKey(payment.fecha);

      if (month && paymentMonth !== month) {
        return;
      }

      const patientName = `${patient.apellido}, ${patient.nombre}`;
      const userName = normalizeWhitespace(
        `${orthodontist.apellido ?? ""}, ${orthodontist.name}`,
      );
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
    const dateDiff =
      new Date(right.orthodonticPaymentDate ?? right.attentionFecha).getTime() -
      new Date(left.orthodonticPaymentDate ?? left.attentionFecha).getTime();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return left.pacienteNombreCompleto.localeCompare(right.pacienteNombreCompleto);
  });
}

async function getAllCandidates(
  query: PaymentCandidateQuery,
): Promise<PaymentCandidateLineDto[]> {
  const [attentionCandidates, orthodonticCandidates] = await Promise.all([
    getAttentionCandidates(query),
    getOrthodonticCandidates(query),
  ]);

  return [...attentionCandidates, ...orthodonticCandidates].sort((left, right) => {
    const rightDate =
      right.sourceType === "orthodontic-payment"
        ? right.orthodonticPaymentDate ?? right.attentionFecha
        : right.attentionFecha;
    const leftDate =
      left.sourceType === "orthodontic-payment"
        ? left.orthodonticPaymentDate ?? left.attentionFecha
        : left.attentionFecha;
    const dateDiff = new Date(rightDate).getTime() - new Date(leftDate).getTime();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return left.pacienteNombreCompleto.localeCompare(right.pacienteNombreCompleto);
  });
}

function normalizeSelection(
  selectedItems: PaymentCandidateSelectionDto[],
) {
  const selectedByLineId = new Map<string, PaymentCandidateSelectionDto>();

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

async function getFreshSelectedCandidates(input: PaymentCreateInput) {
  const allCandidates = await getAllCandidates({
    page: 1,
    limit: Math.max(input.selectedItems.length, 1),
    userId: input.userId,
    attentionMonth: input.attentionMonth,
  });
  const selectedKeys = new Set(
    input.selectedItems.map((item) => `${item.sourceType}:${item.lineId}`),
  );

  return allCandidates.filter((candidate) =>
    selectedKeys.has(`${candidate.sourceType}:${candidate.lineId}`),
  );
}

function buildPaymentSummary(
  candidates: PaymentCandidateLineDto[],
  selectedItems: PaymentCandidateSelectionDto[],
  userId: string,
  attentionMonth: string,
  debitItems: PaymentDebitItemDto[],
) {
  const selectedByKey = new Map(
    selectedItems.map((item) => [`${item.sourceType}:${item.lineId}`, item]),
  );

  let totalPagoCodigosCentavos = 0;
  let totalCoseguroOdontoCentavos = 0;
  let totalOrtodonciaCentavos = 0;
  let quantityConceptsPaid = 0;
  const totalDebitosCentavos = debitItems.reduce(
    (total, item) => total + item.montoCentavos,
    0,
  );

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
    totalHonorariosCentavos:
      totalPagoCodigosCentavos +
      totalCoseguroOdontoCentavos +
      totalOrtodonciaCentavos,
    totalDebitosCentavos,
    totalNetoPagarCentavos:
      totalPagoCodigosCentavos +
      totalCoseguroOdontoCentavos +
      totalOrtodonciaCentavos -
      totalDebitosCentavos,
    quantityConceptsPaid,
  } satisfies PaymentSummaryDto;
}

function mapPersistedLineItem(lineItem: Record<string, unknown>): PaymentLineItemDto {
  if (lineItem.sourceType === "orthodontic-payment") {
    return {
      sourceType: "orthodontic-payment",
      orthodonticTreatmentId: String(lineItem.orthodonticTreatmentId),
      orthodonticPaymentId: String(lineItem.orthodonticPaymentId),
      treatmentStartDate: new Date(String(lineItem.treatmentStartDate)).toISOString(),
      paymentDate: new Date(String(lineItem.paymentDate)).toISOString(),
      treatmentType: String(lineItem.treatmentType) as OrthodonticPaymentLineItemDto["treatmentType"],
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
    estadoAtencionSnapshot: String(
      lineItem.estadoAtencionSnapshot,
    ) as AttentionPaymentLineItemDto["estadoAtencionSnapshot"],
    pagoOdontologoCentavos: Number(lineItem.pagoOdontologoCentavos ?? 0),
    coseguroOdontoCentavos:
      lineItem.coseguroOdontoCentavos === null ||
      lineItem.coseguroOdontoCentavos === undefined
        ? null
        : Number(lineItem.coseguroOdontoCentavos),
    includesCodePayment: Boolean(lineItem.includesCodePayment),
    includesCoseguroOdontoPayment: Boolean(lineItem.includesCoseguroOdontoPayment),
    totalLineaCentavos: Number(lineItem.totalLineaCentavos ?? 0),
  };
}

export async function listPaymentCandidates(query: PaymentCandidateQuery) {
  await connectToDatabase();

  const allCandidates = await getAllCandidates(query);
  const skip = (query.page - 1) * query.limit;
  const data = allCandidates.slice(skip, skip + query.limit);

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

export async function listPaymentLookups() {
  await connectToDatabase();

  const activeUsers = await UserModel.find({ activo: true })
    .sort({ apellido: 1, name: 1 })
    .lean();
  const users = activeUsers
    .filter((user: { roles?: string | null }) => {
      const roles = String(user.roles ?? "");
      return (
        roles.includes("odontologo") ||
        roles.includes("ortodoncista") ||
        roles.includes("administrador")
      );
    })
    .map((user: { _id: unknown; apellido?: string | null; name: string }) => ({
      id: String(user._id),
      label: normalizeWhitespace(`${user.apellido ?? ""}, ${user.name}`),
    }));

  const [attentionMonths, orthodonticTreatments] = await Promise.all([
    AttentionModel.aggregate<{ _id: string }>([
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
    OrthodonticTreatmentModel.find({}, { payments: 1 }).lean(),
  ]);

  const months = new Set<string>(attentionMonths.map((row) => row._id));
  orthodonticTreatments.forEach((treatment: (typeof orthodonticTreatments)[number]) => {
    treatment.payments.forEach((payment: (typeof treatment.payments)[number]) => {
      months.add(getMonthKey(payment.fecha));
    });
  });

  return {
    users,
    months: Array.from(months).sort((left, right) => right.localeCompare(left)),
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
    data: payments.map((payment: (typeof payments)[number]) =>
      toPaymentDto({
        ...payment,
        lineItems: (payment.lineItems ?? []).map((lineItem: unknown) =>
          mapPersistedLineItem(lineItem as Record<string, unknown>),
        ),
        totalOrtodonciaCentavos: payment.totalOrtodonciaCentavos ?? 0,
        totalDebitosCentavos: payment.totalDebitosCentavos ?? 0,
        totalNetoPagarCentavos:
          payment.totalNetoPagarCentavos ?? payment.totalHonorariosCentavos,
        debitItems: payment.debitItems ?? [],
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

async function rollbackPaymentOperation(
  paymentId: Types.ObjectId,
  selectedItems: PaymentCandidateSelectionDto[],
) {
  const connection = await connectToDatabase();
  const attentionCollection = connection.connection.db!.collection("attentions");

  for (const selection of selectedItems) {
    const lineId = new Types.ObjectId(selection.lineId);

    if (selection.sourceType === "attention") {
      if (selection.payCode) {
        await attentionCollection.updateOne(
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
        await attentionCollection.updateOne(
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

      continue;
    }

    await OrthodonticTreatmentModel.updateOne(
      {
        "payments._id": lineId,
        "payments.paymentId": paymentId,
      },
      {
        $set: {
          "payments.$.paymentStatus": "pendiente",
          "payments.$.paymentId": null,
          "payments.$.paidAt": null,
          "payments.$.updatedAt": new Date(),
        },
      },
    );
  }

  await deleteMovementByOrigin("payment", paymentId);
  await PaymentModel.deleteOne({ _id: String(paymentId) });
}

export async function createPayment(input: PaymentCreateInput, currentUserId: string) {
  await connectToDatabase();

  const debitItems = (input.debitItems ?? []).map((item) => ({
    montoCentavos: item.montoCentavos,
    observacion: normalizeWhitespace(item.observacion),
  }));

  if (
    debitItems.some(
      (item) =>
        !Number.isInteger(item.montoCentavos) ||
        item.montoCentavos <= 0 ||
        !item.observacion,
    )
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Cada debito debe tener un importe valido y una observacion",
      400,
    );
  }

  const normalizedSelection = normalizeSelection(input.selectedItems);

  if (normalizedSelection.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Debes seleccionar al menos un concepto para liquidar",
      400,
    );
  }

  const candidates = await getFreshSelectedCandidates({
    ...input,
    selectedItems: normalizedSelection,
  });
  const candidatesByKey = new Map(
    candidates.map((item) => [`${item.sourceType}:${item.lineId}`, item]),
  );

  if (candidatesByKey.size !== normalizedSelection.length) {
    throw new AppError(
      "NOT_FOUND",
      "Uno o mas conceptos seleccionados ya no estan disponibles para este usuario o mes",
      404,
    );
  }

  normalizedSelection.forEach((selection) => {
    const candidate = candidatesByKey.get(`${selection.sourceType}:${selection.lineId}`);

    if (!candidate) {
      throw new AppError("NOT_FOUND", "Un concepto seleccionado ya no existe", 404);
    }

    if (selection.payCode && !candidate.canPayCode) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Uno de los conceptos seleccionados ya no puede liquidarse",
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
    debitItems,
  );

  if (summary.quantityConceptsPaid === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "No hay conceptos validos para liquidar",
      400,
    );
  }

  if (summary.totalNetoPagarCentavos < 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Los debitos no pueden superar el total bruto de la liquidacion",
      400,
    );
  }

  const firstCandidate = candidates[0];
  const paymentId = new Types.ObjectId();
  const paidAt = new Date();

  const lineItems: PaymentLineItemDto[] = candidates.map((candidate) => {
    const selection =
      candidatesByKey.get(`${candidate.sourceType}:${candidate.lineId}`) &&
      normalizedSelection.find(
        (item) =>
          item.sourceType === candidate.sourceType && item.lineId === candidate.lineId,
      );

    if (!selection) {
      throw new AppError("INTERNAL_ERROR", "No se pudo resolver la seleccion", 500);
    }

    if (candidate.sourceType === "orthodontic-payment") {
      return {
        sourceType: "orthodontic-payment",
        orthodonticTreatmentId: candidate.orthodonticTreatmentId!,
        orthodonticPaymentId: candidate.orthodonticPaymentId!,
        treatmentStartDate: candidate.attentionFecha,
        paymentDate: candidate.orthodonticPaymentDate!,
        treatmentType: candidate.orthodonticTreatmentType!,
        patientId: candidate.pacienteId,
        patientName: candidate.pacienteNombreCompleto,
        patientDni: candidate.pacienteDni,
        paymentAmountCentavos: candidate.orthodonticPaymentAmountCentavos ?? 0,
        percentageToOrthodontist: candidate.orthodonticPaymentPercentage ?? 0,
        orthodontistAmountCentavos: candidate.pagoOdontologoCentavos,
        totalLineaCentavos: candidate.pagoOdontologoCentavos,
      } satisfies OrthodonticPaymentLineItemDto;
    }

    const totalLineaCentavos =
      (selection.payCode ? candidate.pagoOdontologoCentavos : 0) +
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
    } satisfies AttentionPaymentLineItemDto;
  });

  await PaymentModel.create({
    _id: paymentId,
    usuarioId: new Types.ObjectId(input.userId),
    usuarioNombreSnapshot: firstCandidate.userName,
    attentionMonth: input.attentionMonth,
    paidAt,
    createdByUserId: new Types.ObjectId(currentUserId),
    lineItems,
    totalPagoCodigosCentavos: summary.totalPagoCodigosCentavos,
    totalCoseguroOdontoCentavos: summary.totalCoseguroOdontoCentavos,
    totalOrtodonciaCentavos: summary.totalOrtodonciaCentavos,
    totalHonorariosCentavos: summary.totalHonorariosCentavos,
    totalDebitosCentavos: summary.totalDebitosCentavos,
    totalNetoPagarCentavos: summary.totalNetoPagarCentavos,
    quantityConceptsPaid: summary.quantityConceptsPaid,
    debitItems,
  });

  try {
    const attentionCollection = (await connectToDatabase()).connection.db!.collection("attentions");

    for (const selection of normalizedSelection) {
      const candidate = candidatesByKey.get(`${selection.sourceType}:${selection.lineId}`)!;

      if (selection.sourceType === "attention") {
        if (selection.payCode) {
          await attentionCollection.updateOne(
            {
              codigos: {
                $elemMatch: {
                  _id: new Types.ObjectId(selection.lineId),
                  codePaymentStatus: "pendiente",
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
        }

        if (selection.payCoseguroOdonto) {
          await attentionCollection.updateOne(
            {
              codigos: {
                $elemMatch: {
                  _id: new Types.ObjectId(selection.lineId),
                  coseguroOdontoPaymentStatus: "pendiente",
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
        }

        continue;
      }

      await OrthodonticTreatmentModel.updateOne(
        {
          _id: new Types.ObjectId(candidate.orthodonticTreatmentId!),
          "payments._id": new Types.ObjectId(selection.lineId),
          "payments.paymentStatus": "pendiente",
        },
        {
          $set: {
            "payments.$.paymentStatus": "pagado",
            "payments.$.paymentId": paymentId,
            "payments.$.paidAt": paidAt,
            "payments.$.updatedAt": new Date(),
          },
        },
      );
    }

    await createPaymentMovement({
      paymentId,
      paidAt,
      usuarioId: input.userId,
      usuarioNombreSnapshot: firstCandidate.userName,
      attentionMonth: input.attentionMonth,
      totalPagoCodigosCentavos: summary.totalPagoCodigosCentavos,
      totalCoseguroOdontoCentavos: summary.totalCoseguroOdontoCentavos,
      totalOrtodonciaCentavos: summary.totalOrtodonciaCentavos,
      totalHonorariosCentavos: summary.totalHonorariosCentavos,
      totalDebitosCentavos: summary.totalDebitosCentavos,
      totalNetoPagarCentavos: summary.totalNetoPagarCentavos,
      quantityConceptsPaid: summary.quantityConceptsPaid,
      debitItems,
      createdByUserId: currentUserId,
    });
  } catch (error) {
    await rollbackPaymentOperation(paymentId, normalizedSelection);
    throw error;
  }

  const created = await PaymentModel.findById(paymentId).lean();

  if (!created) {
    throw new AppError("INTERNAL_ERROR", "No se pudo recuperar el pago creado", 500);
  }

  return toPaymentDto({
    ...created,
    lineItems: (created.lineItems ?? []).map((lineItem: unknown) =>
      mapPersistedLineItem(lineItem as Record<string, unknown>),
    ),
    totalOrtodonciaCentavos: created.totalOrtodonciaCentavos ?? 0,
    totalDebitosCentavos: created.totalDebitosCentavos ?? 0,
    totalNetoPagarCentavos:
      created.totalNetoPagarCentavos ?? created.totalHonorariosCentavos,
    debitItems: created.debitItems ?? [],
  });
}
