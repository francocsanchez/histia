import { CodigosObrasSocialesManager } from "@/components/shared/codigos-obras-sociales-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function CodigosObrasSocialesPage() {
  const user = await requireSessionUser();

  return (
    <CodigosObrasSocialesManager
      canManage={can(user, "codigos-obras-sociales", "write")}
    />
  );
}
