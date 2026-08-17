import { redirect } from "next/navigation";

import { SurveySettingsManager } from "@/components/shared/survey-settings-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function MensajesEncuestasPage() {
  const user = await requireSessionUser();

  if (!can(user, "encuestas", "read")) {
    redirect("/inicio");
  }

  return <SurveySettingsManager />;
}
