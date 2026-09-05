export const userRoleValues = [
  "administrador",
  "odontologo",
  "ortodoncista",
  "radiologo",
] as const;

export type UserRole = (typeof userRoleValues)[number];

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface QueryParams {
  page: number;
  limit: number;
  search?: string;
  status?: "all" | "active" | "inactive";
  attentionStatus?: AttentionCodeStatus;
  orthodonticTreatmentStatus?: OrthodonticTreatmentStatus;
  obraSocialId?: string;
  role?: UserRole;
  rxType?: RxType;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  patientId?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  roles: UserRole[];
  authRole: string;
}

export interface ObraSocialDto {
  id: string;
  nombre: string;
  cantidadPrestacionesMes: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CodigoObraSocialDto {
  id: string;
  nombre: string;
  codigo: string;
  obraSocialId: string;
  obraSocialNombre: string;
  valorCentavos: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PacienteDto {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  obraSocialId: string | null;
  obraSocialNombre: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserDto {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  roles: UserRole[];
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStatsDto {
  obrasSocialesActivas: number;
  codigosActivos: number;
  pacientesActivos: number;
  usuariosActivos: number;
}

export const surveyCampaignStatusValues = [
  "draft",
  "ready",
  "running",
  "paused",
  "completed",
  "cancelled",
  "error",
] as const;

export type SurveyCampaignStatus = (typeof surveyCampaignStatusValues)[number];

export const surveyStatusValues = [
  "queued",
  "leased_for_send",
  "waiting_rating",
  "waiting_comment_opt_in",
  "waiting_comment_text",
  "completed",
  "no_response",
  "cancelled",
  "send_failed",
  "delivery_unknown",
] as const;

export type SurveyStatus = (typeof surveyStatusValues)[number];

export interface SurveyDto {
  id: string;
  campaignId: string;
  campaignFileName: string | null;
  campaignStatus: SurveyCampaignStatus | null;
  patientNameSnapshot: string;
  doctorNameSnapshot: string;
  phoneMasked: string;
  attendanceAt: string;
  status: SurveyStatus;
  rating: number | null;
  comment: string | null;
  sendAttemptCount: number;
  invalidReplyCount: number;
  sentAt: string | null;
  completedAt: string | null;
  technicalError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyCampaignDto {
  id: string;
  fileName: string;
  importedByUserId: string;
  importedByUserName: string;
  status: SurveyCampaignStatus;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  queuedCount: number;
  waitingCount: number;
  completedCount: number;
  noResponseCount: number;
  cancelledCount: number;
  sendFailedCount: number;
  deliveryUnknownCount: number;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyDashboardTotalsDto {
  queued: number;
  waiting: number;
  completed: number;
  noResponse: number;
  sendFailed: number;
  deliveryUnknown: number;
}

export interface SurveyDashboardDto {
  totalsToday: SurveyDashboardTotalsDto;
  surveys: SurveyDto[];
  pagination: PaginationResult;
}

export interface SurveySettingsDto {
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
  updatedAt: string;
}

export interface WhatsAppConnectionDto {
  desiredState: "running" | "stopped";
  status:
    | "disconnected"
    | "connecting"
    | "qr_required"
    | "connected"
    | "disconnecting"
    | "error";
  phoneNumber: string | null;
  qrDataUrl: string | null;
  qrExpiresAt: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastError: string | null;
  lastDisconnectCode: number | null;
  lastDisconnectReason: string | null;
  disconnectRequestedAt: string | null;
  updatedAt: string | null;
  recentEvents: WhatsAppConnectionEventDto[];
}

export interface WhatsAppConnectionEventDto {
  id: string;
  source: "worker" | "api" | "system";
  eventType: string;
  message: string;
  status: WhatsAppConnectionDto["status"] | null;
  desiredState: WhatsAppConnectionDto["desiredState"] | null;
  phoneNumber: string | null;
  resetNonce: number | null;
  generation: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface DashboardUserOptionDto {
  id: string;
  label: string;
}

export interface DashboardSelectedUserDto {
  id: string;
  nombreCompleto: string;
}

export interface DashboardDailyAttentionDto {
  day: number;
  date: string;
  total: number;
}

export interface DashboardStatusSummaryItemDto {
  status: AttentionCodeStatus;
  label: string;
  total: number;
}

export interface DashboardAnnualHonorariumItemDto {
  month: number;
  label: string;
  pendienteCentavos: number;
  pendingAttentionCodeCentavos: number;
  pagadoCentavos: number;
  totalCentavos: number;
}

export interface DashboardMonthlyStatsDto {
  month: string;
  selectedUser: DashboardSelectedUserDto;
  availableUsers: DashboardUserOptionDto[];
  dailyAttentions: DashboardDailyAttentionDto[];
  statusSummary: DashboardStatusSummaryItemDto[];
  annualHonorariumByMonth: DashboardAnnualHonorariumItemDto[];
  totals: {
    atenciones: number;
    codigos: number;
  };
}

export interface AdminDashboardSummaryDto {
  pacientesActivos: number;
  odontologosActivos: number;
  balanceTotalCentavos: number;
  balanceTotalUsd: number | null;
}

export interface AdminDashboardPieItemDto {
  id: string;
  label: string;
  total: number;
}

export interface AdminDashboardMonthlyItemDto {
  month: number;
  label: string;
  total: number;
}

export interface AdminDashboardIncomeExpenseItemDto {
  month: number;
  label: string;
  ingresosCentavos: number;
  egresosCentavos: number;
}

export interface AdminDashboardCodeStatusItemDto {
  status: AttentionCodeStatus;
  label: string;
  total: number;
}

export interface AdminDashboardMonthlyStackSegmentDto {
  id: string;
  label: string;
  total: number;
}

export interface AdminDashboardMonthlyStackItemDto {
  month: number;
  label: string;
  total: number;
  segments: AdminDashboardMonthlyStackSegmentDto[];
}

export interface AdminDashboardDentistStatusItemDto {
  status: AttentionCodeStatus;
  label: string;
  total: number;
}

export interface AdminDashboardDentistPerformanceDto {
  userId: string;
  nombreCompleto: string;
  total: number;
  statuses: AdminDashboardDentistStatusItemDto[];
}

export interface AdminDashboardDto {
  year: number;
  month: string;
  availableYears: number[];
  availableMonths: string[];
  summary: AdminDashboardSummaryDto;
  patientsByObraSocial: AdminDashboardPieItemDto[];
  attentionsByMonth: AdminDashboardMonthlyStackItemDto[];
  rxByMonth: AdminDashboardMonthlyItemDto[];
  movementsByMonth: AdminDashboardIncomeExpenseItemDto[];
  incomeByMovementType: AdminDashboardPieItemDto[];
  expenseByMovementType: AdminDashboardPieItemDto[];
  codesByStatus: AdminDashboardCodeStatusItemDto[];
  dentistPerformanceByMonth: AdminDashboardDentistPerformanceDto[];
}

export const rxTypeValues = ["carpal", "panoramica"] as const;
export type RxType = (typeof rxTypeValues)[number];

export const referrerTypeValues = ["interno", "externo"] as const;
export type ReferrerType = (typeof referrerTypeValues)[number];

export interface RxAttentionDto {
  id: string;
  fecha: string;
  pacienteId: string;
  pacienteNombreCompleto: string;
  pacienteDni: string;
  pacienteObraSocialNombre: string | null;
  derivanteTipo: ReferrerType;
  derivanteUserId: string | null;
  derivanteNombre: string;
  tipoRx: RxType;
  valorCentavos: number | null;
  usuarioGeneradorId: string;
  usuarioGeneradorNombre: string;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
}

export const orthodonticTreatmentTypeValues = [
  "damon-q",
  "arco-recto",
  "damon-ultimate",
  "a-ligable-nac",
] as const;

export type OrthodonticTreatmentType =
  (typeof orthodonticTreatmentTypeValues)[number];

export const orthodonticTreatmentStatusValues = [
  "activo",
  "cerrado",
  "cancelado",
] as const;

export type OrthodonticTreatmentStatus =
  (typeof orthodonticTreatmentStatusValues)[number];

export const attentionCodeStatusValues = [
  "no-cargado",
  "pendiente",
  "ok",
  "diferido",
  "denegado",
] as const;

export type AttentionCodeStatus = (typeof attentionCodeStatusValues)[number];
export const paymentStatusValues = ["pendiente", "pagado"] as const;
export type PaymentStatus = (typeof paymentStatusValues)[number];
export const movementDirectionValues = ["ingreso", "egreso"] as const;
export type MovementDirection = (typeof movementDirectionValues)[number];

export const movementOriginTypeValues = ["manual", "payment", "mercadopago"] as const;
export type MovementOriginType = (typeof movementOriginTypeValues)[number];
export const mercadoPagoExternalComponentValues = [
  "TRANSACTION",
  "TAX",
  "FEE",
] as const;
export type MercadoPagoExternalComponent =
  (typeof mercadoPagoExternalComponentValues)[number];

export interface AttentionCodeLineDto {
  lineId: string;
  codigoObraSocialId: string;
  codigoNombre: string;
  codigo: string;
  pieza: string | null;
  coseguroCentavos: number | null;
  coseguroOdontoCentavos: number | null;
  observacion: string | null;
  pagoOdontologoCentavos: number;
  estado: AttentionCodeStatus;
  codePaymentStatus: PaymentStatus;
  coseguroOdontoPaymentStatus: PaymentStatus;
}

export interface AttentionDto {
  id: string;
  fecha: string;
  pacienteId: string;
  pacienteNombreCompleto: string;
  pacienteDni: string;
  obraSocialId: string;
  obraSocialNombre: string;
  usuarioCargaId: string;
  usuarioCargaNombre: string;
  observacionGeneral: string | null;
  observacionTope: string | null;
  codigos: AttentionCodeLineDto[];
  cantidadCodigos: number;
  totalCoseguroCentavos: number;
  totalCoseguroOdontoCentavos: number;
  totalPagoOdontologoCentavos: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCandidateLineDto {
  sourceType: "attention" | "orthodontic-payment";
  sourceLabel: string;
  attentionId: string;
  attentionFecha: string;
  attentionMonth: string;
  userId: string;
  userName: string;
  pacienteId: string;
  pacienteNombreCompleto: string;
  pacienteDni: string;
  obraSocialId: string;
  obraSocialNombre: string;
  lineId: string;
  codigoObraSocialId: string;
  codigo: string;
  codigoNombre: string;
  pieza: string | null;
  estado: AttentionCodeStatus;
  pagoOdontologoCentavos: number;
  coseguroOdontoCentavos: number | null;
  codePaymentStatus: PaymentStatus;
  coseguroOdontoPaymentStatus: PaymentStatus;
  canPayCode: boolean;
  canPayCoseguroOdonto: boolean;
  orthodonticTreatmentId: string | null;
  orthodonticTreatmentType: OrthodonticTreatmentType | null;
  orthodonticPaymentId: string | null;
  orthodonticPaymentDate: string | null;
  orthodonticPaymentAmountCentavos: number | null;
  orthodonticPaymentPercentage: number | null;
}

export interface PaymentCandidateSelectionDto {
  sourceType: "attention" | "orthodontic-payment";
  lineId: string;
  payCode: boolean;
  payCoseguroOdonto: boolean;
}

export interface AttentionPaymentLineItemDto {
  sourceType: "attention";
  attentionId: string;
  attentionFecha: string;
  pacienteId: string;
  pacienteNombre: string;
  pacienteDni: string;
  obraSocialId: string;
  obraSocialNombre: string;
  codigoObraSocialId: string;
  codigo: string;
  codigoNombre: string;
  pieza: string | null;
  estadoAtencionSnapshot: AttentionCodeStatus;
  pagoOdontologoCentavos: number;
  coseguroOdontoCentavos: number | null;
  includesCodePayment: boolean;
  includesCoseguroOdontoPayment: boolean;
  totalLineaCentavos: number;
}

export interface OrthodonticPaymentLineItemDto {
  sourceType: "orthodontic-payment";
  orthodonticTreatmentId: string;
  orthodonticPaymentId: string;
  treatmentStartDate: string;
  paymentDate: string;
  treatmentType: OrthodonticTreatmentType;
  patientId: string;
  patientName: string;
  patientDni: string;
  paymentAmountCentavos: number;
  percentageToOrthodontist: number;
  orthodontistAmountCentavos: number;
  totalLineaCentavos: number;
}

export type PaymentLineItemDto =
  | AttentionPaymentLineItemDto
  | OrthodonticPaymentLineItemDto;

export interface PaymentDebitItemDto {
  montoCentavos: number;
  observacion: string;
}

export interface PaymentDto {
  id: string;
  usuarioId: string;
  usuarioNombreSnapshot: string;
  attentionMonth: string;
  attentionMonths: string[];
  paidAt: string;
  createdByUserId: string;
  totalPagoCodigosCentavos: number;
  totalCoseguroOdontoCentavos: number;
  totalOrtodonciaCentavos: number;
  totalHonorariosCentavos: number;
  totalDebitosCentavos: number;
  totalNetoPagarCentavos: number;
  quantityConceptsPaid: number;
  lineItems: PaymentLineItemDto[];
  debitItems: PaymentDebitItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSummaryDto {
  userId: string;
  attentionMonth: string;
  selectedItems: PaymentCandidateSelectionDto[];
  totalPagoCodigosCentavos: number;
  totalCoseguroOdontoCentavos: number;
  totalOrtodonciaCentavos: number;
  totalHonorariosCentavos: number;
  totalDebitosCentavos: number;
  totalNetoPagarCentavos: number;
  quantityConceptsPaid: number;
}

export interface MovementPaymentMetadataDto {
  kind: "payment";
  paymentId: string;
  usuarioId: string;
  usuarioNombreSnapshot: string;
  attentionMonth: string;
  attentionMonths: string[];
  totalPagoCodigosCentavos: number;
  totalCoseguroOdontoCentavos: number;
  totalOrtodonciaCentavos: number;
  totalHonorariosCentavos: number;
  totalDebitosCentavos: number;
  totalNetoPagarCentavos: number;
  quantityConceptsPaid: number;
  debitItems: PaymentDebitItemDto[];
}

export interface MovementMercadoPagoMetadataDto {
  kind: "mercadopago";
  reportId: number;
  sourceId: string;
  payerName: string | null;
  externalReference: string | null;
  paymentMethod: string | null;
  paymentMethodType: string | null;
  transactionType: string | null;
  transactionAmountCentavos: number;
  transactionDate: string;
  feeAmountCentavos: number;
  settlementDate: string | null;
  realAmountCentavos: number;
  taxesAmountCentavos: number;
  moneyReleaseDate: string | null;
  description: string | null;
  businessUnit: string | null;
  subUnit: string | null;
  externalComponent: MercadoPagoExternalComponent;
  reconciliationExpectedCentavos: number;
  reconciliationDifferenceCentavos: number;
  reconciliationMatches: boolean;
}

export type MovementMetadataDto =
  | MovementPaymentMetadataDto
  | MovementMercadoPagoMetadataDto;

export interface MovementDto {
  id: string;
  fecha: string;
  descripcion: string | null;
  direccion: MovementDirection;
  tipoMovimientoId: string | null;
  tipo: string;
  montoCentavos: number;
  origenTipo: MovementOriginType;
  origenId: string | null;
  externalId: string | null;
  externalComponent: MercadoPagoExternalComponent | null;
  creadoAutomaticamente: boolean;
  metadata: MovementMetadataDto | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MovementCreateDto {
  fecha: string;
  descripcion?: string | null;
  movementTypeId: string;
  montoCentavos: number;
}

export interface OrthodonticPaymentDto {
  id: string;
  fecha: string;
  montoCentavos: number;
  porcentajeOrtodoncista: number;
  montoOrtodoncistaCentavos: number;
  paymentStatus: PaymentStatus;
  paymentId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrthodonticTreatmentTotalsDto {
  totalPresupuestadoCentavos: number;
  totalPagadoPacienteCentavos: number;
  saldoPacienteCentavos: number;
  porcentajePagado: number;
  totalLiquidableOrtodoncistaCentavos: number;
  totalPendienteOrtodoncistaCentavos: number;
  totalPagadoOrtodoncistaCentavos: number;
}

export interface OrthodonticTreatmentDto {
  id: string;
  fechaInicio: string;
  pacienteId: string;
  pacienteNombreCompleto: string;
  pacienteDni: string;
  usuarioOrtodoncistaId: string;
  usuarioOrtodoncistaNombre: string;
  tratamientoTipo: OrthodonticTreatmentType;
  valorTratamientoCentavos: number;
  valorMaterialesCentavos: number;
  estado: OrthodonticTreatmentStatus;
  payments: OrthodonticPaymentDto[];
  totals: OrthodonticTreatmentTotalsDto;
  createdAt: string;
  updatedAt: string;
}

export interface MovementUpdateDto {
  movementTypeId: string;
  descripcion?: string | null;
}

export interface MovementTypeDto {
  id: string;
  nombre: string;
  direccion: MovementDirection;
  activo: boolean;
  systemKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MovementTypeCreateDto {
  nombre: string;
  direccion: MovementDirection;
}

export const mercadoPagoSyncTypeValues = [
  "hourly",
  "daily_recovery",
  "manual",
] as const;
export type MercadoPagoSyncType = (typeof mercadoPagoSyncTypeValues)[number];

export const mercadoPagoSyncStatusValues = [
  "PENDING",
  "WAITING_REPORT",
  "PROCESSING",
  "PROCESSED",
  "FAILED",
] as const;
export type MercadoPagoSyncStatus = (typeof mercadoPagoSyncStatusValues)[number];

export interface MercadoPagoSyncDto {
  id: string;
  reportId: number | null;
  fileName: string | null;
  beginDate: string;
  endDate: string;
  status: MercadoPagoSyncStatus;
  remoteStatus: string | null;
  tipoSincronizacion: MercadoPagoSyncType;
  cantidadFilas: number;
  cantidadMovimientosCreados: number;
  cantidadMovimientosIgnorados: number;
  cantidadAdvertencias: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
}
