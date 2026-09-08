import { redirect } from "next/navigation";

import { IssnAutomationManager } from "@/components/shared/issn-automation-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function AutomatizacionesPage() {
  const user = await requireSessionUser();
  if (!can(user, "automatizaciones", "read")) redirect("/inicio");
  return <IssnAutomationManager />;
}
