import { redirect } from "next/navigation";

import { OrtodonciaManager } from "@/components/shared/ortodoncia-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can, isAdmin } from "@/lib/permissions";

export default async function OrtodonciaPage() {
  const user = await requireSessionUser();

  if (!can(user, "ortodoncia", "read")) {
    redirect("/inicio");
  }

  return <OrtodonciaManager currentUserId={user.id} isAdmin={isAdmin(user)} />;
}
