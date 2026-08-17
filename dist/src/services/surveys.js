"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireWhatsAppWorkerLease = acquireWhatsAppWorkerLease;
exports.releaseWhatsAppWorkerLease = releaseWhatsAppWorkerLease;
exports.previewSurveyWorkbook = previewSurveyWorkbook;
exports.createSurveyCampaignFromPreview = createSurveyCampaignFromPreview;
exports.listSurveyDashboard = listSurveyDashboard;
exports.getSurveyCampaignDetail = getSurveyCampaignDetail;
exports.updateSurveyCampaignStatus = updateSurveyCampaignStatus;
exports.cancelSurveyById = cancelSurveyById;
exports.getSurveySettings = getSurveySettings;
exports.updateSurveySettings = updateSurveySettings;
exports.getWhatsAppConnectionStatus = getWhatsAppConnectionStatus;
exports.requestWhatsAppDisconnect = requestWhatsAppDisconnect;
exports.prepareWhatsAppQrLinking = prepareWhatsAppQrLinking;
exports.ensureSurveySettingsForWorker = ensureSurveySettingsForWorker;
exports.updateWhatsAppConnectionState = updateWhatsAppConnectionState;
exports.isWhatsAppDisconnectRequested = isWhatsAppDisconnectRequested;
exports.clearWhatsAppAuthState = clearWhatsAppAuthState;
exports.getStoredWhatsAppAuthRecords = getStoredWhatsAppAuthRecords;
exports.upsertWhatsAppAuthRecord = upsertWhatsAppAuthRecord;
exports.removeWhatsAppAuthRecord = removeWhatsAppAuthRecord;
exports.expireNoResponseSurveys = expireNoResponseSurveys;
exports.takeNextSurveyLease = takeNextSurveyLease;
exports.markSurveySendSuccess = markSurveySendSuccess;
exports.markSurveySendFailure = markSurveySendFailure;
exports.markLeasesAsDeliveryUnknown = markLeasesAsDeliveryUnknown;
exports.maybeCompleteCampaign = maybeCompleteCampaign;
exports.processIncomingWhatsAppMessage = processIncomingWhatsAppMessage;
exports.buildSurveyIntroMessage = buildSurveyIntroMessage;
exports.getWorkerHealthSnapshot = getWorkerHealthSnapshot;
exports.getWhatsappDisconnectRequestedAt = getWhatsappDisconnectRequestedAt;
exports.seedSurveyUserSnapshot = seedSurveyUserSnapshot;
const qrcode_1 = __importDefault(require("qrcode"));
const mongoose_1 = require("mongoose");
const XLSX = __importStar(require("xlsx"));
const api_1 = require("@/lib/api");
const mongoose_2 = require("@/lib/db/mongoose");
const surveys_1 = require("@/lib/surveys");
const survey_campaign_1 = require("@/models/survey-campaign");
const survey_settings_1 = require("@/models/survey-settings");
const survey_1 = require("@/models/survey");
const user_1 = require("@/models/user");
const whatsapp_auth_1 = require("@/models/whatsapp-auth");
const whatsapp_connection_1 = require("@/models/whatsapp-connection");
const whatsapp_contact_1 = require("@/models/whatsapp-contact");
function extractDocumentId(value) {
    if (!value) {
        return "";
    }
    if (value instanceof mongoose_1.Types.ObjectId) {
        return value.toString();
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "object" && value !== null && "_id" in value) {
        const nestedId = value._id;
        if (nestedId instanceof mongoose_1.Types.ObjectId) {
            return nestedId.toString();
        }
        if (typeof nestedId === "string") {
            return nestedId;
        }
    }
    return String(value);
}
function toSurveyDto(document) {
    return {
        id: String(document._id),
        campaignId: extractDocumentId(document.campaignId),
        campaignFileName: document.campaign?.fileName ?? null,
        campaignStatus: document.campaign?.status ?? null,
        patientNameSnapshot: document.patientNameSnapshot,
        doctorNameSnapshot: document.doctorNameSnapshot,
        phoneMasked: (0, surveys_1.maskPhoneNumber)(document.phoneE164),
        attendanceAt: document.attendanceAt.toISOString(),
        status: document.status,
        rating: document.rating,
        comment: document.comment,
        sendAttemptCount: document.sendAttemptCount,
        invalidReplyCount: document.invalidReplyCount,
        sentAt: document.sentAt?.toISOString() ?? null,
        completedAt: document.completedAt?.toISOString() ?? null,
        technicalError: document.technicalError,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
    };
}
function toSurveyCampaignDto(document, counters) {
    return {
        id: String(document._id),
        fileName: document.fileName,
        importedByUserId: extractDocumentId(document.importedByUserId),
        importedByUserName: `${document.importedByUser?.name ?? ""} ${document.importedByUser?.apellido ?? ""}`.trim(),
        status: document.status,
        totalRows: document.totalRows,
        validRows: document.validRows,
        duplicateRows: document.duplicateRows,
        invalidRows: document.invalidRows,
        startedAt: document.startedAt?.toISOString() ?? null,
        pausedAt: document.pausedAt?.toISOString() ?? null,
        completedAt: document.completedAt?.toISOString() ?? null,
        cancelledAt: document.cancelledAt?.toISOString() ?? null,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
        ...counters,
    };
}
function toSurveySettingsDto(document) {
    return {
        surveysEnabled: document.surveysEnabled,
        globalPause: document.globalPause,
        phoneForAppointments: document.phoneForAppointments,
        sendIntervalSeconds: document.sendIntervalSeconds,
        sendWindowStart: document.sendWindowStart,
        sendWindowEnd: document.sendWindowEnd,
        noResponseTimeoutHours: document.noResponseTimeoutHours,
        technicalRetryLimit: document.technicalRetryLimit,
        surveyIntroTemplate: document.surveyIntroTemplate,
        commentOptInTemplate: document.commentOptInTemplate,
        commentRequestTemplate: document.commentRequestTemplate,
        thankYouTemplate: document.thankYouTemplate,
        invalidRatingTemplate: document.invalidRatingTemplate,
        invalidCommentOptInTemplate: document.invalidCommentOptInTemplate,
        unsupportedCommentTemplate: document.unsupportedCommentTemplate,
        spontaneousMessageTemplate: document.spontaneousMessageTemplate,
        updatedAt: document.updatedAt.toISOString(),
    };
}
async function ensureSurveySettingsDocument() {
    const defaults = (0, surveys_1.getDefaultSurveyTemplates)();
    return survey_settings_1.SurveySettingsModel.findOneAndUpdate({}, {
        $setOnInsert: {
            surveysEnabled: true,
            globalPause: false,
            phoneForAppointments: "2995099606",
            sendIntervalSeconds: 60,
            sendWindowStart: "09:00",
            sendWindowEnd: "18:00",
            noResponseTimeoutHours: 24,
            technicalRetryLimit: 2,
            ...defaults,
        },
    }, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
    });
}
async function ensureWhatsAppConnectionDocument() {
    return whatsapp_connection_1.WhatsAppConnectionModel.findOneAndUpdate({ singletonKey: "main" }, {
        $setOnInsert: {
            singletonKey: "main",
            status: "disconnected",
        },
    }, { new: true, upsert: true, setDefaultsOnInsert: true });
}
async function acquireWhatsAppWorkerLease(input) {
    await (0, mongoose_2.connectToDatabase)();
    await ensureWhatsAppConnectionDocument();
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + (input.ttlMs ?? 30_000));
    const connection = await whatsapp_connection_1.WhatsAppConnectionModel.findOneAndUpdate({
        singletonKey: "main",
        $or: [
            { workerLeaseUntil: null },
            { workerLeaseUntil: { $lt: now } },
            { workerLeaseOwner: input.ownerId },
        ],
    }, {
        $set: {
            workerLeaseOwner: input.ownerId,
            workerLeaseUntil: leaseUntil,
            workerHeartbeatAt: now,
        },
        $setOnInsert: {
            singletonKey: "main",
        },
    }, {
        upsert: false,
        returnDocument: "after",
    }).lean();
    return connection?.workerLeaseOwner === input.ownerId;
}
async function releaseWhatsAppWorkerLease(ownerId) {
    await (0, mongoose_2.connectToDatabase)();
    await whatsapp_connection_1.WhatsAppConnectionModel.findOneAndUpdate({
        singletonKey: "main",
        workerLeaseOwner: ownerId,
    }, {
        $set: {
            workerLeaseOwner: null,
            workerLeaseUntil: null,
            workerHeartbeatAt: null,
        },
    });
}
async function previewSurveyWorkbook(fileName, fileBuffer) {
    const workbook = XLSX.read(Buffer.from(fileBuffer), {
        type: "buffer",
        cellDates: true,
        raw: true,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new api_1.AppError("VALIDATION_ERROR", "El archivo no contiene hojas", 400);
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: true,
    });
    const headerRow = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        range: 0,
        blankrows: false,
        defval: "",
    })[0] ?? [];
    const normalizedHeaders = headerRow.map((header) => String(header).trim().toLowerCase());
    const missingHeaders = surveys_1.SURVEY_REQUIRED_HEADERS.filter((header) => !normalizedHeaders.includes(header));
    if (missingHeaders.length > 0) {
        throw new api_1.AppError("VALIDATION_ERROR", `Faltan columnas obligatorias: ${missingHeaders.join(", ")}`, 400);
    }
    const previewRows = (0, surveys_1.mapSheetRowsToPreviewRows)(rows);
    return {
        fileName,
        importedYear: surveys_1.SURVEY_DEFAULT_YEAR,
        rows: previewRows,
        summary: {
            totalRows: previewRows.length,
            validRows: previewRows.filter((row) => row.valid).length,
            duplicateRows: previewRows.filter((row) => row.duplicate).length,
            invalidRows: previewRows.filter((row) => row.errors.length > 0).length,
        },
    };
}
async function createSurveyCampaignFromPreview(input) {
    await (0, mongoose_2.connectToDatabase)();
    const selectedRows = input.rows.filter((row) => row.selected && row.valid);
    if (selectedRows.length === 0) {
        throw new api_1.AppError("VALIDATION_ERROR", "Debes seleccionar al menos una fila valida para crear la campana", 400);
    }
    const conflictingActivePhones = new Set((await survey_1.SurveyModel.find({
        phoneE164: { $in: selectedRows.map((row) => row.phoneE164) },
        status: { $in: surveys_1.SURVEY_ACTIVE_STATUSES },
    })
        .select("phoneE164")
        .lean()).map((survey) => survey.phoneE164));
    if (conflictingActivePhones.size > 0) {
        throw new api_1.AppError("VALIDATION_ERROR", "Hay telefonos con una encuesta activa. Espera a que terminen o cancela la encuesta vigente.", 409);
    }
    const duplicateExisting = await survey_1.SurveyModel.find({
        $or: selectedRows.map((row) => ({
            phoneE164: row.phoneE164,
            attendanceAt: new Date(row.attendanceAt),
        })),
    })
        .select("_id status")
        .lean();
    const nonCancelledDuplicates = duplicateExisting.filter((survey) => survey.status !== "cancelled");
    if (nonCancelledDuplicates.length > 0) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ya existe al menos una encuesta para alguna de las atenciones seleccionadas", 409);
    }
    if (duplicateExisting.length > 0) {
        await survey_1.SurveyModel.deleteMany({
            _id: { $in: duplicateExisting.map((survey) => survey._id) },
            status: "cancelled",
        });
    }
    const campaign = await survey_campaign_1.SurveyCampaignModel.create({
        fileName: input.fileName,
        importedByUserId: new mongoose_1.Types.ObjectId(input.user.id),
        status: "ready",
        totalRows: input.rows.length,
        validRows: input.rows.filter((row) => row.valid).length,
        duplicateRows: input.rows.filter((row) => row.duplicate).length,
        invalidRows: input.rows.filter((row) => row.errors.length > 0).length,
    });
    const createdSurveys = await survey_1.SurveyModel.insertMany(selectedRows.map((row) => ({
        campaignId: campaign._id,
        patientNameSnapshot: row.patientNameSnapshot,
        doctorNameSnapshot: row.doctorNameSnapshot,
        phoneRaw: row.phoneRaw,
        phoneE164: row.phoneE164,
        attendanceAt: new Date(row.attendanceAt),
        status: "queued",
        rating: null,
        comment: null,
        createdByUserId: new mongoose_1.Types.ObjectId(input.user.id),
        scheduledAt: null,
        leaseUntil: null,
        sendAttemptCount: 0,
        providerMessageId: null,
        sentAt: null,
        firstResponseAt: null,
        completedAt: null,
        lastInboundAt: null,
        invalidReplyCount: 0,
        technicalError: null,
        deliveryResolution: null,
    })));
    const populatedCampaign = await survey_campaign_1.SurveyCampaignModel.findById(campaign._id)
        .populate("importedByUserId", "name apellido")
        .lean();
    if (!populatedCampaign) {
        throw new api_1.AppError("INTERNAL_ERROR", "No se pudo recuperar la campana creada", 500);
    }
    return {
        campaign: toSurveyCampaignDto({
            ...populatedCampaign,
            importedByUser: populatedCampaign.importedByUserId,
        }, (0, surveys_1.buildSurveyCounters)(createdSurveys.map((survey) => ({ status: survey.status })))),
    };
}
async function listSurveyDashboard(input) {
    await (0, mongoose_2.connectToDatabase)();
    const skip = (input.page - 1) * input.limit;
    const surveyFilter = {};
    if (input.status) {
        surveyFilter.status =
            input.status === "waiting"
                ? { $in: surveys_1.SURVEY_WAITING_STATUSES }
                : input.status;
    }
    if (input.search) {
        const regex = { $regex: input.search, $options: "i" };
        const matchingCampaignIds = (await survey_campaign_1.SurveyCampaignModel.find({ fileName: regex }).select("_id").lean()).map((campaign) => campaign._id);
        surveyFilter.$or = [
            { patientNameSnapshot: regex },
            { doctorNameSnapshot: regex },
            { phoneE164: regex },
            { phoneRaw: regex },
            ...(matchingCampaignIds.length > 0 ? [{ campaignId: { $in: matchingCampaignIds } }] : []),
        ];
    }
    const [surveyRows, total, allSurveyStatuses] = await Promise.all([
        survey_1.SurveyModel.find(surveyFilter)
            .populate("campaignId", "fileName status")
            .sort({ createdAt: -1, attendanceAt: -1 })
            .skip(skip)
            .limit(input.limit)
            .lean(),
        survey_1.SurveyModel.countDocuments(surveyFilter),
        survey_1.SurveyModel.find({})
            .select("status")
            .lean(),
    ]);
    const waiting = allSurveyStatuses.filter((survey) => surveys_1.SURVEY_WAITING_STATUSES.includes(survey.status)).length;
    return {
        totalsToday: {
            queued: allSurveyStatuses.filter((survey) => survey.status === "queued").length,
            waiting,
            completed: allSurveyStatuses.filter((survey) => survey.status === "completed").length,
            noResponse: allSurveyStatuses.filter((survey) => survey.status === "no_response").length,
            sendFailed: allSurveyStatuses.filter((survey) => survey.status === "send_failed").length,
            deliveryUnknown: allSurveyStatuses.filter((survey) => survey.status === "delivery_unknown").length,
        },
        surveys: surveyRows.map((survey) => toSurveyDto({
            ...survey,
            campaign: survey.campaignId,
        })),
        pagination: {
            page: input.page,
            limit: input.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / input.limit)),
        },
    };
}
async function getSurveyCampaignDetail(campaignId) {
    await (0, mongoose_2.connectToDatabase)();
    const campaign = await survey_campaign_1.SurveyCampaignModel.findById(campaignId)
        .populate("importedByUserId", "name apellido")
        .lean();
    if (!campaign) {
        throw new api_1.AppError("NOT_FOUND", "La campana no existe", 404);
    }
    const surveys = await survey_1.SurveyModel.find({ campaignId: campaign._id })
        .sort({ attendanceAt: 1, createdAt: 1 })
        .lean();
    return {
        campaign: toSurveyCampaignDto({
            ...campaign,
            importedByUser: campaign.importedByUserId,
        }, (0, surveys_1.buildSurveyCounters)(surveys.map((survey) => ({ status: survey.status })))),
        surveys: surveys.map((survey) => toSurveyDto({
            ...survey,
            campaign: {
                fileName: campaign.fileName,
                status: campaign.status,
            },
        })),
    };
}
async function updateSurveyCampaignStatus(input) {
    await (0, mongoose_2.connectToDatabase)();
    const campaign = await survey_campaign_1.SurveyCampaignModel.findById(input.campaignId);
    if (!campaign) {
        throw new api_1.AppError("NOT_FOUND", "La campana no existe", 404);
    }
    const now = new Date();
    if (input.action === "start") {
        if (campaign.status !== "ready") {
            throw new api_1.AppError("VALIDATION_ERROR", "Solo se pueden iniciar campanas listas", 409);
        }
        campaign.status = "running";
        campaign.startedAt = now;
        campaign.pausedAt = null;
    }
    if (input.action === "pause") {
        if (campaign.status !== "running") {
            throw new api_1.AppError("VALIDATION_ERROR", "Solo se pueden pausar campanas en curso", 409);
        }
        campaign.status = "paused";
        campaign.pausedAt = now;
    }
    if (input.action === "resume") {
        if (campaign.status !== "paused") {
            throw new api_1.AppError("VALIDATION_ERROR", "Solo se pueden reanudar campanas pausadas", 409);
        }
        campaign.status = "running";
        campaign.pausedAt = null;
    }
    if (input.action === "cancel") {
        if (campaign.status === "completed" || campaign.status === "cancelled") {
            throw new api_1.AppError("VALIDATION_ERROR", "La campana ya no admite cancelacion", 409);
        }
        campaign.status = "cancelled";
        campaign.cancelledAt = now;
        await survey_1.SurveyModel.updateMany({
            campaignId: campaign._id,
            status: { $in: surveys_1.SURVEY_ACTIVE_STATUSES },
        }, {
            $set: {
                status: "cancelled",
                completedAt: now,
                leaseUntil: null,
                deliveryResolution: "cancelled_by_admin",
            },
        });
    }
    await campaign.save();
    return getSurveyCampaignDetail(String(campaign._id));
}
async function cancelSurveyById(surveyId) {
    await (0, mongoose_2.connectToDatabase)();
    const survey = await survey_1.SurveyModel.findById(surveyId);
    if (!survey) {
        throw new api_1.AppError("NOT_FOUND", "La encuesta no existe", 404);
    }
    if (!surveys_1.SURVEY_ACTIVE_STATUSES.includes(survey.status)) {
        throw new api_1.AppError("VALIDATION_ERROR", "Solo se pueden cancelar encuestas activas", 409);
    }
    survey.status = "cancelled";
    survey.completedAt = new Date();
    survey.leaseUntil = null;
    survey.deliveryResolution = "cancelled_by_admin";
    await survey.save();
    return toSurveyDto(survey.toObject());
}
async function getSurveySettings() {
    await (0, mongoose_2.connectToDatabase)();
    const settings = await ensureSurveySettingsDocument();
    return toSurveySettingsDto(settings.toObject());
}
async function updateSurveySettings(input) {
    await (0, mongoose_2.connectToDatabase)();
    const settings = await ensureSurveySettingsDocument();
    Object.assign(settings, input);
    await settings.save();
    return toSurveySettingsDto(settings.toObject());
}
async function getWhatsAppConnectionStatus() {
    await (0, mongoose_2.connectToDatabase)();
    const connection = await ensureWhatsAppConnectionDocument();
    const qrDataUrl = connection.qr
        ? await qrcode_1.default.toDataURL(connection.qr, { margin: 1, width: 320 })
        : null;
    return {
        status: connection.status,
        phoneNumber: connection.phoneNumber,
        qrDataUrl,
        qrExpiresAt: connection.qrExpiresAt?.toISOString() ?? null,
        lastConnectedAt: connection.lastConnectedAt?.toISOString() ?? null,
        lastDisconnectedAt: connection.lastDisconnectedAt?.toISOString() ?? null,
        lastError: connection.lastError,
        disconnectRequestedAt: connection.disconnectRequestedAt?.toISOString() ?? null,
        updatedAt: connection.updatedAt?.toISOString() ?? null,
    };
}
async function requestWhatsAppDisconnect() {
    await (0, mongoose_2.connectToDatabase)();
    await whatsapp_connection_1.WhatsAppConnectionModel.findOneAndUpdate({ singletonKey: "main" }, {
        $set: {
            status: "disconnecting",
            disconnectRequestedAt: new Date(),
        },
        $setOnInsert: {
            singletonKey: "main",
        },
    }, {
        upsert: true,
    });
    return getWhatsAppConnectionStatus();
}
async function prepareWhatsAppQrLinking() {
    await clearWhatsAppAuthState();
    await whatsapp_connection_1.WhatsAppConnectionModel.findOneAndUpdate({ singletonKey: "main" }, {
        $set: {
            status: "disconnected",
            phoneNumber: null,
            qr: null,
            qrExpiresAt: null,
            lastError: null,
            disconnectRequestedAt: null,
        },
        $setOnInsert: {
            singletonKey: "main",
        },
    }, {
        upsert: true,
    });
    return getWhatsAppConnectionStatus();
}
async function ensureSurveySettingsForWorker() {
    await (0, mongoose_2.connectToDatabase)();
    return ensureSurveySettingsDocument();
}
async function updateWhatsAppConnectionState(input) {
    await (0, mongoose_2.connectToDatabase)();
    const now = new Date();
    const update = {
        status: input.status,
        updatedAt: now,
    };
    if ("phoneNumber" in input) {
        update.phoneNumber = input.phoneNumber ?? null;
    }
    if ("qr" in input) {
        update.qr = input.qr ?? null;
    }
    if ("qrExpiresAt" in input) {
        update.qrExpiresAt = input.qrExpiresAt ?? null;
    }
    if ("lastError" in input) {
        update.lastError = input.lastError ?? null;
    }
    if (input.connected) {
        update.lastConnectedAt = now;
        update.lastDisconnectedAt = null;
    }
    if (input.disconnected) {
        update.lastDisconnectedAt = now;
    }
    if (input.clearDisconnectRequest) {
        update.disconnectRequestedAt = null;
    }
    await whatsapp_connection_1.WhatsAppConnectionModel.findOneAndUpdate({ singletonKey: "main" }, {
        $set: update,
        $setOnInsert: {
            singletonKey: "main",
        },
    }, { upsert: true });
}
async function isWhatsAppDisconnectRequested() {
    await (0, mongoose_2.connectToDatabase)();
    const connection = await ensureWhatsAppConnectionDocument();
    return Boolean(connection.disconnectRequestedAt);
}
async function clearWhatsAppAuthState() {
    await (0, mongoose_2.connectToDatabase)();
    await Promise.all([
        whatsapp_auth_1.WhatsAppAuthModel.deleteMany({}),
        whatsapp_connection_1.WhatsAppConnectionModel.findOneAndUpdate({ singletonKey: "main" }, {
            $set: {
                status: "disconnected",
                phoneNumber: null,
                qr: null,
                qrExpiresAt: null,
                disconnectRequestedAt: null,
            },
        }, { upsert: true }),
    ]);
}
async function getStoredWhatsAppAuthRecords() {
    await (0, mongoose_2.connectToDatabase)();
    return whatsapp_auth_1.WhatsAppAuthModel.find({}).lean();
}
async function upsertWhatsAppAuthRecord(key, value) {
    await (0, mongoose_2.connectToDatabase)();
    await whatsapp_auth_1.WhatsAppAuthModel.findOneAndUpdate({ key }, {
        $set: { value },
        $setOnInsert: { key },
    }, { upsert: true });
}
async function removeWhatsAppAuthRecord(key) {
    await (0, mongoose_2.connectToDatabase)();
    await whatsapp_auth_1.WhatsAppAuthModel.deleteOne({ key });
}
async function expireNoResponseSurveys() {
    await (0, mongoose_2.connectToDatabase)();
    const settings = await ensureSurveySettingsDocument();
    const cutoff = new Date(Date.now() - settings.noResponseTimeoutHours * 60 * 60 * 1000);
    await survey_1.SurveyModel.updateMany({
        status: { $in: surveys_1.SURVEY_WAITING_STATUSES },
        sentAt: { $lte: cutoff },
    }, {
        $set: {
            status: "no_response",
            completedAt: new Date(),
        },
    });
}
async function takeNextSurveyLease() {
    await (0, mongoose_2.connectToDatabase)();
    const settings = await ensureSurveySettingsDocument();
    if (!settings.surveysEnabled || settings.globalPause) {
        return null;
    }
    if (!(0, surveys_1.isWithinSurveySendWindow)(new Date(), settings.sendWindowStart, settings.sendWindowEnd)) {
        return null;
    }
    const latestSentSurvey = await survey_1.SurveyModel.findOne({
        sentAt: { $ne: null },
    })
        .sort({ sentAt: -1 })
        .select("sentAt")
        .lean();
    if (latestSentSurvey?.sentAt &&
        Date.now() - new Date(latestSentSurvey.sentAt).getTime() <
            settings.sendIntervalSeconds * 1000) {
        return null;
    }
    const runningCampaigns = await survey_campaign_1.SurveyCampaignModel.find({
        status: { $in: surveys_1.SURVEY_RUNNING_CAMPAIGN_STATUSES.filter((status) => status !== "paused") },
    })
        .select("_id")
        .lean();
    if (runningCampaigns.length === 0) {
        return null;
    }
    const campaignIds = runningCampaigns.map((campaign) => campaign._id);
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 5 * 60 * 1000);
    const leased = await survey_1.SurveyModel.findOneAndUpdate({
        campaignId: { $in: campaignIds },
        status: "queued",
        $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now } }],
    }, {
        $set: {
            status: "leased_for_send",
            leaseUntil,
            technicalError: null,
        },
        $inc: {
            sendAttemptCount: 1,
        },
    }, {
        sort: { createdAt: 1 },
        new: true,
    }).lean();
    return leased;
}
async function markSurveySendSuccess(input) {
    await (0, mongoose_2.connectToDatabase)();
    await survey_1.SurveyModel.findByIdAndUpdate(input.surveyId, {
        $set: {
            status: "waiting_rating",
            providerMessageId: input.providerMessageId,
            sentAt: new Date(),
            scheduledAt: new Date(),
            leaseUntil: null,
            technicalError: null,
            deliveryResolution: "accepted_by_provider",
        },
    });
}
async function markSurveySendFailure(input) {
    await (0, mongoose_2.connectToDatabase)();
    const settings = await ensureSurveySettingsDocument();
    const survey = await survey_1.SurveyModel.findById(input.surveyId);
    if (!survey) {
        return;
    }
    const exhausted = survey.sendAttemptCount >= settings.technicalRetryLimit;
    survey.status = exhausted ? "send_failed" : "queued";
    survey.leaseUntil = null;
    survey.technicalError = input.errorMessage;
    survey.deliveryResolution = exhausted ? "failed_after_retries" : "retry_pending";
    await survey.save();
}
async function markLeasesAsDeliveryUnknown() {
    await (0, mongoose_2.connectToDatabase)();
    await survey_1.SurveyModel.updateMany({
        status: "leased_for_send",
        leaseUntil: { $lt: new Date() },
    }, {
        $set: {
            status: "delivery_unknown",
            leaseUntil: null,
            technicalError: "La aplicacion se reinicio antes de confirmar el envio",
            deliveryResolution: "worker_interrupted_before_persist",
        },
    });
}
async function maybeCompleteCampaign(campaignId) {
    await (0, mongoose_2.connectToDatabase)();
    const surveys = await survey_1.SurveyModel.find({ campaignId }).select("status").lean();
    if (surveys.length === 0) {
        return;
    }
    const hasActive = surveys.some((survey) => surveys_1.SURVEY_ACTIVE_STATUSES.includes(survey.status));
    if (!hasActive) {
        await survey_campaign_1.SurveyCampaignModel.findByIdAndUpdate(campaignId, {
            $set: {
                status: "completed",
                completedAt: new Date(),
            },
        });
    }
}
async function processIncomingWhatsAppMessage(input) {
    await (0, mongoose_2.connectToDatabase)();
    const settings = await ensureSurveySettingsDocument();
    const text = (0, surveys_1.extractTextFromWhatsAppMessage)(input.message);
    const survey = await survey_1.SurveyModel.findOne({
        phoneE164: input.phoneE164,
        status: { $in: surveys_1.SURVEY_WAITING_STATUSES },
    }).sort({ sentAt: -1 });
    if (!survey) {
        const contact = await whatsapp_contact_1.WhatsAppContactModel.findOne({ phoneE164: input.phoneE164 });
        const now = new Date();
        const shouldReply = !contact?.lastSpontaneousReplyAt ||
            now.getTime() - contact.lastSpontaneousReplyAt.getTime() >= 24 * 60 * 60 * 1000;
        if (shouldReply) {
            await input.messenger.sendText((0, surveys_1.getWhatsappJid)(input.phoneE164), (0, surveys_1.applySurveyTemplate)(settings.spontaneousMessageTemplate, {
                appointmentsPhone: settings.phoneForAppointments,
            }));
            await whatsapp_contact_1.WhatsAppContactModel.findOneAndUpdate({ phoneE164: input.phoneE164 }, {
                $set: {
                    lastSpontaneousReplyAt: now,
                },
                $setOnInsert: {
                    phoneE164: input.phoneE164,
                },
            }, { upsert: true });
        }
        return;
    }
    const firstResponseAt = survey.firstResponseAt ?? new Date();
    survey.firstResponseAt = firstResponseAt;
    survey.lastInboundAt = new Date();
    if (survey.status === "waiting_rating") {
        if (/^[1-5]$/.test(text)) {
            survey.rating = Number(text);
            survey.status = "waiting_comment_opt_in";
            await survey.save();
            await input.messenger.sendText((0, surveys_1.getWhatsappJid)(input.phoneE164), settings.commentOptInTemplate);
            return;
        }
        survey.invalidReplyCount += 1;
        await survey.save();
        await input.messenger.sendText((0, surveys_1.getWhatsappJid)(input.phoneE164), settings.invalidRatingTemplate);
        return;
    }
    if (survey.status === "waiting_comment_opt_in") {
        if (text === "1") {
            survey.status = "waiting_comment_text";
            await survey.save();
            await input.messenger.sendText((0, surveys_1.getWhatsappJid)(input.phoneE164), settings.commentRequestTemplate);
            return;
        }
        if (text === "2") {
            survey.status = "completed";
            survey.completedAt = new Date();
            await survey.save();
            await input.messenger.sendText((0, surveys_1.getWhatsappJid)(input.phoneE164), settings.thankYouTemplate);
            await maybeCompleteCampaign(survey.campaignId);
            return;
        }
        survey.invalidReplyCount += 1;
        await survey.save();
        await input.messenger.sendText((0, surveys_1.getWhatsappJid)(input.phoneE164), settings.invalidCommentOptInTemplate);
        return;
    }
    if (survey.status === "waiting_comment_text") {
        if (!(0, surveys_1.isTextOnlyWhatsAppMessage)(input.message) || !text.trim()) {
            survey.invalidReplyCount += 1;
            await survey.save();
            await input.messenger.sendText((0, surveys_1.getWhatsappJid)(input.phoneE164), settings.unsupportedCommentTemplate);
            return;
        }
        survey.comment = text.trim();
        survey.status = "completed";
        survey.completedAt = new Date();
        await survey.save();
        await input.messenger.sendText((0, surveys_1.getWhatsappJid)(input.phoneE164), settings.thankYouTemplate);
        await maybeCompleteCampaign(survey.campaignId);
    }
}
async function buildSurveyIntroMessage(surveyId) {
    await (0, mongoose_2.connectToDatabase)();
    const settings = await ensureSurveySettingsDocument();
    const survey = await survey_1.SurveyModel.findById(surveyId).lean();
    if (!survey) {
        throw new api_1.AppError("NOT_FOUND", "La encuesta no existe", 404);
    }
    return (0, surveys_1.applySurveyTemplate)(settings.surveyIntroTemplate, {
        patientName: survey.patientNameSnapshot,
        doctorName: survey.doctorNameSnapshot,
    });
}
async function getWorkerHealthSnapshot() {
    await (0, mongoose_2.connectToDatabase)();
    const [connection, settings] = await Promise.all([
        ensureWhatsAppConnectionDocument(),
        ensureSurveySettingsDocument(),
    ]);
    return {
        status: connection.status,
        globalPause: settings.globalPause,
        surveysEnabled: settings.surveysEnabled,
        workerLeaseOwner: connection.workerLeaseOwner,
        workerLeaseUntil: connection.workerLeaseUntil?.toISOString() ?? null,
    };
}
async function getWhatsappDisconnectRequestedAt() {
    await (0, mongoose_2.connectToDatabase)();
    const connection = await ensureWhatsAppConnectionDocument();
    return connection.disconnectRequestedAt;
}
async function seedSurveyUserSnapshot(userId) {
    await (0, mongoose_2.connectToDatabase)();
    return user_1.UserModel.findById(userId).select("name apellido").lean();
}
