import { RendicionesManager } from "@/components/shared/rendiciones-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function RendicionesPage() {
  const user = await requireSessionUser();

  if (!can(user, "rendiciones", "read")) {
    redirect("/inicio");
  }

  return <RendicionesManager isAdmin={user.roles.includes("administrador")} />;
}
