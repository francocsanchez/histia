import { redirect } from "next/navigation";

import { TiposMovimientosManager } from "@/components/shared/tipos-movimientos-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function TiposMovimientosPage() {
  const user = await requireSessionUser();

  if (!can(user, "tipos-movimientos", "read")) {
    redirect("/inicio");
  }

  return <TiposMovimientosManager canManage={can(user, "tipos-movimientos", "write")} />;
}
