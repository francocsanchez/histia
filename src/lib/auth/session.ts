import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppError } from "@/lib/api";
import { getAuth } from "@/lib/auth";
import { splitRoles } from "@/lib/utils";
import { SessionUser } from "@/types/domain";

export async function getSession() {
  return getAuth().api.getSession({
    headers: await headers(),
  });
}

export function toSessionUser(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) {
    return null;
  }

  const user = session.user;

  return {
    id: user.id,
    email: user.email,
    nombre: user.name,
    apellido: String(user.apellido ?? ""),
    activo: Boolean(user.activo ?? true),
    roles: splitRoles(String(user.roles ?? "")),
    authRole: String(user.role ?? "user"),
  } satisfies SessionUser;
}

export async function requireSessionUser() {
  const session = await getSession();
  const user = toSessionUser(session);

  if (!user) {
    redirect("/login");
  }

  if (!user.activo) {
    redirect("/login?error=inactivo");
  }

  return user;
}

export async function requireApiSessionUser(requestHeaders: Headers) {
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
  });

  const user = toSessionUser(session);

  if (!user) {
    throw new AppError("UNAUTHORIZED", "Debes iniciar sesion", 401);
  }

  if (!user.activo) {
    throw new AppError("FORBIDDEN", "Tu usuario esta inactivo", 403);
  }

  return user;
}
