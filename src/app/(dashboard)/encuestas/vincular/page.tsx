import { redirect } from "next/navigation";

import { WhatsAppLinkManager } from "@/components/shared/whatsapp-link-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function EncuestasVincularPage() {
  const user = await requireSessionUser();

  if (!can(user, "encuestas", "read")) {
    redirect("/inicio");
  }

  return <WhatsAppLinkManager />;
}
