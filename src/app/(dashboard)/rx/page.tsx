import { redirect } from "next/navigation";

import { RxManager } from "@/components/shared/rx-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function RxPage() {
  const user = await requireSessionUser();

  if (!can(user, "rx", "read")) {
    redirect("/inicio");
  }

  return (
    <RxManager currentUserLabel={`${user.apellido}, ${user.nombre}`} />
  );
}
