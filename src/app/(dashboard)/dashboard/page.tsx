import { redirect } from "next/navigation";

import { AdminDashboard } from "@/components/shared/admin-dashboard";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function DashboardPage() {
  const user = await requireSessionUser();

  if (!can(user, "admin-dashboard", "read")) {
    redirect("/inicio");
  }

  return <AdminDashboard />;
}
