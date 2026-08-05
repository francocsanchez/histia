import { redirect } from "next/navigation";

import { LiquidacionesManager } from "@/components/shared/liquidaciones-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function LiquidacionesPage() {
  const user = await requireSessionUser();

  if (!can(user, "liquidaciones", "read")) {
    redirect("/inicio");
  }

  return <LiquidacionesManager />;
}
