import { redirect } from "next/navigation";

import { AtencionesManager } from "@/components/shared/atenciones-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can, isAdmin } from "@/lib/permissions";

export default async function AtencionesPage() {
  const user = await requireSessionUser();

  if (!can(user, "atenciones", "read")) {
    redirect("/inicio");
  }

  return <AtencionesManager isAdmin={isAdmin(user)} />;
}
