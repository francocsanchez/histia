import { redirect } from "next/navigation";

import { SurveysManager } from "@/components/shared/surveys-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function EncuestasPage() {
  const user = await requireSessionUser();

  if (!can(user, "encuestas", "read")) {
    redirect("/inicio");
  }

  return <SurveysManager />;
}
