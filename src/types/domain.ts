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
