import { can } from "@/lib/permissions";
import { fromUnknownError, ok, AppError } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { getDashboardMonthlyStats } from "@/services/dashboard";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "dashboard", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? undefined;
    const userId = searchParams.get("userId") ?? undefined;

    const stats = await getDashboardMonthlyStats({
      currentUser: user,
      month,
      userId,
    });

    return ok(stats);
  } catch (error) {
    return fromUnknownError(error);
  }
}
