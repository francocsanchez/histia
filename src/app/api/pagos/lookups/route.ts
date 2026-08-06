import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listPaymentLookups } from "@/services/pagos";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "pagos", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const lookups = await listPaymentLookups();
    return ok(lookups);
  } catch (error) {
    return fromUnknownError(error);
  }
}
