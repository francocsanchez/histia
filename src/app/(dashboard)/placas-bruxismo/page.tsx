import { BruxismPlatesManager } from "@/components/shared/placas-bruxismo-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can, isAdmin } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function BruxismPlatesPage() {
  const user = await requireSessionUser();
  if (!can(user, "placas-bruxismo", "read")) redirect("/inicio");
  return <BruxismPlatesManager isAdmin={isAdmin(user)} />;
}
