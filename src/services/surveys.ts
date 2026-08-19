import QRCode from "qrcode";
import { Model, Schema, Types, model, models } from "mongoose";
import * as XLSX from "xlsx";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  applySurveyTemplate,
  buildSurveyCounters,
  extractTextFromWhatsAppMessage,
  getDefaultSurveyTemplates,
  getWhatsappJid,
  isTextOnlyWhatsAppMessage,
  isWithinSurveySendWindow,
  mapSheetRowsToPreviewRows,
  maskPhoneNumber,
  SURVEY_ACTIVE_STATUSES,
  SURVEY_DEFAULT_YEAR,
  SURVEY_REQUIRED_HEADERS,
  SURVEY_RUNNING_CAMPAIGN_STATUSES,
  SURVEY_WAITING_STATUSES,
  type SurveyPreviewRow,
} from "@/lib/surveys";
import { SurveyCampaignModel } from "@/models/survey-campaign";
import { SurveySettingsModel } from "@/models/survey-settings";
import { SurveyModel } from "@/models/survey";
import { UserModel } from "@/models/user";
import { WhatsAppAuthModel } from "@/models/whatsapp-auth";
import { WhatsAppConnectionModel } from "@/models/whatsapp-connection";
import { WhatsAppContactModel } from "@/models/whatsapp-contact";
import { WhatsAppProvider } from "@/services/whatsapp-provider";
import {
  SurveyCampaignDto,
  SurveyDashboardDto,
  SurveyDto,
  SurveySettingsDto,
  SurveyStatus,
  SessionUser,
  WhatsAppConnectionDto,
  WhatsAppConnectionEventDto,
} from "@/types/domain";

type WhatsAppConnectionEventDocument = {
  _id: string;
  source: "worker" | "api" | "system";
  eventType: string;
  message: string;
  status: WhatsAppConnectionDto["status"] | null;
  desiredState: WhatsAppConnectionDto["desiredState"] | null;
  phoneNumber: string | null;
  resetNonce: number | null;
  generation: number | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

const whatsappConnectionEventSchema = new Schema<WhatsAppConnectionEventDocument>(
  {
    source: {
      type: String,
      enum: ["worker", "api", "system"],
      required: true,
      index: true,
    },
    eventType: { type: String, required: true, index: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["disconnected", "connecting", "qr_required", "connected", "disconnecting", "error"],
      default: null,
    },
    desiredState: {
      type: String,
      enum: ["running", "stopped"],
      default: null,
    },
    phoneNumber: { type: String, default: null },
    resetNonce: { type: Number, default: null },
    generation: { type: Number, default: null },
    details: { type: Schema.Types.Mixed, default: null },
  },
  {
    collection: "whatsappConnectionEvents",
    timestamps: true,
  },
);

whatsappConnectionEventSchema.index({ createdAt: -1 });

const WhatsAppConnectionEventModel =
  (models.WhatsAppConnectionEvent as Model<WhatsAppConnectionEventDocument>) ||
  model<WhatsAppConnectionEventDocument>(
    "WhatsAppConnectionEvent",
    whatsappConnectionEventSchema,
  );

function extractDocumentId(value: unknown) {
  if (!value) {
    return "";
  }

  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null && "_id" in value) {
    const nestedId = (value as { _id?: unknown })._id;

    if (nestedId instanceof Types.ObjectId) {
      return nestedId.toString();
    }

    if (typeof nestedId === "string") {
      return nestedId;
    }
  }

  return String(value);
}

function toSurveyDto(document: {
  _id: unknown;
  campaignId: unknown;
  campaign?: {
    fileName?: string;
    status?: SurveyCampaignDto["status"];
  } | null;
  patientNameSnapshot: string;
  doctorNameSnapshot: string;
  phoneE164: string;
  attendanceAt: Date;
  status: SurveyStatus;
  rating: number | null;
  comment: string | null;
  sendAttemptCount: number;
  invalidReplyCount: number;
  sentAt: Date | null;
  completedAt: Date | null;
  technicalError: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SurveyDto {
  return {
    id: String(document._id),
    campaignId: extractDocumentId(document.campaignId),
    campaignFileName: document.campaign?.fileName ?? null,
    campaignStatus: document.campaign?.status ?? null,
    patientNameSnapshot: document.patientNameSnapshot,
    doctorNameSnapshot: document.doctorNameSnapshot,
    phoneMasked: maskPhoneNumber(document.phoneE164),
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

function toSurveyCampaignDto(
  document: {
    _id: unknown;
    fileName: string;
    importedByUserId: unknown;
    status: SurveyCampaignDto["status"];
    totalRows: number;
    validRows: number;
    duplicateRows: number;
    invalidRows: number;
    startedAt: Date | null;
    pausedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    importedByUser?: { name?: string; apellido?: string } | null;
  },
  counters: ReturnType<typeof buildSurveyCounters>,
): SurveyCampaignDto {
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

function toSurveySettingsDto(document: {
  surveysEnabled: boolean;
  globalPause: boolean;
  phoneForAppointments: string;
  sendIntervalSeconds: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  noResponseTimeoutHours: number;
  technicalRetryLimit: number;
  surveyIntroTemplate: string;
  commentOptInTemplate: string;
  commentRequestTemplate: string;
  thankYouTemplate: string;
  invalidRatingTemplate: string;
  invalidCommentOptInTemplate: string;
  unsupportedCommentTemplate: string;
  spontaneousMessageTemplate: string;
  updatedAt: Date;
}): SurveySettingsDto {
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

function toWhatsAppConnectionEventDto(document: {
  _id: unknown;
  source: "worker" | "api" | "system";
  eventType: string;
  message: string;
  status: WhatsAppConnectionDto["status"] | null;
  desiredState: WhatsAppConnectionDto["desiredState"] | null;
  phoneNumber: string | null;
  resetNonce: number | null;
  generation: number | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}): WhatsAppConnectionEventDto {
  return {
    id: String(document._id),
    source: document.source,
    eventType: document.eventType,
    message: document.message,
    status: document.status,
    desiredState: document.desiredState,
    phoneNumber: document.phoneNumber,
    resetNonce: document.resetNonce,
    generation: document.generation,
    details: document.details,
    createdAt: document.createdAt.toISOString(),
  };
}

async function ensureSurveySettingsDocument() {
  const defaults = getDefaultSurveyTemplates();

  return SurveySettingsModel.findOneAndUpdate(
    {},
    {
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
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );
}

async function ensureWhatsAppConnectionDocument() {
  return WhatsAppConnectionModel.findOneAndUpdate(
    { singletonKey: "main" },
    {
      $setOnInsert: {
        singletonKey: "main",
        desiredState: "running",
        resetNonce: 0,
        status: "disconnected",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

export async function getWhatsAppConnectionControlState() {
  await connectToDatabase();
  const connection = await ensureWhatsAppConnectionDocument();

  return {
    desiredState: connection.desiredState,
    resetNonce: connection.resetNonce,
    status: connection.status,
    phoneNumber: connection.phoneNumber,
    lastError: connection.lastError,
    lastDisconnectCode: connection.lastDisconnectCode,
    lastDisconnectReason: connection.lastDisconnectReason,
  };
}

export async function appendWhatsAppConnectionEvent(input: {
  source: "worker" | "api" | "system";
  eventType: string;
  message: string;
  status?: WhatsAppConnectionDto["status"] | null;
  desiredState?: WhatsAppConnectionDto["desiredState"] | null;
  phoneNumber?: string | null;
  resetNonce?: number | null;
  generation?: number | null;
  details?: Record<string, unknown> | null;
}) {
  await connectToDatabase();

  await WhatsAppConnectionEventModel.create({
    source: input.source,
    eventType: input.eventType,
    message: input.message,
    status: input.status ?? null,
    desiredState: input.desiredState ?? null,
    phoneNumber: input.phoneNumber ?? null,
    resetNonce: input.resetNonce ?? null,
    generation: input.generation ?? null,
    details: input.details ?? null,
  });

  const keepCount = 200;
  const total = await WhatsAppConnectionEventModel.countDocuments();

  if (total > keepCount) {
    const removable = await WhatsAppConnectionEventModel.find({})
      .sort({ createdAt: -1 })
      .skip(keepCount)
      .select("_id")
      .lean();

    if (removable.length > 0) {
      await WhatsAppConnectionEventModel.deleteMany({
        _id: {
          $in: removable.map((item: { _id: unknown }) => String(item._id)),
        },
      });
    }
  }
}

export async function listRecentWhatsAppConnectionEvents(limit = 20) {
  await connectToDatabase();

  const events = await WhatsAppConnectionEventModel.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return events.map((event: WhatsAppConnectionEventDocument) =>
    toWhatsAppConnectionEventDto(event),
  );
}

export async function acquireWhatsAppWorkerLease(input: {
  ownerId: string;
  ttlMs?: number;
}) {
  await connectToDatabase();
  await ensureWhatsAppConnectionDocument();

  const now = new Date();
  const leaseUntil = new Date(now.getTime() + (input.ttlMs ?? 30_000));
  const connection = await WhatsAppConnectionModel.findOneAndUpdate(
    {
      singletonKey: "main",
      $or: [
        { workerLeaseUntil: null },
        { workerLeaseUntil: { $lt: now } },
        { workerLeaseOwner: input.ownerId },
      ],
    },
    {
      $set: {
        workerLeaseOwner: input.ownerId,
        workerLeaseUntil: leaseUntil,
        workerHeartbeatAt: now,
      },
      $setOnInsert: {
        singletonKey: "main",
      },
    },
    {
      upsert: false,
      returnDocument: "after",
    },
  ).lean();

  return connection?.workerLeaseOwner === input.ownerId;
}

export async function releaseWhatsAppWorkerLease(ownerId: string) {
  await connectToDatabase();

  await WhatsAppConnectionModel.findOneAndUpdate(
    {
      singletonKey: "main",
      workerLeaseOwner: ownerId,
    },
    {
      $set: {
        workerLeaseOwner: null,
        workerLeaseUntil: null,
        workerHeartbeatAt: null,
      },
    },
  );
}

export async function previewSurveyWorkbook(
  fileName: string,
  fileBuffer: ArrayBuffer,
) {
  const workbook = XLSX.read(Buffer.from(fileBuffer), {
    type: "buffer",
    cellDates: true,
    raw: true,
  });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new AppError("VALIDATION_ERROR", "El archivo no contiene hojas", 400);
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  const headerRow = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    range: 0,
    blankrows: false,
    defval: "",
  })[0] ?? [];

  const normalizedHeaders = headerRow.map((header) => String(header).trim().toLowerCase());
  const missingHeaders = SURVEY_REQUIRED_HEADERS.filter(
    (header) => !normalizedHeaders.includes(header),
  );

  if (missingHeaders.length > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Faltan columnas obligatorias: ${missingHeaders.join(", ")}`,
      400,
    );
  }

  const previewRows = mapSheetRowsToPreviewRows(rows);

  return {
    fileName,
    importedYear: SURVEY_DEFAULT_YEAR,
    rows: previewRows,
    summary: {
      totalRows: previewRows.length,
      validRows: previewRows.filter((row) => row.valid).length,
      duplicateRows: previewRows.filter((row) => row.duplicate).length,
      invalidRows: previewRows.filter((row) => row.errors.length > 0).length,
    },
  };
}

export async function createSurveyCampaignFromPreview(input: {
  fileName: string;
  rows: SurveyPreviewRow[];
  user: SessionUser;
}) {
  await connectToDatabase();

  const selectedRows = input.rows.filter((row) => row.selected && row.valid);

  if (selectedRows.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Debes seleccionar al menos una fila valida para crear la campana",
      400,
    );
  }

  const conflictingActivePhones = new Set(
    (
      await SurveyModel.find({
        phoneE164: { $in: selectedRows.map((row) => row.phoneE164) },
        status: { $in: SURVEY_ACTIVE_STATUSES },
      })
        .select("phoneE164")
        .lean()
    ).map((survey) => survey.phoneE164),
  );

  if (conflictingActivePhones.size > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Hay telefonos con una encuesta activa. Espera a que terminen o cancela la encuesta vigente.",
      409,
    );
  }

  const duplicateExisting = await SurveyModel.find({
    $or: selectedRows.map((row) => ({
      phoneE164: row.phoneE164,
      attendanceAt: new Date(row.attendanceAt!),
    })),
  })
    .select("_id status")
    .lean();

  const nonCancelledDuplicates = duplicateExisting.filter(
    (survey) => survey.status !== "cancelled",
  );

  if (nonCancelledDuplicates.length > 0) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ya existe al menos una encuesta para alguna de las atenciones seleccionadas",
      409,
    );
  }

  if (duplicateExisting.length > 0) {
    await SurveyModel.deleteMany({
      _id: { $in: duplicateExisting.map((survey) => survey._id) },
      status: "cancelled",
    });
  }

  const campaign = await SurveyCampaignModel.create({
    fileName: input.fileName,
    importedByUserId: new Types.ObjectId(input.user.id),
    status: "ready",
    totalRows: input.rows.length,
    validRows: input.rows.filter((row) => row.valid).length,
    duplicateRows: input.rows.filter((row) => row.duplicate).length,
    invalidRows: input.rows.filter((row) => row.errors.length > 0).length,
  });

  const createdSurveys = await SurveyModel.insertMany(
    selectedRows.map((row) => ({
      campaignId: campaign._id,
      patientNameSnapshot: row.patientNameSnapshot,
      doctorNameSnapshot: row.doctorNameSnapshot,
      phoneRaw: row.phoneRaw,
      phoneE164: row.phoneE164!,
      attendanceAt: new Date(row.attendanceAt!),
      status: "queued",
      rating: null,
      comment: null,
      createdByUserId: new Types.ObjectId(input.user.id),
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
    })),
  );

  const populatedCampaign = await SurveyCampaignModel.findById(campaign._id)
    .populate("importedByUserId", "name apellido")
    .lean();

  if (!populatedCampaign) {
    throw new AppError("INTERNAL_ERROR", "No se pudo recuperar la campana creada", 500);
  }

  return {
    campaign: toSurveyCampaignDto(
      {
        ...populatedCampaign,
        importedByUser: populatedCampaign.importedByUserId as unknown as {
          name?: string;
          apellido?: string;
        },
      },
      buildSurveyCounters(createdSurveys.map((survey) => ({ status: survey.status }))),
    ),
  };
}

export async function listSurveyDashboard(input: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}): Promise<SurveyDashboardDto> {
  await connectToDatabase();
  const skip = (input.page - 1) * input.limit;
  const surveyFilter: Record<string, unknown> = {};

  if (input.status) {
    surveyFilter.status =
      input.status === "waiting"
        ? { $in: SURVEY_WAITING_STATUSES }
        : input.status;
  }

  if (input.search) {
    const regex = { $regex: input.search, $options: "i" };
    const matchingCampaignIds = (
      await SurveyCampaignModel.find({ fileName: regex }).select("_id").lean()
    ).map((campaign) => campaign._id);

    surveyFilter.$or = [
      { patientNameSnapshot: regex },
      { doctorNameSnapshot: regex },
      { phoneE164: regex },
      { phoneRaw: regex },
      ...(matchingCampaignIds.length > 0 ? [{ campaignId: { $in: matchingCampaignIds } }] : []),
    ];
  }

  const [surveyRows, total, allSurveyStatuses] = await Promise.all([
    SurveyModel.find(surveyFilter)
      .populate("campaignId", "fileName status")
      .sort({ createdAt: -1, attendanceAt: -1 })
      .skip(skip)
      .limit(input.limit)
      .lean(),
    SurveyModel.countDocuments(surveyFilter),
    SurveyModel.find({})
      .select("status")
      .lean(),
  ]);

  const waiting = allSurveyStatuses.filter((survey) =>
    SURVEY_WAITING_STATUSES.includes(survey.status),
  ).length;

  return {
    totalsToday: {
      queued: allSurveyStatuses.filter((survey) => survey.status === "queued").length,
      waiting,
      completed: allSurveyStatuses.filter((survey) => survey.status === "completed").length,
      noResponse: allSurveyStatuses.filter((survey) => survey.status === "no_response").length,
      sendFailed: allSurveyStatuses.filter((survey) => survey.status === "send_failed").length,
      deliveryUnknown: allSurveyStatuses.filter((survey) => survey.status === "delivery_unknown").length,
    },
    surveys: surveyRows.map((survey) =>
      toSurveyDto({
        ...survey,
        campaign: survey.campaignId as unknown as {
          fileName?: string;
          status?: SurveyCampaignDto["status"];
        },
      }),
    ),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function getSurveyCampaignDetail(campaignId: string) {
  await connectToDatabase();

  const campaign = await SurveyCampaignModel.findById(campaignId)
    .populate("importedByUserId", "name apellido")
    .lean();

  if (!campaign) {
    throw new AppError("NOT_FOUND", "La campana no existe", 404);
  }

  const surveys = await SurveyModel.find({ campaignId: campaign._id })
    .sort({ attendanceAt: 1, createdAt: 1 })
    .lean();

  return {
    campaign: toSurveyCampaignDto(
      {
        ...campaign,
        importedByUser: campaign.importedByUserId as unknown as {
          name?: string;
          apellido?: string;
        },
      },
      buildSurveyCounters(surveys.map((survey) => ({ status: survey.status }))),
    ),
    surveys: surveys.map((survey) =>
      toSurveyDto({
        ...survey,
        campaign: {
          fileName: campaign.fileName,
          status: campaign.status,
        },
      }),
    ),
  };
}

export async function updateSurveyCampaignStatus(input: {
  campaignId: string;
  action: "start" | "pause" | "resume" | "cancel";
}) {
  await connectToDatabase();

  const campaign = await SurveyCampaignModel.findById(input.campaignId);

  if (!campaign) {
    throw new AppError("NOT_FOUND", "La campana no existe", 404);
  }

  const now = new Date();

  if (input.action === "start") {
    if (campaign.status !== "ready") {
      throw new AppError("VALIDATION_ERROR", "Solo se pueden iniciar campanas listas", 409);
    }
    campaign.status = "running";
    campaign.startedAt = now;
    campaign.pausedAt = null;
  }

  if (input.action === "pause") {
    if (campaign.status !== "running") {
      throw new AppError("VALIDATION_ERROR", "Solo se pueden pausar campanas en curso", 409);
    }
    campaign.status = "paused";
    campaign.pausedAt = now;
  }

  if (input.action === "resume") {
    if (campaign.status !== "paused") {
      throw new AppError("VALIDATION_ERROR", "Solo se pueden reanudar campanas pausadas", 409);
    }
    campaign.status = "running";
    campaign.pausedAt = null;
  }

  if (input.action === "cancel") {
    if (campaign.status === "completed" || campaign.status === "cancelled") {
      throw new AppError("VALIDATION_ERROR", "La campana ya no admite cancelacion", 409);
    }

    campaign.status = "cancelled";
    campaign.cancelledAt = now;

    await SurveyModel.updateMany(
      {
        campaignId: campaign._id,
        status: { $in: SURVEY_ACTIVE_STATUSES },
      },
      {
        $set: {
          status: "cancelled",
          completedAt: now,
          leaseUntil: null,
          deliveryResolution: "cancelled_by_admin",
        },
      },
    );
  }

  await campaign.save();

  return getSurveyCampaignDetail(String(campaign._id));
}

export async function cancelSurveyById(surveyId: string) {
  await connectToDatabase();

  const survey = await SurveyModel.findById(surveyId);

  if (!survey) {
    throw new AppError("NOT_FOUND", "La encuesta no existe", 404);
  }

  if (!SURVEY_ACTIVE_STATUSES.includes(survey.status)) {
    throw new AppError("VALIDATION_ERROR", "Solo se pueden cancelar encuestas activas", 409);
  }

  survey.status = "cancelled";
  survey.completedAt = new Date();
  survey.leaseUntil = null;
  survey.deliveryResolution = "cancelled_by_admin";
  await survey.save();

  return toSurveyDto(survey.toObject());
}

export async function getSurveySettings() {
  await connectToDatabase();

  const settings = await ensureSurveySettingsDocument();
  return toSurveySettingsDto(settings.toObject());
}

export async function updateSurveySettings(input: Partial<SurveySettingsDto>) {
  await connectToDatabase();

  const settings = await ensureSurveySettingsDocument();

  Object.assign(settings, input);
  await settings.save();

  return toSurveySettingsDto(settings.toObject());
}

export async function getWhatsAppConnectionStatus() {
  await connectToDatabase();

  const [connection, recentEvents] = await Promise.all([
    ensureWhatsAppConnectionDocument(),
    listRecentWhatsAppConnectionEvents(20),
  ]);
  const qrDataUrl = connection.qr
    ? await QRCode.toDataURL(connection.qr, { margin: 1, width: 320 })
    : null;

  return {
    desiredState: connection.desiredState,
    status: connection.status,
    phoneNumber: connection.phoneNumber,
    qrDataUrl,
    qrExpiresAt: connection.qrExpiresAt?.toISOString() ?? null,
    lastConnectedAt: connection.lastConnectedAt?.toISOString() ?? null,
    lastDisconnectedAt: connection.lastDisconnectedAt?.toISOString() ?? null,
    lastError: connection.lastError,
    lastDisconnectCode: connection.lastDisconnectCode ?? null,
    lastDisconnectReason: connection.lastDisconnectReason,
    disconnectRequestedAt: connection.disconnectRequestedAt?.toISOString() ?? null,
    updatedAt: connection.updatedAt?.toISOString() ?? null,
    recentEvents,
  } satisfies WhatsAppConnectionDto;
}

export async function requestWhatsAppDisconnect() {
  await connectToDatabase();

  const connection = await ensureWhatsAppConnectionDocument();
  const nextResetNonce = connection.resetNonce + 1;

  await WhatsAppConnectionModel.findOneAndUpdate(
    { singletonKey: "main" },
    {
      $set: {
        desiredState: "stopped",
        status: "disconnecting",
        disconnectRequestedAt: new Date(),
        phoneNumber: null,
        qr: null,
        qrExpiresAt: null,
        lastError: null,
        lastDisconnectCode: null,
        lastDisconnectReason: null,
      },
      $inc: {
        resetNonce: 1,
      },
      $setOnInsert: {
        singletonKey: "main",
      },
    },
    {
      upsert: true,
    },
  );

  await appendWhatsAppConnectionEvent({
    source: "api",
    eventType: "disconnect_requested",
    message: "Se solicito una desvinculacion total de WhatsApp desde la UI.",
    status: "disconnecting",
    desiredState: "stopped",
    phoneNumber: null,
    resetNonce: nextResetNonce,
    details: {
      mode: "full_reset_and_stop",
      previousPhoneNumber: connection.phoneNumber,
    },
  });

  return getWhatsAppConnectionStatus();
}

export async function prepareWhatsAppQrLinking() {
  await connectToDatabase();
  const connection = await ensureWhatsAppConnectionDocument();
  const nextResetNonce = connection.resetNonce + 1;

  await WhatsAppConnectionModel.findOneAndUpdate(
    { singletonKey: "main" },
    {
      $set: {
        desiredState: "running",
        status: "disconnecting",
        phoneNumber: null,
        qr: null,
        qrExpiresAt: null,
        lastError: null,
        lastDisconnectCode: null,
        lastDisconnectReason: null,
        disconnectRequestedAt: null,
      },
      $inc: {
        resetNonce: 1,
      },
      $setOnInsert: {
        singletonKey: "main",
      },
    },
    {
      upsert: true,
    },
  );

  await appendWhatsAppConnectionEvent({
    source: "api",
    eventType: "prepare_qr_requested",
    message: "Se solicito un reset total de la sesion para preparar un QR nuevo.",
    status: "disconnecting",
    desiredState: "running",
    phoneNumber: null,
    resetNonce: nextResetNonce,
    details: {
      mode: "full_reset_and_restart",
      previousPhoneNumber: connection.phoneNumber,
    },
  });

  return getWhatsAppConnectionStatus();
}

export async function ensureSurveySettingsForWorker() {
  await connectToDatabase();
  return ensureSurveySettingsDocument();
}

export async function updateWhatsAppConnectionState(input: {
  status: WhatsAppConnectionDto["status"];
  desiredState?: WhatsAppConnectionDto["desiredState"];
  phoneNumber?: string | null;
  qr?: string | null;
  qrExpiresAt?: Date | null;
  lastError?: string | null;
  lastDisconnectCode?: number | null;
  lastDisconnectReason?: string | null;
  connected?: boolean;
  disconnected?: boolean;
  clearDisconnectRequest?: boolean;
}) {
  await connectToDatabase();

  const now = new Date();
  const update: Record<string, unknown> = {
    status: input.status,
    updatedAt: now,
  };

  if ("desiredState" in input) {
    update.desiredState = input.desiredState;
  }

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

  if ("lastDisconnectCode" in input) {
    update.lastDisconnectCode = input.lastDisconnectCode ?? null;
  }

  if ("lastDisconnectReason" in input) {
    update.lastDisconnectReason = input.lastDisconnectReason ?? null;
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

  await WhatsAppConnectionModel.findOneAndUpdate(
    { singletonKey: "main" },
    {
      $set: update,
      $setOnInsert: {
        singletonKey: "main",
      },
    },
    { upsert: true },
  );
}

export async function isWhatsAppDisconnectRequested() {
  await connectToDatabase();
  const connection = await ensureWhatsAppConnectionDocument();
  return Boolean(connection.disconnectRequestedAt);
}

export async function clearWhatsAppAuthState() {
  await connectToDatabase();
  await Promise.all([
    WhatsAppAuthModel.deleteMany({}),
    WhatsAppConnectionModel.findOneAndUpdate(
      { singletonKey: "main" },
      {
        $set: {
          status: "disconnected",
          phoneNumber: null,
          qr: null,
          qrExpiresAt: null,
          disconnectRequestedAt: null,
          lastDisconnectCode: null,
          lastDisconnectReason: null,
        },
      },
      { upsert: true },
    ),
  ]);
}

export async function getStoredWhatsAppAuthRecords() {
  await connectToDatabase();
  return WhatsAppAuthModel.find({}).lean();
}

export async function upsertWhatsAppAuthRecord(key: string, value: unknown) {
  await connectToDatabase();
  await WhatsAppAuthModel.findOneAndUpdate(
    { key },
    {
      $set: { value },
      $setOnInsert: { key },
    },
    { upsert: true },
  );
}

export async function removeWhatsAppAuthRecord(key: string) {
  await connectToDatabase();
  await WhatsAppAuthModel.deleteOne({ key });
}

export async function expireNoResponseSurveys() {
  await connectToDatabase();

  const settings = await ensureSurveySettingsDocument();
  const cutoff = new Date(Date.now() - settings.noResponseTimeoutHours * 60 * 60 * 1000);

  await SurveyModel.updateMany(
    {
      status: { $in: SURVEY_WAITING_STATUSES },
      sentAt: { $lte: cutoff },
    },
    {
      $set: {
        status: "no_response",
        completedAt: new Date(),
      },
    },
  );
}

export async function takeNextSurveyLease() {
  await connectToDatabase();

  const settings = await ensureSurveySettingsDocument();

  if (!settings.surveysEnabled || settings.globalPause) {
    return null;
  }

  if (!isWithinSurveySendWindow(new Date(), settings.sendWindowStart, settings.sendWindowEnd)) {
    return null;
  }

  const latestSentSurvey = await SurveyModel.findOne({
    sentAt: { $ne: null },
  })
    .sort({ sentAt: -1 })
    .select("sentAt")
    .lean();

  if (
    latestSentSurvey?.sentAt &&
    Date.now() - new Date(latestSentSurvey.sentAt).getTime() <
      settings.sendIntervalSeconds * 1000
  ) {
    return null;
  }

  const runningCampaigns = await SurveyCampaignModel.find({
    status: { $in: SURVEY_RUNNING_CAMPAIGN_STATUSES.filter((status) => status !== "paused") },
  })
    .select("_id")
    .lean();

  if (runningCampaigns.length === 0) {
    return null;
  }

  const campaignIds = runningCampaigns.map((campaign) => campaign._id);
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 5 * 60 * 1000);

  const leased = await SurveyModel.findOneAndUpdate(
    {
      campaignId: { $in: campaignIds },
      status: "queued",
      $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now } }],
    },
    {
      $set: {
        status: "leased_for_send",
        leaseUntil,
        technicalError: null,
      },
      $inc: {
        sendAttemptCount: 1,
      },
    },
    {
      sort: { createdAt: 1 },
      new: true,
    },
  ).lean();

  return leased;
}

export async function markSurveySendSuccess(input: {
  surveyId: string;
  providerMessageId: string;
}) {
  await connectToDatabase();

  await SurveyModel.findByIdAndUpdate(input.surveyId, {
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

export async function markSurveySendFailure(input: {
  surveyId: string;
  errorMessage: string;
}) {
  await connectToDatabase();

  const settings = await ensureSurveySettingsDocument();
  const survey = await SurveyModel.findById(input.surveyId);

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

export async function markLeasesAsDeliveryUnknown() {
  await connectToDatabase();

  await SurveyModel.updateMany(
    {
      status: "leased_for_send",
      leaseUntil: { $lt: new Date() },
    },
    {
      $set: {
        status: "delivery_unknown",
        leaseUntil: null,
        technicalError: "La aplicacion se reinicio antes de confirmar el envio",
        deliveryResolution: "worker_interrupted_before_persist",
      },
    },
  );
}

export async function maybeCompleteCampaign(campaignId: string | Types.ObjectId) {
  await connectToDatabase();

  const surveys = await SurveyModel.find({ campaignId }).select("status").lean();

  if (surveys.length === 0) {
    return;
  }

  const hasActive = surveys.some((survey) => SURVEY_ACTIVE_STATUSES.includes(survey.status));

  if (!hasActive) {
    await SurveyCampaignModel.findByIdAndUpdate(campaignId, {
      $set: {
        status: "completed",
        completedAt: new Date(),
      },
    });
  }
}

export async function processIncomingWhatsAppMessage(input: {
  phoneE164: string;
  message: Record<string, unknown> | null | undefined;
  messenger: WhatsAppProvider;
}) {
  await connectToDatabase();

  const settings = await ensureSurveySettingsDocument();
  const text = extractTextFromWhatsAppMessage(input.message);

  const survey = await SurveyModel.findOne({
    phoneE164: input.phoneE164,
    status: { $in: SURVEY_WAITING_STATUSES },
  }).sort({ sentAt: -1 });

  if (!survey) {
    const contact = await WhatsAppContactModel.findOne({ phoneE164: input.phoneE164 });
    const now = new Date();
    const shouldReply =
      !contact?.lastSpontaneousReplyAt ||
      now.getTime() - contact.lastSpontaneousReplyAt.getTime() >= 24 * 60 * 60 * 1000;

    if (shouldReply) {
      await input.messenger.sendText(
        getWhatsappJid(input.phoneE164),
        applySurveyTemplate(settings.spontaneousMessageTemplate, {
          appointmentsPhone: settings.phoneForAppointments,
        }),
      );

      await WhatsAppContactModel.findOneAndUpdate(
        { phoneE164: input.phoneE164 },
        {
          $set: {
            lastSpontaneousReplyAt: now,
          },
          $setOnInsert: {
            phoneE164: input.phoneE164,
          },
        },
        { upsert: true },
      );
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
      await input.messenger.sendText(
        getWhatsappJid(input.phoneE164),
        settings.commentOptInTemplate,
      );
      return;
    }

    survey.invalidReplyCount += 1;
    await survey.save();
    await input.messenger.sendText(
      getWhatsappJid(input.phoneE164),
      settings.invalidRatingTemplate,
    );
    return;
  }

  if (survey.status === "waiting_comment_opt_in") {
    if (text === "1") {
      survey.status = "waiting_comment_text";
      await survey.save();
      await input.messenger.sendText(
        getWhatsappJid(input.phoneE164),
        settings.commentRequestTemplate,
      );
      return;
    }

    if (text === "2") {
      survey.status = "completed";
      survey.completedAt = new Date();
      await survey.save();
      await input.messenger.sendText(
        getWhatsappJid(input.phoneE164),
        settings.thankYouTemplate,
      );
      await maybeCompleteCampaign(survey.campaignId);
      return;
    }

    survey.invalidReplyCount += 1;
    await survey.save();
    await input.messenger.sendText(
      getWhatsappJid(input.phoneE164),
      settings.invalidCommentOptInTemplate,
    );
    return;
  }

  if (survey.status === "waiting_comment_text") {
    if (!isTextOnlyWhatsAppMessage(input.message) || !text.trim()) {
      survey.invalidReplyCount += 1;
      await survey.save();
      await input.messenger.sendText(
        getWhatsappJid(input.phoneE164),
        settings.unsupportedCommentTemplate,
      );
      return;
    }

    survey.comment = text.trim();
    survey.status = "completed";
    survey.completedAt = new Date();
    await survey.save();
    await input.messenger.sendText(
      getWhatsappJid(input.phoneE164),
      settings.thankYouTemplate,
    );
    await maybeCompleteCampaign(survey.campaignId);
  }
}

export async function buildSurveyIntroMessage(surveyId: string) {
  await connectToDatabase();
  const settings = await ensureSurveySettingsDocument();
  const survey = await SurveyModel.findById(surveyId).lean();

  if (!survey) {
    throw new AppError("NOT_FOUND", "La encuesta no existe", 404);
  }

  return applySurveyTemplate(settings.surveyIntroTemplate, {
    patientName: survey.patientNameSnapshot,
    doctorName: survey.doctorNameSnapshot,
  });
}

export async function getWorkerHealthSnapshot() {
  await connectToDatabase();

  const [connection, settings] = await Promise.all([
    ensureWhatsAppConnectionDocument(),
    ensureSurveySettingsDocument(),
  ]);

  return {
    desiredState: connection.desiredState,
    status: connection.status,
    globalPause: settings.globalPause,
    surveysEnabled: settings.surveysEnabled,
    workerLeaseOwner: connection.workerLeaseOwner,
    workerLeaseUntil: connection.workerLeaseUntil?.toISOString() ?? null,
  };
}

export async function getWhatsappDisconnectRequestedAt() {
  await connectToDatabase();
  const connection = await ensureWhatsAppConnectionDocument();
  return connection.disconnectRequestedAt;
}

export async function seedSurveyUserSnapshot(userId: string) {
  await connectToDatabase();
  return UserModel.findById(userId).select("name apellido").lean();
}
