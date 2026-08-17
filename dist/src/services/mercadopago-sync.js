"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMercadoPagoRateLimitError = isMercadoPagoRateLimitError;
exports.parseMercadoPagoAmountToCents = parseMercadoPagoAmountToCents;
exports.parseMercadoPagoDateValue = parseMercadoPagoDateValue;
exports.buildMovementComponents = buildMovementComponents;
exports.parseMercadoPagoCsv = parseMercadoPagoCsv;
exports.startMercadoPagoSync = startMercadoPagoSync;
exports.runMercadoPagoAutomaticMaintenanceIfDue = runMercadoPagoAutomaticMaintenanceIfDue;
exports.listMercadoPagoSyncs = listMercadoPagoSyncs;
exports.checkPendingMercadoPagoSyncs = checkPendingMercadoPagoSyncs;
const sync_1 = require("csv-parse/sync");
const mongoose_1 = require("mongoose");
const api_1 = require("@/lib/api");
const mongoose_2 = require("@/lib/db/mongoose");
const mercadopago_1 = require("@/lib/mercadopago");
const mercadopago_settlement_sync_1 = require("@/models/mercadopago-settlement-sync");
const user_1 = require("@/models/user");
const movimientos_1 = require("@/services/movimientos");
const tipos_movimientos_1 = require("@/services/tipos-movimientos");
const NON_TERMINAL_SYNC_STATUSES = [
    "PENDING",
    "WAITING_REPORT",
    "PROCESSING",
];
const PROCESSING_LEASE_MS = 30 * 60 * 1000;
const MERCADO_PAGO_AUTOMATIC_PENDING_CHECK_WINDOW_MS = 5 * 60 * 1000;
const MERCADO_PAGO_AUTOMATIC_HOURLY_SYNC_WINDOW_MS = 60 * 60 * 1000;
const MERCADO_PAGO_RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;
function toMercadoPagoSyncDto(sync) {
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
function sanitizeMercadoPagoError(error) {
    const accessToken = (0, mercadopago_1.hasMercadoPagoAccessToken)() ? (0, mercadopago_1.getMercadoPagoAccessToken)() : null;
    const fallback = "No se pudo completar la sincronizacion con Mercado Pago";
    const rawMessage = error instanceof api_1.AppError
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
function logMercadoPagoWarning(message, details) {
    console.warn("[mercadopago-sync]", message, details ?? {});
}
function logMercadoPagoError(message, details) {
    console.error("[mercadopago-sync]", message, details ?? {});
}
function extractMercadoPagoErrorDetails(error) {
    if (error instanceof api_1.AppError) {
        return {
            code: error.code,
            status: error.status,
            fields: error.fields ?? null,
            stack: error.stack ?? null,
        };
    }
    if (error instanceof Error) {
        const errorWithCause = error;
        return {
            name: error.name,
            message: error.message,
            cause: errorWithCause.cause ?? null,
            stack: error.stack ?? null,
        };
    }
    return {
        raw: error ?? null,
    };
}
function isMercadoPagoRateLimitMessage(message) {
    return message?.includes("Mercado Pago rechazo temporalmente la solicitud por limite de uso") ?? false;
}
function isMercadoPagoRateLimitError(error) {
    if (error instanceof api_1.AppError && error.status === 429) {
        return true;
    }
    return isMercadoPagoRateLimitMessage(sanitizeMercadoPagoError(error));
}
async function assertMercadoPagoRateLimitCooldownInactive() {
    const threshold = new Date(Date.now() - MERCADO_PAGO_RATE_LIMIT_COOLDOWN_MS);
    const recentRateLimitedSync = await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.findOne({
        status: "FAILED",
        createdAt: { $gte: threshold },
        error: { $regex: "Mercado Pago rechazo temporalmente la solicitud por limite de uso", $options: "i" },
    })
        .sort({ createdAt: -1 })
        .lean();
    if (!recentRateLimitedSync) {
        return;
    }
    const availableAt = new Date(recentRateLimitedSync.createdAt.getTime() + MERCADO_PAGO_RATE_LIMIT_COOLDOWN_MS);
    const remainingMs = Math.max(0, availableAt.getTime() - Date.now());
    const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
    throw new api_1.AppError("INTERNAL_ERROR", `Mercado Pago rechazo temporalmente la solicitud por limite de uso. Reintenta en ${remainingMinutes} minuto(s).`, 429);
}
function buildMercadoPagoWindow(syncType, now = new Date()) {
    const endDate = new Date(now);
    const beginDate = new Date(now.getTime() - (0, mercadopago_1.getMercadoPagoWindowHours)(syncType) * 60 * 60 * 1000);
    return { beginDate, endDate };
}
function getSyncRecencyWindowMs(syncType) {
    if (syncType === "daily_recovery") {
        return 24 * 60 * 60 * 1000;
    }
    if (syncType === "manual") {
        return 15 * 60 * 1000;
    }
    return 60 * 60 * 1000;
}
function parseMercadoPagoAmountToCents(value, fieldName) {
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
function parseMercadoPagoDateValue(value, fieldName, options) {
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
function isMercadoPagoReportArray(payload) {
    return Array.isArray(payload);
}
function extractMercadoPagoReports(payload) {
    if (isMercadoPagoReportArray(payload)) {
        return payload;
    }
    if (payload && typeof payload === "object") {
        const record = payload;
        if (Array.isArray(record.results)) {
            return record.results;
        }
        if (Array.isArray(record.data)) {
            return record.data;
        }
        if (Array.isArray(record.elements)) {
            return record.elements;
        }
    }
    return [];
}
async function mercadoPagoFetch(path, init) {
    const accessToken = (0, mercadopago_1.getMercadoPagoAccessToken)();
    const response = await fetch(`${mercadopago_1.MERCADO_PAGO_API_BASE_URL}${path}`, {
        ...init,
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...(init?.headers ?? {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(mercadopago_1.MERCADO_PAGO_HTTP_TIMEOUT_MS),
    });
    if (!response.ok) {
        const bodyText = await response.text();
        const message = response.status === 401 || response.status === 403
            ? "Mercado Pago rechazo la autenticacion del reporte"
            : response.status === 429
                ? "Mercado Pago rechazo temporalmente la solicitud por limite de uso"
                : response.status >= 500
                    ? "Mercado Pago devolvio un error temporal del servidor"
                    : `Mercado Pago devolvio un estado ${response.status}`;
        throw new api_1.AppError("INTERNAL_ERROR", `${message}.`, response.status, {
            mercadopago: bodyText.slice(0, 250),
        });
    }
    if (init?.expectText) {
        return response.text();
    }
    return response.json();
}
async function resolveSyncActorUserId(requestedByUserId) {
    await (0, mongoose_2.connectToDatabase)();
    if (requestedByUserId) {
        return requestedByUserId;
    }
    const adminUser = await user_1.UserModel.findOne({
        activo: true,
        roles: { $regex: /(^|,)administrador(,|$)/ },
    })
        .sort({ createdAt: 1 })
        .lean();
    if (!adminUser) {
        throw new api_1.AppError("NOT_FOUND", "No se encontro un administrador activo para registrar movimientos automaticos", 404);
    }
    return String(adminUser._id);
}
async function createMercadoPagoReport(beginDate, endDate) {
    const payload = (await mercadoPagoFetch("/v1/account/settlement_report", {
        method: "POST",
        body: JSON.stringify({
            begin_date: beginDate.toISOString(),
            end_date: endDate.toISOString(),
            report_type: "settlement",
            format: "CSV",
        }),
    }));
    if (typeof payload.id !== "number") {
        throw new Error("Mercado Pago no devolvio un identificador de reporte valido");
    }
    return payload;
}
function isMongoDuplicateKeyError(error) {
    if (!error || typeof error !== "object") {
        return false;
    }
    return "code" in error && error.code === 11000;
}
async function listMercadoPagoReports() {
    const payload = await mercadoPagoFetch("/v1/account/settlement_report/list");
    return extractMercadoPagoReports(payload);
}
async function downloadMercadoPagoReport(fileName) {
    return mercadoPagoFetch(`/v1/account/settlement_report/${encodeURIComponent(fileName)}`, {
        method: "GET",
        expectText: true,
        headers: {
            Accept: "text/csv,application/octet-stream;q=0.9,*/*;q=0.8",
        },
    });
}
function getComponentDirection(valueCentavos) {
    return valueCentavos > 0 ? "ingreso" : "egreso";
}
function getComponentAmount(valueCentavos) {
    return Math.abs(valueCentavos);
}
function buildMovementComponents(row) {
    const components = [];
    if (row.transactionAmountCentavos !== 0) {
        const direccion = getComponentDirection(row.transactionAmountCentavos);
        const descripcionBase = (0, mercadopago_1.getMercadoPagoMovementDescription)("TRANSACTION", {
            transactionType: row.transactionType,
            direction: direccion,
        });
        components.push({
            externalComponent: "TRANSACTION",
            descripcion: descripcionBase === "Mercado Pago" && row.payerName
                ? `Mercado Pago - ${row.payerName}`
                : descripcionBase,
            direccion,
            montoCentavos: getComponentAmount(row.transactionAmountCentavos),
        });
    }
    if (row.taxesAmountCentavos !== 0) {
        components.push({
            externalComponent: "TAX",
            descripcion: (0, mercadopago_1.getMercadoPagoMovementDescription)("TAX"),
            direccion: getComponentDirection(row.taxesAmountCentavos),
            montoCentavos: getComponentAmount(row.taxesAmountCentavos),
        });
    }
    if (row.feeAmountCentavos !== 0) {
        components.push({
            externalComponent: "FEE",
            descripcion: (0, mercadopago_1.getMercadoPagoMovementDescription)("FEE"),
            direccion: getComponentDirection(row.feeAmountCentavos),
            montoCentavos: getComponentAmount(row.feeAmountCentavos),
        });
    }
    // Algunas transferencias llegan sin TRANSACTION_AMOUNT, FEE ni TAXES,
    // pero con el impacto neto solo en REAL_AMOUNT.
    if (components.length === 0 &&
        row.transactionAmountCentavos === 0 &&
        row.taxesAmountCentavos === 0 &&
        row.feeAmountCentavos === 0 &&
        row.realAmountCentavos !== 0) {
        components.push({
            externalComponent: "TRANSACTION",
            descripcion: row.payerName ? `Mercado Pago - ${row.payerName}` : "Mercado Pago",
            direccion: getComponentDirection(row.realAmountCentavos),
            montoCentavos: getComponentAmount(row.realAmountCentavos),
        });
    }
    return components.map((component) => ({
        ...component,
        reportId: row.reportId,
        sourceId: row.sourceId,
        fecha: row.transactionDate,
        payerName: row.payerName,
        externalReference: row.externalReference,
        paymentMethod: row.paymentMethod,
        paymentMethodType: row.paymentMethodType,
        transactionType: row.transactionType,
        transactionAmountCentavos: row.transactionAmountCentavos,
        transactionDate: row.transactionDate,
        feeAmountCentavos: row.feeAmountCentavos,
        settlementDate: row.settlementDate,
        realAmountCentavos: row.realAmountCentavos,
        taxesAmountCentavos: row.taxesAmountCentavos,
        moneyReleaseDate: row.moneyReleaseDate,
        description: row.description,
        businessUnit: row.businessUnit,
        subUnit: row.subUnit,
        reconciliationDifferenceCentavos: row.reconciliationDifferenceCentavos,
        reconciliationExpectedCentavos: row.reconciliationExpectedCentavos,
        createdByUserId: row.createdByUserId,
    }));
}
function parseMercadoPagoCsv(csvText) {
    const trimmed = csvText.trim();
    if (!trimmed) {
        return [];
    }
    return (0, sync_1.parse)(trimmed, {
        bom: true,
        columns: true,
        delimiter: ";",
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
    });
}
async function finalizeSyncFailure(syncId, error) {
    const message = sanitizeMercadoPagoError(error);
    await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.findByIdAndUpdate(syncId, {
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
        details: extractMercadoPagoErrorDetails(error),
    });
    return message;
}
async function processMercadoPagoSyncDocument(syncId, reportId, fileName) {
    const sync = await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.findById(syncId).lean();
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
            const transactionDate = parseMercadoPagoDateValue(rawRow.TRANSACTION_DATE, "TRANSACTION_DATE", { required: true });
            if (!transactionDate) {
                cantidadAdvertencias += 1;
                cantidadMovimientosIgnorados += 1;
                continue;
            }
            const transactionAmountCentavos = parseMercadoPagoAmountToCents(rawRow.TRANSACTION_AMOUNT, "TRANSACTION_AMOUNT");
            const feeAmountCentavos = parseMercadoPagoAmountToCents(rawRow.FEE_AMOUNT, "FEE_AMOUNT");
            const taxesAmountCentavos = parseMercadoPagoAmountToCents(rawRow.TAXES_AMOUNT, "TAXES_AMOUNT");
            const realAmountCentavos = parseMercadoPagoAmountToCents(rawRow.REAL_AMOUNT, "REAL_AMOUNT");
            const settlementDate = parseMercadoPagoDateValue(rawRow.SETTLEMENT_DATE, "SETTLEMENT_DATE");
            const moneyReleaseDate = parseMercadoPagoDateValue(rawRow.MONEY_RELEASE_DATE, "MONEY_RELEASE_DATE");
            const reconciliationExpectedCentavos = transactionAmountCentavos + feeAmountCentavos + taxesAmountCentavos;
            const reconciliationDifferenceCentavos = reconciliationExpectedCentavos - realAmountCentavos;
            if (Math.abs(reconciliationDifferenceCentavos) >
                mercadopago_1.MERCADO_PAGO_RECONCILIATION_TOLERANCE_CENTAVOS) {
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
                payerName: rawRow.PAYER_NAME?.trim() || null,
                externalReference: rawRow.EXTERNAL_REFERENCE?.trim() || null,
                paymentMethod: rawRow.PAYMENT_METHOD?.trim() || null,
                paymentMethodType: rawRow.PAYMENT_METHOD_TYPE?.trim() || null,
                transactionType: rawRow.TRANSACTION_TYPE?.trim() || null,
                transactionAmountCentavos,
                transactionDate,
                feeAmountCentavos,
                settlementDate,
                realAmountCentavos,
                taxesAmountCentavos,
                moneyReleaseDate,
                description: rawRow.DESCRIPTION?.trim() || null,
                businessUnit: rawRow.BUSINESS_UNIT?.trim() || null,
                subUnit: rawRow.SUB_UNIT?.trim() || null,
                reconciliationDifferenceCentavos,
                reconciliationExpectedCentavos,
                createdByUserId: String(sync.createdByUserId),
            });
            if (components.length === 0) {
                cantidadMovimientosIgnorados += 1;
                continue;
            }
            for (const component of components) {
                const result = await (0, movimientos_1.createMercadoPagoMovement)(component);
                if (result.created) {
                    cantidadMovimientosCreados += 1;
                }
                else {
                    cantidadMovimientosIgnorados += 1;
                }
            }
        }
        catch (error) {
            cantidadAdvertencias += 1;
            cantidadMovimientosIgnorados += 1;
            logMercadoPagoWarning("Se ignoro una fila invalida de Mercado Pago", {
                syncId: String(syncId),
                error: sanitizeMercadoPagoError(error),
            });
        }
    }
    await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.findByIdAndUpdate(syncId, {
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
async function claimSyncForProcessing(syncId) {
    const now = new Date();
    const staleStartedAt = new Date(now.getTime() - PROCESSING_LEASE_MS);
    const claimed = await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.findOneAndUpdate({
        _id: syncId,
        $or: [
            { status: { $in: ["PENDING", "WAITING_REPORT"] } },
            {
                status: "PROCESSING",
                processingStartedAt: { $lte: staleStartedAt },
            },
        ],
    }, {
        $set: {
            status: "PROCESSING",
            processingStartedAt: now,
            lastCheckedAt: now,
            error: null,
        },
    }, {
        returnDocument: "after",
    }).lean();
    return Boolean(claimed);
}
async function startMercadoPagoSync(input) {
    await (0, mongoose_2.connectToDatabase)();
    await (0, tipos_movimientos_1.ensureDefaultMovementTypes)();
    if (!(0, mercadopago_1.hasMercadoPagoAccessToken)()) {
        throw new api_1.AppError("INTERNAL_ERROR", "Falta configurar MERCADOPAGO_ACCESS_TOKEN en el backend", 500);
    }
    await assertMercadoPagoRateLimitCooldownInactive();
    const createdByUserId = await resolveSyncActorUserId(input.requestedByUserId);
    const now = new Date();
    const recentThreshold = new Date(now.getTime() - getSyncRecencyWindowMs(input.syncType));
    const existingOpenSync = await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.findOne({
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
    const sync = await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.create({
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
        createdByUserId: new mongoose_1.Types.ObjectId(createdByUserId),
    });
    try {
        const report = await createMercadoPagoReport(beginDate, endDate);
        let updated;
        try {
            updated = await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.findByIdAndUpdate(sync._id, {
                $set: {
                    reportId: report.id ?? null,
                    fileName: report.file_name ?? null,
                    remoteStatus: report.status ?? null,
                    status: report.status === "processed" && report.file_name
                        ? "PROCESSING"
                        : "WAITING_REPORT",
                    processingStartedAt: report.status === "processed" && report.file_name ? new Date() : null,
                    lastCheckedAt: new Date(),
                },
            }, { returnDocument: "after" }).lean();
        }
        catch (error) {
            if (isMongoDuplicateKeyError(error) && typeof report.id === "number") {
                const existing = await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.findOne({
                    reportId: report.id,
                }).lean();
                await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.findByIdAndDelete(sync._id);
                if (existing) {
                    return {
                        created: false,
                        sync: toMercadoPagoSyncDto(existing),
                    };
                }
            }
            throw error;
        }
        if (updated &&
            updated.status === "PROCESSING" &&
            typeof updated.reportId === "number" &&
            updated.fileName) {
            try {
                await processMercadoPagoSyncDocument(updated._id, updated.reportId, updated.fileName);
            }
            catch (error) {
                await finalizeSyncFailure(updated._id, error);
            }
            const refreshed = await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.findById(updated._id).lean();
            if (refreshed) {
                return { created: true, sync: toMercadoPagoSyncDto(refreshed) };
            }
        }
        return {
            created: true,
            sync: toMercadoPagoSyncDto(updated ?? sync.toObject()),
        };
    }
    catch (error) {
        const failureMessage = await finalizeSyncFailure(sync._id, error);
        throw new api_1.AppError("INTERNAL_ERROR", failureMessage, 500);
    }
}
async function runMercadoPagoAutomaticMaintenanceIfDue() {
    await (0, mongoose_2.connectToDatabase)();
    if (!(0, mercadopago_1.hasMercadoPagoAccessToken)()) {
        return { checkedPending: false, startedHourlySync: false };
    }
    const now = new Date();
    let checkedPending = false;
    let startedHourlySync = false;
    const recentPendingCheckThreshold = new Date(now.getTime() - MERCADO_PAGO_AUTOMATIC_PENDING_CHECK_WINDOW_MS);
    const hasRecentPendingReview = await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.exists({
        status: { $in: NON_TERMINAL_SYNC_STATUSES },
        lastCheckedAt: { $gte: recentPendingCheckThreshold },
    });
    if (!hasRecentPendingReview) {
        await checkPendingMercadoPagoSyncs();
        checkedPending = true;
    }
    const recentHourlyThreshold = new Date(now.getTime() - MERCADO_PAGO_AUTOMATIC_HOURLY_SYNC_WINDOW_MS);
    const hasRecentHourlySync = await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.exists({
        tipoSincronizacion: "hourly",
        createdAt: { $gte: recentHourlyThreshold },
    });
    if (!hasRecentHourlySync) {
        try {
            const result = await startMercadoPagoSync({ syncType: "hourly" });
            startedHourlySync = result.created;
        }
        catch (error) {
            const message = sanitizeMercadoPagoError(error);
            if (!isMercadoPagoRateLimitMessage(message)) {
                throw error;
            }
            logMercadoPagoWarning("Se omitio una sync automatica de Mercado Pago por cooldown de rate limit", {
                error: message,
            });
        }
    }
    return { checkedPending, startedHourlySync };
}
async function listMercadoPagoSyncs(query) {
    await (0, mongoose_2.connectToDatabase)();
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
        mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.countDocuments({}),
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
async function checkPendingMercadoPagoSyncs() {
    await (0, mongoose_2.connectToDatabase)();
    if (!(0, mercadopago_1.hasMercadoPagoAccessToken)()) {
        return { processed: 0, failed: 0, waiting: 0 };
    }
    const openSyncs = await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.find({
        status: { $in: NON_TERMINAL_SYNC_STATUSES },
    })
        .sort({ createdAt: 1 })
        .lean();
    if (openSyncs.length === 0) {
        return { processed: 0, failed: 0, waiting: 0 };
    }
    let reports = [];
    try {
        reports = await listMercadoPagoReports();
    }
    catch (error) {
        logMercadoPagoError("No se pudo consultar el listado de reportes pendientes", {
            error: sanitizeMercadoPagoError(error),
        });
        return { processed: 0, failed: 0, waiting: openSyncs.length };
    }
    const reportMap = new Map(reports
        .filter((report) => typeof report.id === "number")
        .map((report) => [report.id, report]));
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
            await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.findByIdAndUpdate(sync._id, {
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
            await mercadopago_settlement_sync_1.MercadoPagoSettlementSyncModel.findByIdAndUpdate(sync._id, {
                $set: {
                    status: "FAILED",
                    remoteStatus: remoteReport?.status ?? "failed",
                    error: "Mercado Pago informo que la generacion del reporte fallo",
                    processingStartedAt: null,
                    lastCheckedAt: new Date(),
                },
            });
            logMercadoPagoError("Mercado Pago marco un reporte como fallido", {
                syncId: String(sync._id),
                reportId: sync.reportId,
                remoteStatus: remoteReport?.status ?? "failed",
                fileName,
            });
            continue;
        }
        if (remoteStatus === "processed" && fileName) {
            const claimed = await claimSyncForProcessing(sync._id);
            if (!claimed) {
                waiting += 1;
                continue;
            }
            try {
                await processMercadoPagoSyncDocument(sync._id, sync.reportId, fileName);
                processed += 1;
            }
            catch (error) {
                failed += 1;
                await finalizeSyncFailure(sync._id, error);
            }
            continue;
        }
        waiting += 1;
    }
    return { processed, failed, waiting };
}
