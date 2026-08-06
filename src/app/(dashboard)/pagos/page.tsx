import { redirect } from "next/navigation";

import { PagosManager } from "@/components/shared/pagos-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function PagosPage() {
  const user = await requireSessionUser();

  if (!can(user, "pagos", "read")) {
    redirect("/inicio");
  }

  return <PagosManager />;
}
