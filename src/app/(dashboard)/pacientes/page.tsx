import { PacientesManager } from "@/components/shared/pacientes-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function PacientesPage() {
  const user = await requireSessionUser();

  return <PacientesManager canManage={can(user, "pacientes", "write")} />;
}
