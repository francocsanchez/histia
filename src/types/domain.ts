export const userRoleValues = [
  "administrador",
  "odontologo",
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

export interface DashboardMonthlyStatsDto {
  month: string;
  selectedUser: DashboardSelectedUserDto;
  availableUsers: DashboardUserOptionDto[];
  dailyAttentions: DashboardDailyAttentionDto[];
  statusSummary: DashboardStatusSummaryItemDto[];
  totals: {
    atenciones: number;
    codigos: number;
  };
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
  codigos: AttentionCodeLineDto[];
  cantidadCodigos: number;
  totalCoseguroCentavos: number;
  totalCoseguroOdontoCentavos: number;
  totalPagoOdontologoCentavos: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCandidateLineDto {
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
}

export interface PaymentCandidateSelectionDto {
  lineId: string;
  payCode: boolean;
  payCoseguroOdonto: boolean;
}

export interface PaymentLineItemDto {
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

export interface PaymentDto {
  id: string;
  usuarioId: string;
  usuarioNombreSnapshot: string;
  attentionMonth: string;
  paidAt: string;
  createdByUserId: string;
  totalPagoCodigosCentavos: number;
  totalCoseguroOdontoCentavos: number;
  totalHonorariosCentavos: number;
  quantityConceptsPaid: number;
  lineItems: PaymentLineItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSummaryDto {
  userId: string;
  attentionMonth: string;
  selectedItems: PaymentCandidateSelectionDto[];
  totalPagoCodigosCentavos: number;
  totalCoseguroOdontoCentavos: number;
  totalHonorariosCentavos: number;
  quantityConceptsPaid: number;
}
