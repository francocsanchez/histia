import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getAdminDashboardStats } from "@/services/dashboard";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "admin-dashboard", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") ?? undefined;
    const month = searchParams.get("month") ?? undefined;

    const stats = await getAdminDashboardStats({
      currentUser: user,
      year,
      month,
    });

    return ok(stats);
  } catch (error) {
    return fromUnknownError(error);
  }
}
