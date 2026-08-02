import { ObrasSocialesManager } from "@/components/shared/obras-sociales-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function ObrasSocialesPage() {
  const user = await requireSessionUser();

  return <ObrasSocialesManager canManage={can(user, "obras-sociales", "write")} />;
}
