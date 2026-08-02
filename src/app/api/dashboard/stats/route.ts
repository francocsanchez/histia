import { can } from "@/lib/permissions";
import { fromUnknownError, ok, AppError } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { getDashboardStats } from "@/services/dashboard";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "dashboard", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const stats = await getDashboardStats();
    return ok(stats);
  } catch (error) {
    return fromUnknownError(error);
  }
}
