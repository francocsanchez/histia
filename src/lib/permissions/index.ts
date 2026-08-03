import { SessionUser, UserRole } from "@/types/domain";

export type ResourceKey =
  | "dashboard"
  | "rx"
  | "atenciones"
  | "obras-sociales"
  | "codigos-obras-sociales"
  | "pacientes"
  | "usuarios";

export type PermissionAction = "read" | "write";

const readOnlyRoles: UserRole[] = ["odontologo", "radiologo"];

export function isAdmin(user: Pick<SessionUser, "roles">) {
  return user.roles.includes("administrador");
}

export function can(
  user: Pick<SessionUser, "roles">,
  resource: ResourceKey,
  action: PermissionAction,
) {
  if (isAdmin(user)) {
    return true;
  }

  if (resource === "rx") {
    return user.roles.includes("radiologo");
  }

  if (resource === "atenciones") {
    return user.roles.includes("odontologo");
  }

  if (
    resource === "obras-sociales" ||
    resource === "codigos-obras-sociales" ||
    resource === "usuarios"
  ) {
    return false;
  }

  if (resource === "dashboard") {
    return true;
  }

  return action === "read" && readOnlyRoles.some((role) => user.roles.includes(role));
}
