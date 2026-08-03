import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { normalizeDni } from "@/lib/utils";
import { getRxLookups } from "@/services/rx";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "rx", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { searchParams } = new URL(request.url);
    const dni = searchParams.get("dni");
    const result = await getRxLookups(dni ? normalizeDni(dni) : undefined);

    return ok(result);
  } catch (error) {
    return fromUnknownError(error);
  }
}
