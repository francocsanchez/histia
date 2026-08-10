import { parse } from "csv-parse/sync";
import { Types } from "mongoose";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  getMercadoPagoAccessToken,
  getMercadoPagoMovementDescription,
  getMercadoPagoWindowHours,
  hasMercadoPagoAccessToken,
  MERCADO_PAGO_API_BASE_URL,
  MERCADO_PAGO_HTTP_TIMEOUT_MS,
  MERCADO_PAGO_RECONCILIATION_TOLERANCE_CENTAVOS,
} from "@/lib/mercadopago";
import { MercadoPagoSettlementSyncModel } from "@/models/mercadopago-settlement-sync";
import { UserModel } from "@/models/user";
import { createMercadoPagoMovement } from "@/services/movimientos";
import { ensureDefaultMovementTypes } from "@/services/tipos-movimientos";
import {
  MercadoPagoExternalComponent,
  MercadoPagoSyncDto,
  MercadoPagoSyncStatus,
  MercadoPagoSyncType,
} from "@/types/domain";

type MercadoPagoApiReport = {
  id?: number;
  file_name?: string | null;
  status?: string | null;
  begin_date?: string;
  end_date?: string;
};

type MercadoPagoCsvRow = {
  SOURCE_ID?: string;
  PAYMENT_METHOD_TYPE?: string;
  TRANSACTION_TYPE?: string;
  TRANSACTION_AMOUNT?: string;
  TRANSACTION_DATE?: string;
  FEE_AMOUNT?: string;
  SETTLEMENT_DATE?: string;
  REAL_AMOUNT?: string;
  TAXES_AMOUNT?: string;
  BUSINESS_UNIT?: string;
  SUB_UNIT?: string;
  MONEY_RELEASE_DATE?: string;
};

type StartSyncInput = {
  syncType: MercadoPagoSyncType;
  requestedByUserId?: string;
};

type ListSyncsQuery = {
  page: number;
  limit: number;
};

type PendingCheckResult = {
  processed: number;
  failed: number;
  waiting: number;
};

const NON_TERMINAL_SYNC_STATUSES: MercadoPagoSyncStatus[] = [
  "PENDING",
  "WAITING_REPORT",
  "PROCESSING",
];
const PROCESSING_LEASE_MS = 30 * 60 * 1000;
const MERCADO_PAGO_AUTOMATIC_PENDING_CHECK_WINDOW_MS = 5 * 60 * 1000;
const MERCADO_PAGO_AUTOMATIC_HOURLY_SYNC_WINDOW_MS = 60 * 60 * 1000;

function toMercadoPagoSyncDto(sync: {
  _id: Types.ObjectId | string;
  reportId: number | null;
  fileName: string | null;
  beginDate: Date;
  endDate: Date;
  status: MercadoPagoSyncStatus;
  remoteStatus: string | null;
  tipoSincronizacion: MercadoPagoSyncType;
  cantidadFilas: number;
  cantidadMovimientosCreados: number;
  cantidadMovimientosIgnorados: number;
  cantidadAdvertencias: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  processedAt: Date | null;
}): MercadoPagoSyncDto {
  return {
    id: String(sync._id),
    reportId: sync.reportId,
    fileName: sync.fileName,
    beginDate: sync.beginDate.toISOString(),
    endDate: sync.endDate.toISOString(),
    status: sync.status,
    remoteStatus: sync.remoteStatus,
    tipoSincronizacion: sync.tipoSincronizacion,
    cantidadFilas: sync.cantidadFilas,
    cantidadMovimientosCreados: sync.cantidadMovimientosCreados,
    cantidadMovimientosIgnorados: sync.cantidadMovimientosIgnorados,
    cantidadAdvertencias: sync.cantidadAdvertencias,
    error: sync.error,
    createdAt: sync.createdAt.toISOString(),
    updatedAt: sync.updatedAt.toISOString(),
    processedAt: sync.processedAt?.toISOString() ?? null,
  };
}

function sanitizeMercadoPagoError(error: unknown) {
  const accessToken = hasMercadoPagoAccessToken() ? getMercadoPagoAccessToken() : null;
  const fallback = "No se pudo completar la sincronizacion con Mercado Pago";
  const rawMessage =
    error instanceof AppError
      ? error.message
      : error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : fallback;

  const message = accessToken
    ? rawMessage.replaceAll(accessToken, "[REDACTED]")
    : rawMessage;

  return message.trim() || fallback;
}

function logMercadoPagoWarning(message: string, details?: Record<string, unknown>) {
  console.warn("[mercadopago-sync]", message, details ?? {});
}

function logMercadoPagoError(message: string, details?: Record<string, unknown>) {
  console.error("[mercadopago-sync]", message, details ?? {});
}

function buildMercadoPagoWindow(syncType: MercadoPagoSyncType, now = new Date()) {
  const endDate = new Date(now);
  const beginDate = new Date(now.getTime() - getMercadoPagoWindowHours(syncType) * 60 * 60 * 1000);

  return { beginDate, endDate };
}

function getSyncRecencyWindowMs(syncType: MercadoPagoSyncType) {
  if (syncType === "daily_recovery") {
    return 24 * 60 * 60 * 1000;
  }

  if (syncType === "manual") {
    return 15 * 60 * 1000;
  }

  return 60 * 60 * 1000;
}

export function parseMercadoPagoAmountToCents(value: string | undefined, fieldName: string) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return 0;
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed)) {
    throw new Error(`El campo ${fieldName} no contiene un importe valido`);
  }

  return Math.round(parsed * 100);
}

export function parseMercadoPagoDateValue(
  value: string | undefined,
  fieldName: string,
  options?: { required?: boolean },
) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    if (options?.required) {
      throw new Error(`El campo ${fieldName} es obligatorio`);
    }

    return null;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`El campo ${fieldName} no contiene una fecha valida`);
  }

  return parsed;
}

function isMercadoPagoReportArray(payload: unknown): payload is MercadoPagoApiReport[] {
  return Array.isArray(payload);
}

function extractMercadoPagoReports(payload: unknown) {
  if (isMercadoPagoReportArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.results)) {
      return record.results as MercadoPagoApiReport[];
    }

    if (Array.isArray(record.data)) {
      return record.data as MercadoPagoApiReport[];
    }

    if (Array.isArray(record.elements)) {
      return record.elements as MercadoPagoApiReport[];
    }
  }

  return [];
}

async function mercadoPagoFetch(
  path: string,
  init?: RequestInit & { expectText?: boolean },
) {
  const accessToken = getMercadoPagoAccessToken();
  const response = await fetch(`${MERCADO_PAGO_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(MERCADO_PAGO_HTTP_TIMEOUT_MS),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    const message =
      response.status === 401 || response.status === 403
        ? "Mercado Pago rechazo la autenticacion del reporte"
        : response.status === 429
          ? "Mercado Pago rechazo temporalmente la solicitud por limite de uso"
          : response.status >= 500
            ? "Mercado Pago devolvio un error temporal del servidor"
            : `Mercado Pago devolvio un estado ${response.status}`;

    throw new AppError("INTERNAL_ERROR", `${message}.`, response.status, {
      mercadopago: bodyText.slice(0, 250),
    });
  }

  if (init?.expectText) {
    return response.text();
  }

  return response.json();
}

async function resolveSyncActorUserId(requestedByUserId?: string) {
  await connectToDatabase();

  if (requestedByUserId) {
    return requestedByUserId;
  }

  const adminUser = await UserModel.findOne({
    activo: true,
    roles: { $regex: /(^|,)administrador(,|$)/ },
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!adminUser) {
    throw new AppError(
      "NOT_FOUND",
      "No se encontro un administrador activo para registrar movimientos automaticos",
      404,
    );
  }

  return String(adminUser._id);
}

async function createMercadoPagoReport(beginDate: Date, endDate: Date) {
  const payload = (await mercadoPagoFetch("/v1/account/settlement_report", {
    method: "POST",
    body: JSON.stringify({
      begin_date: beginDate.toISOString(),
      end_date: endDate.toISOString(),
      report_type: "settlement",
      format: "CSV",
    }),
  })) as MercadoPagoApiReport;

  if (typeof payload.id !== "number") {
    throw new Error("Mercado Pago no devolvio un identificador de reporte valido");
  }

  return payload;
}

async function listMercadoPagoReports() {
  const payload = await mercadoPagoFetch("/v1/account/settlement_report/list");
  return extractMercadoPagoReports(payload);
}

async function downloadMercadoPagoReport(fileName: string) {
  return mercadoPagoFetch(`/v1/account/settlement_report/${encodeURIComponent(fileName)}`, {
    method: "GET",
    expectText: true,
    headers: {
      Accept: "text/csv,application/octet-stream;q=0.9,*/*;q=0.8",
    },
  });
}

function getComponentDirection(valueCentavos: number) {
  return valueCentavos > 0 ? "ingreso" : "egreso";
}

function getComponentAmount(valueCentavos: number) {
  return Math.abs(valueCentavos);
}

export function buildMovementComponents(row: {
  sourceId: string;
  reportId: number;
  paymentMethodType: string | null;
  transactionType: string | null;
  transactionAmountCentavos: number;
  transactionDate: Date;
  feeAmountCentavos: number;
  settlementDate: Date | null;
  realAmountCentavos: number;
  taxesAmountCentavos: number;
  moneyReleaseDate: Date | null;
  reconciliationDifferenceCentavos: number;
  reconciliationExpectedCentavos: number;
  createdByUserId: string;
}) {
  const components: Array<{
    externalComponent: MercadoPagoExternalComponent;
    descripcion: string;
    direccion: "ingreso" | "egreso";
    montoCentavos: number;
  }> = [];

  if (row.transactionAmountCentavos !== 0) {
    components.push({
      externalComponent: "TRANSACTION",
      descripcion: getMercadoPagoMovementDescription("TRANSACTION"),
      direccion: getComponentDirection(row.transactionAmountCentavos),
      montoCentavos: getComponentAmount(row.transactionAmountCentavos),
    });
  }

  if (row.taxesAmountCentavos !== 0) {
    components.push({
      externalComponent: "TAX",
      descripcion: getMercadoPagoMovementDescription("TAX"),
      direccion: getComponentDirection(row.taxesAmountCentavos),
      montoCentavos: getComponentAmount(row.taxesAmountCentavos),
    });
  }

  if (row.feeAmountCentavos !== 0) {
    components.push({
      externalComponent: "FEE",
      descripcion: getMercadoPagoMovementDescription("FEE"),
      direccion: getComponentDirection(row.feeAmountCentavos),
      montoCentavos: getComponentAmount(row.feeAmountCentavos),
    });
  }

  return components.map((component) => ({
    ...component,
    reportId: row.reportId,
    sourceId: row.sourceId,
    fecha: row.transactionDate,
    paymentMethodType: row.paymentMethodType,
    transactionType: row.transactionType,
    transactionAmountCentavos: row.transactionAmountCentavos,
    transactionDate: row.transactionDate,
    feeAmountCentavos: row.feeAmountCentavos,
    settlementDate: row.settlementDate,
    realAmountCentavos: row.realAmountCentavos,
    taxesAmountCentavos: row.taxesAmountCentavos,
    moneyReleaseDate: row.moneyReleaseDate,
    reconciliationDifferenceCentavos: row.reconciliationDifferenceCentavos,
    reconciliationExpectedCentavos: row.reconciliationExpectedCentavos,
    createdByUserId: row.createdByUserId,
  }));
}

export function parseMercadoPagoCsv(csvText: string) {
  const trimmed = csvText.trim();

  if (!trimmed) {
    return [] as MercadoPagoCsvRow[];
  }

  return parse(trimmed, {
    bom: true,
    columns: true,
    delimiter: ";",
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as MercadoPagoCsvRow[];
}

async function finalizeSyncFailure(syncId: Types.ObjectId | string, error: unknown) {
  const message = sanitizeMercadoPagoError(error);
  await MercadoPagoSettlementSyncModel.findByIdAndUpdate(syncId, {
    $set: {
      status: "FAILED",
      error: message,
      processingStartedAt: null,
      lastCheckedAt: new Date(),
    },
  });

  logMercadoPagoError("Fallo una sincronizacion de Mercado Pago", {
    syncId: String(syncId),
    error: message,
  });
}

async function processMercadoPagoSyncDocument(
  syncId: Types.ObjectId,
  reportId: number,
  fileName: string,
) {
  const sync = await MercadoPagoSettlementSyncModel.findById(syncId).lean();

  if (!sync) {
    return false;
  }

  const csvText = await downloadMercadoPagoReport(fileName);
  const rows = parseMercadoPagoCsv(csvText);
  let cantidadMovimientosCreados = 0;
  let cantidadMovimientosIgnorados = 0;
  let cantidadAdvertencias = 0;

  for (const rawRow of rows) {
    try {
      const sourceId = rawRow.SOURCE_ID?.trim();

      if (!sourceId) {
        cantidadAdvertencias += 1;
        cantidadMovimientosIgnorados += 1;
        logMercadoPagoWarning("Se ignoro una fila sin SOURCE_ID", {
          syncId: String(syncId),
        });
        continue;
      }

      const transactionDate = parseMercadoPagoDateValue(
        rawRow.TRANSACTION_DATE,
        "TRANSACTION_DATE",
        { required: true },
      );

      if (!transactionDate) {
        cantidadAdvertencias += 1;
        cantidadMovimientosIgnorados += 1;
        continue;
      }

      const transactionAmountCentavos = parseMercadoPagoAmountToCents(
        rawRow.TRANSACTION_AMOUNT,
        "TRANSACTION_AMOUNT",
      );
      const feeAmountCentavos = parseMercadoPagoAmountToCents(
        rawRow.FEE_AMOUNT,
        "FEE_AMOUNT",
      );
      const taxesAmountCentavos = parseMercadoPagoAmountToCents(
        rawRow.TAXES_AMOUNT,
        "TAXES_AMOUNT",
      );
      const realAmountCentavos = parseMercadoPagoAmountToCents(
        rawRow.REAL_AMOUNT,
        "REAL_AMOUNT",
      );
      const settlementDate = parseMercadoPagoDateValue(
        rawRow.SETTLEMENT_DATE,
        "SETTLEMENT_DATE",
      );
      const moneyReleaseDate = parseMercadoPagoDateValue(
        rawRow.MONEY_RELEASE_DATE,
        "MONEY_RELEASE_DATE",
      );
      const reconciliationExpectedCentavos =
        transactionAmountCentavos + feeAmountCentavos + taxesAmountCentavos;
      const reconciliationDifferenceCentavos =
        reconciliationExpectedCentavos - realAmountCentavos;

      if (
        Math.abs(reconciliationDifferenceCentavos) >
        MERCADO_PAGO_RECONCILIATION_TOLERANCE_CENTAVOS
      ) {
        cantidadAdvertencias += 1;
        logMercadoPagoWarning("Diferencia de conciliacion detectada en Mercado Pago", {
          syncId: String(syncId),
          sourceId,
          reportId,
          reconciliationExpectedCentavos,
          realAmountCentavos,
          reconciliationDifferenceCentavos,
        });
      }

      const components = buildMovementComponents({
        sourceId,
        reportId,
        paymentMethodType: rawRow.PAYMENT_METHOD_TYPE?.trim() || null,
        transactionType: rawRow.TRANSACTION_TYPE?.trim() || null,
        transactionAmountCentavos,
        transactionDate,
        feeAmountCentavos,
        settlementDate,
        realAmountCentavos,
        taxesAmountCentavos,
        moneyReleaseDate,
        reconciliationDifferenceCentavos,
        reconciliationExpectedCentavos,
        createdByUserId: String(sync.createdByUserId),
      });

      if (components.length === 0) {
        cantidadMovimientosIgnorados += 1;
        continue;
      }

      for (const component of components) {
        const result = await createMercadoPagoMovement(component);

        if (result.created) {
          cantidadMovimientosCreados += 1;
        } else {
          cantidadMovimientosIgnorados += 1;
        }
      }
    } catch (error) {
      cantidadAdvertencias += 1;
      cantidadMovimientosIgnorados += 1;
      logMercadoPagoWarning("Se ignoro una fila invalida de Mercado Pago", {
        syncId: String(syncId),
        error: sanitizeMercadoPagoError(error),
      });
    }
  }

  await MercadoPagoSettlementSyncModel.findByIdAndUpdate(syncId, {
    $set: {
      reportId,
      fileName,
      status: "PROCESSED",
      remoteStatus: "processed",
      cantidadFilas: rows.length,
      cantidadMovimientosCreados,
      cantidadMovimientosIgnorados,
      cantidadAdvertencias,
      error: null,
      processedAt: new Date(),
      processingStartedAt: null,
      lastCheckedAt: new Date(),
    },
  });

  return true;
}

async function claimSyncForProcessing(syncId: Types.ObjectId) {
  const now = new Date();
  const staleStartedAt = new Date(now.getTime() - PROCESSING_LEASE_MS);
  const claimed = await MercadoPagoSettlementSyncModel.findOneAndUpdate(
    {
      _id: syncId,
      $or: [
        { status: { $in: ["PENDING", "WAITING_REPORT"] } },
        {
          status: "PROCESSING",
          processingStartedAt: { $lte: staleStartedAt },
        },
      ],
    },
    {
      $set: {
        status: "PROCESSING",
        processingStartedAt: now,
        lastCheckedAt: now,
        error: null,
      },
    },
    {
      returnDocument: "after",
    },
  ).lean();

  return Boolean(claimed);
}

export async function startMercadoPagoSync(input: StartSyncInput) {
  await connectToDatabase();
  await ensureDefaultMovementTypes();

  if (!hasMercadoPagoAccessToken()) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Falta configurar MERCADOPAGO_ACCESS_TOKEN en el backend",
      500,
    );
  }

  const createdByUserId = await resolveSyncActorUserId(input.requestedByUserId);
  const now = new Date();
  const recentThreshold = new Date(now.getTime() - getSyncRecencyWindowMs(input.syncType));

  const existingOpenSync = await MercadoPagoSettlementSyncModel.findOne({
    tipoSincronizacion: input.syncType,
    status: { $in: NON_TERMINAL_SYNC_STATUSES },
    createdAt: { $gte: recentThreshold },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (existingOpenSync) {
    return {
      created: false,
      sync: toMercadoPagoSyncDto(existingOpenSync),
    };
  }

  const { beginDate, endDate } = buildMercadoPagoWindow(input.syncType, now);
  const sync = await MercadoPagoSettlementSyncModel.create({
    reportId: null,
    fileName: null,
    beginDate,
    endDate,
    status: "PENDING",
    remoteStatus: null,
    tipoSincronizacion: input.syncType,
    cantidadFilas: 0,
    cantidadMovimientosCreados: 0,
    cantidadMovimientosIgnorados: 0,
    cantidadAdvertencias: 0,
    error: null,
    processedAt: null,
    lastCheckedAt: null,
    processingStartedAt: null,
    createdByUserId: new Types.ObjectId(createdByUserId),
  });

  try {
    const report = await createMercadoPagoReport(beginDate, endDate);

    const updated = await MercadoPagoSettlementSyncModel.findByIdAndUpdate(
      sync._id,
      {
        $set: {
          reportId: report.id ?? null,
          fileName: report.file_name ?? null,
          remoteStatus: report.status ?? null,
          status:
            report.status === "processed" && report.file_name
              ? "PROCESSING"
              : "WAITING_REPORT",
          processingStartedAt:
            report.status === "processed" && report.file_name ? new Date() : null,
          lastCheckedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    ).lean();

    if (
      updated &&
      updated.status === "PROCESSING" &&
      typeof updated.reportId === "number" &&
      updated.fileName
    ) {
      try {
        await processMercadoPagoSyncDocument(
          updated._id as Types.ObjectId,
          updated.reportId,
          updated.fileName,
        );
      } catch (error) {
        await finalizeSyncFailure(updated._id, error);
      }

      const refreshed = await MercadoPagoSettlementSyncModel.findById(updated._id).lean();

      if (refreshed) {
        return { created: true, sync: toMercadoPagoSyncDto(refreshed) };
      }
    }

    return {
      created: true,
      sync: toMercadoPagoSyncDto(updated ?? sync.toObject()),
    };
  } catch (error) {
    await finalizeSyncFailure(sync._id, error);
    throw new AppError(
      "INTERNAL_ERROR",
      "No se pudo iniciar la sincronizacion con Mercado Pago",
      500,
    );
  }
}

export async function runMercadoPagoAutomaticMaintenanceIfDue() {
  await connectToDatabase();

  if (!hasMercadoPagoAccessToken()) {
    return { checkedPending: false, startedHourlySync: false };
  }

  const now = new Date();
  let checkedPending = false;
  let startedHourlySync = false;

  const recentPendingCheckThreshold = new Date(
    now.getTime() - MERCADO_PAGO_AUTOMATIC_PENDING_CHECK_WINDOW_MS,
  );
  const hasRecentPendingReview = await MercadoPagoSettlementSyncModel.exists({
    status: { $in: NON_TERMINAL_SYNC_STATUSES },
    lastCheckedAt: { $gte: recentPendingCheckThreshold },
  });

  if (!hasRecentPendingReview) {
    await checkPendingMercadoPagoSyncs();
    checkedPending = true;
  }

  const recentHourlyThreshold = new Date(
    now.getTime() - MERCADO_PAGO_AUTOMATIC_HOURLY_SYNC_WINDOW_MS,
  );
  const hasRecentHourlySync = await MercadoPagoSettlementSyncModel.exists({
    tipoSincronizacion: "hourly",
    createdAt: { $gte: recentHourlyThreshold },
  });

  if (!hasRecentHourlySync) {
    const result = await startMercadoPagoSync({ syncType: "hourly" });
    startedHourlySync = result.created;
  }

  return { checkedPending, startedHourlySync };
}

export async function listMercadoPagoSyncs(query: ListSyncsQuery) {
  await connectToDatabase();
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    MercadoPagoSettlementSyncModel.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    MercadoPagoSettlementSyncModel.countDocuments({}),
  ]);

  return {
    data: items.map(toMercadoPagoSyncDto),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function checkPendingMercadoPagoSyncs(): Promise<PendingCheckResult> {
  await connectToDatabase();

  if (!hasMercadoPagoAccessToken()) {
    return { processed: 0, failed: 0, waiting: 0 };
  }

  const openSyncs = await MercadoPagoSettlementSyncModel.find({
    status: { $in: NON_TERMINAL_SYNC_STATUSES },
  })
    .sort({ createdAt: 1 })
    .lean();

  if (openSyncs.length === 0) {
    return { processed: 0, failed: 0, waiting: 0 };
  }

  let reports: MercadoPagoApiReport[] = [];

  try {
    reports = await listMercadoPagoReports();
  } catch (error) {
    logMercadoPagoError("No se pudo consultar el listado de reportes pendientes", {
      error: sanitizeMercadoPagoError(error),
    });
    return { processed: 0, failed: 0, waiting: openSyncs.length };
  }

  const reportMap = new Map(
    reports
      .filter((report) => typeof report.id === "number")
      .map((report) => [report.id as number, report]),
  );

  let processed = 0;
  let failed = 0;
  let waiting = 0;

  for (const sync of openSyncs) {
    if (typeof sync.reportId !== "number") {
      waiting += 1;
      continue;
    }

    const remoteReport = reportMap.get(sync.reportId);
    const remoteStatus = remoteReport?.status?.toLowerCase() ?? sync.remoteStatus?.toLowerCase();
    const fileName = remoteReport?.file_name?.trim() || sync.fileName;

    if (!remoteStatus || remoteStatus === "pending" || remoteStatus === "processing") {
      waiting += 1;
      await MercadoPagoSettlementSyncModel.findByIdAndUpdate(sync._id, {
        $set: {
          status: "WAITING_REPORT",
          remoteStatus: remoteReport?.status ?? sync.remoteStatus,
          lastCheckedAt: new Date(),
        },
      });
      continue;
    }

    if (remoteStatus === "failed") {
      failed += 1;
      await MercadoPagoSettlementSyncModel.findByIdAndUpdate(sync._id, {
        $set: {
          status: "FAILED",
          remoteStatus: remoteReport?.status ?? "failed",
          error: "Mercado Pago informo que la generacion del reporte fallo",
          processingStartedAt: null,
          lastCheckedAt: new Date(),
        },
      });
      continue;
    }

    if (remoteStatus === "processed" && fileName) {
      const claimed = await claimSyncForProcessing(sync._id as Types.ObjectId);

      if (!claimed) {
        waiting += 1;
        continue;
      }

      try {
        await processMercadoPagoSyncDocument(
          sync._id as Types.ObjectId,
          sync.reportId,
          fileName,
        );
        processed += 1;
      } catch (error) {
        failed += 1;
        await finalizeSyncFailure(sync._id, error);
      }

      continue;
    }

    waiting += 1;
  }

  return { processed, failed, waiting };
}
