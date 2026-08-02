import { AppShell } from "@/components/layout/app-shell";
import { requireSessionUser } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireSessionUser();

  return <AppShell user={user}>{children}</AppShell>;
}
