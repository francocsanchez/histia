import { PacientesManager } from "@/components/shared/pacientes-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can, isAdmin } from "@/lib/permissions";

export default async function PacientesPage() {
  const user = await requireSessionUser();

  return (
    <PacientesManager
      canCreateAttention={can(user, "atenciones", "write")}
      canManage={can(user, "pacientes", "write")}
      canToggleStatus={isAdmin(user)}
    />
  );
}
