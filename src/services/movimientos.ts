import { Types } from "mongoose";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { buildPaymentMovementDescription } from "@/lib/movement";
import { parseDateOnlyAsUtc, normalizeWhitespace } from "@/lib/utils";
import { MovementModel } from "@/models/movement";
import { getMovementTypeById, getSystemMovementType } from "@/services/tipos-movimientos";
import {
  MercadoPagoExternalComponent,
  MovementMetadataDto,
  MovementCreateDto,
  MovementDirection,
  MovementDto,
  MovementMercadoPagoMetadataDto,
  MovementOriginType,
  MovementPaymentMetadataDto,
  MovementUpdateDto,
} from "@/types/domain";

type ListMovementsQuery = {
  page: number;
  limit: number;
  dateFrom?: string;
  dateTo?: string;
  direction?: MovementDirection;
  typeId?: string;
  originType?: MovementOriginType;
};

function buildMovementMatch(query: ListMovementsQuery) {
  const match: Record<string, unknown> = {};
  const dateFrom = parseOptionalDate(query.dateFrom);
  const dateTo = parseOptionalDate(query.dateTo, { endOfDay: true });

  if (dateFrom || dateTo) {
    match.fecha = {};

    if (dateFrom) {
      (match.fecha as Record<string, Date>).$gte = dateFrom;
    }

    if (dateTo) {
      (match.fecha as Record<string, Date>).$lte = dateTo;
    }
  }

  if (query.direction) {
    match.direccion = query.direction;
  }

  if (query.typeId) {
    match.tipoMovimientoId = new Types.ObjectId(query.typeId);
  }

  if (query.originType) {
    match.origenTipo = query.originType;
  }

  return match;
}

type PaymentMovementInput = {
  paymentId: Types.ObjectId;
  paidAt: Date;
  usuarioId: string;
  usuarioNombreSnapshot: string;
  attentionMonth: string;
  totalPagoCodigosCentavos: number;
  totalCoseguroOdontoCentavos: number;
  totalHonorariosCentavos: number;
  quantityConceptsPaid: number;
  createdByUserId: string;
};

type MercadoPagoMovementInput = {
  reportId: number;
  sourceId: string;
  externalComponent: MercadoPagoExternalComponent;
  fecha: Date;
  descripcion: string;
  direccion: MovementDirection;
  montoCentavos: number;
  externalReference: string | null;
  paymentMethod: string | null;
  paymentMethodType: string | null;
  transactionType: string | null;
  transactionAmountCentavos: number;
  transactionDate: Date;
  feeAmountCentavos: number;
  settlementDate: Date | null;
  realAmountCentavos: number;
  taxesAmountCentavos: number;
  moneyReleaseDate: Date | null;
  description: string | null;
  businessUnit: string | null;
  subUnit: string | null;
  reconciliationDifferenceCentavos: number;
  reconciliationExpectedCentavos: number;
  createdByUserId: string;
};

function toMovementDto(movement: {
  _id: Types.ObjectId | string;
  fecha: Date;
  descripcion: string | null;
  direccion: MovementDirection;
  tipoMovimientoId: Types.ObjectId | null;
  tipo: string;
  montoCentavos: number;
  origenTipo: MovementOriginType;
  origenId: Types.ObjectId | null;
  externalId: string | null;
  externalComponent: MercadoPagoExternalComponent | null;
  creadoAutomaticamente: boolean;
  metadata: MovementMetadataDto | null;
  createdByUserId: Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}): MovementDto {
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
    externalId: movement.externalId ?? null,
    externalComponent: movement.externalComponent ?? null,
    creadoAutomaticamente: movement.creadoAutomaticamente,
    metadata: movement.metadata,
    createdByUserId: String(movement.createdByUserId),
    createdAt: movement.createdAt.toISOString(),
    updatedAt: movement.updatedAt.toISOString(),
  };
}

function parseOptionalDate(value?: string, options?: { endOfDay?: boolean }) {
  if (!value) {
    return undefined;
  }

  try {
    return parseDateOnlyAsUtc(value, options);
  } catch {
    throw new AppError(
      "VALIDATION_ERROR",
      "La fecha debe tener formato YYYY-MM-DD",
      400,
      { [options?.endOfDay ? "dateTo" : "dateFrom"]: "La fecha debe tener formato YYYY-MM-DD" },
    );
  }
}

export async function listMovements(query: ListMovementsQuery) {
  await connectToDatabase();

  const match = buildMovementMatch(query);

  const skip = (query.page - 1) * query.limit;
  const [items, total, summaryRows] = await Promise.all([
    MovementModel.find(match)
      .sort({ fecha: -1, createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    MovementModel.countDocuments(match),
    MovementModel.aggregate<{ _id: MovementDirection; total: number }>([
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

export async function createManualMovement(
  input: MovementCreateDto,
  currentUserId: string,
) {
  await connectToDatabase();
  const movementType = await getMovementTypeById(input.movementTypeId, {
    requireActive: true,
  });

  const movement = await MovementModel.create({
    fecha: parseDateOnlyAsUtc(input.fecha),
    descripcion: input.descripcion?.trim()
      ? normalizeWhitespace(input.descripcion)
      : null,
    direccion: movementType.direccion,
    tipoMovimientoId: new Types.ObjectId(movementType.id),
    tipo: movementType.nombre,
    montoCentavos: input.montoCentavos,
    origenTipo: "manual",
    origenId: null,
    creadoAutomaticamente: false,
    metadata: null,
    createdByUserId: new Types.ObjectId(currentUserId),
  });

  return toMovementDto(movement.toObject());
}

export async function updateMovementDetails(
  movementId: string,
  input: MovementUpdateDto,
) {
  await connectToDatabase();

  const movement = await MovementModel.findById(movementId);

  if (!movement) {
    throw new AppError("NOT_FOUND", "Movimiento no encontrado", 404);
  }

  const movementType = await getMovementTypeById(input.movementTypeId, {
    requireActive: true,
  });

  if (movementType.direccion !== movement.direccion) {
    throw new AppError(
      "VALIDATION_ERROR",
      "El concepto debe coincidir con la direccion del movimiento",
      409,
      { movementTypeId: "El concepto debe coincidir con la direccion del movimiento" },
    );
  }

  movement.tipoMovimientoId = new Types.ObjectId(movementType.id);
  movement.tipo = movementType.nombre;
  movement.descripcion = input.descripcion?.trim()
    ? normalizeWhitespace(input.descripcion)
    : null;
  await movement.save();

  return toMovementDto(movement.toObject());
}

export async function createPaymentMovement(input: PaymentMovementInput) {
  await connectToDatabase();
  const movementType = await getSystemMovementType("payment-honorarios");

  const metadata: MovementPaymentMetadataDto = {
    kind: "payment",
    paymentId: String(input.paymentId),
    usuarioId: input.usuarioId,
    usuarioNombreSnapshot: input.usuarioNombreSnapshot,
    attentionMonth: input.attentionMonth,
    totalPagoCodigosCentavos: input.totalPagoCodigosCentavos,
    totalCoseguroOdontoCentavos: input.totalCoseguroOdontoCentavos,
    totalHonorariosCentavos: input.totalHonorariosCentavos,
    quantityConceptsPaid: input.quantityConceptsPaid,
  };

  try {
    const movement = await MovementModel.create({
      fecha: input.paidAt,
      descripcion: buildPaymentMovementDescription(
        input.usuarioNombreSnapshot,
        input.attentionMonth,
      ),
      direccion: movementType.direccion,
      tipoMovimientoId: new Types.ObjectId(movementType.id),
      tipo: movementType.nombre,
      montoCentavos: input.totalHonorariosCentavos,
      origenTipo: "payment",
      origenId: input.paymentId,
      externalId: null,
      externalComponent: null,
      creadoAutomaticamente: true,
      metadata,
      createdByUserId: new Types.ObjectId(input.createdByUserId),
    });

    return toMovementDto(movement.toObject());
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      const existing = await MovementModel.findOne({
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

export async function createMercadoPagoMovement(input: MercadoPagoMovementInput) {
  await connectToDatabase();
  const movementType = await getSystemMovementType(
    input.externalComponent === "TAX"
      ? input.direccion === "ingreso"
        ? "mercadopago-tax-income"
        : "mercadopago-tax-expense"
      : input.externalComponent === "FEE"
        ? input.direccion === "ingreso"
          ? "mercadopago-fee-income"
          : "mercadopago-fee-expense"
        : input.direccion === "ingreso"
          ? "mercadopago-income"
          : "mercadopago-expense",
  );

  const metadata: MovementMercadoPagoMetadataDto = {
    kind: "mercadopago",
    reportId: input.reportId,
    sourceId: input.sourceId,
    externalReference: input.externalReference,
    paymentMethod: input.paymentMethod,
    paymentMethodType: input.paymentMethodType,
    transactionType: input.transactionType,
    transactionAmountCentavos: input.transactionAmountCentavos,
    transactionDate: input.transactionDate.toISOString(),
    feeAmountCentavos: input.feeAmountCentavos,
    settlementDate: input.settlementDate?.toISOString() ?? null,
    realAmountCentavos: input.realAmountCentavos,
    taxesAmountCentavos: input.taxesAmountCentavos,
    moneyReleaseDate: input.moneyReleaseDate?.toISOString() ?? null,
    description: input.description,
    businessUnit: input.businessUnit,
    subUnit: input.subUnit,
    externalComponent: input.externalComponent,
    reconciliationExpectedCentavos: input.reconciliationExpectedCentavos,
    reconciliationDifferenceCentavos: input.reconciliationDifferenceCentavos,
    reconciliationMatches: input.reconciliationDifferenceCentavos === 0,
  };

  try {
    const movement = await MovementModel.create({
      fecha: input.fecha,
      descripcion: input.descripcion,
      direccion: input.direccion,
      tipoMovimientoId: new Types.ObjectId(movementType.id),
      tipo: movementType.nombre,
      montoCentavos: input.montoCentavos,
      origenTipo: "mercadopago",
      origenId: null,
      externalId: input.sourceId,
      externalComponent: input.externalComponent,
      creadoAutomaticamente: true,
      metadata,
      createdByUserId: new Types.ObjectId(input.createdByUserId),
    });

    return {
      created: true,
      movement: toMovementDto(movement.toObject()),
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      const existing = await MovementModel.findOne({
        origenTipo: "mercadopago",
        externalId: input.sourceId,
        externalComponent: input.externalComponent,
      }).lean();

      if (existing) {
        return {
          created: false,
          movement: toMovementDto(existing),
        };
      }
    }

    throw error;
  }
}

export async function deleteMovementByOrigin(
  originType: MovementOriginType,
  originId: Types.ObjectId,
) {
  await connectToDatabase();
  await MovementModel.deleteOne({ origenTipo: originType, origenId: originId });
}
