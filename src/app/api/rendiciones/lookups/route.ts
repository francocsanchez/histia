import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can, isAdmin } from "@/lib/permissions";
import { listPaymentLookups } from "@/services/pagos";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "rendiciones", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    if (!isAdmin(user)) {
      return ok({ users: [] });
    }

    const { users } = await listPaymentLookups();
    return ok({ users });
  } catch (error) {
    return fromUnknownError(error);
  }
}
