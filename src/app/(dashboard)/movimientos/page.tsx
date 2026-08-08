import { redirect } from "next/navigation";

import { MovimientosManager } from "@/components/shared/movimientos-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function MovimientosPage() {
  const user = await requireSessionUser();

  if (!can(user, "movimientos", "read")) {
    redirect("/inicio");
  }

  return <MovimientosManager />;
}
