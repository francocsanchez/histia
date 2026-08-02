import { redirect } from "next/navigation";

import { UsuariosManager } from "@/components/shared/usuarios-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function UsuariosPage() {
  const user = await requireSessionUser();

  if (!can(user, "usuarios", "read")) {
    redirect("/inicio");
  }

  return <UsuariosManager />;
}
