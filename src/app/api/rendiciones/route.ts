import { AppError, fromUnknownError, okWithPagination, parsePositiveInteger } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can, isAdmin } from "@/lib/permissions";
import { listPayments } from "@/services/pagos";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "rendiciones", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("userId") ?? undefined;
    const userId = isAdmin(user) ? requestedUserId : user.id;
    const result = await listPayments({
      page: parsePositiveInteger(searchParams.get("page"), 1),
      limit: parsePositiveInteger(searchParams.get("limit"), 10, 50),
      userId,
    });

    return okWithPagination(result.data, result.pagination);
  } catch (error) {
    return fromUnknownError(error);
  }
}
