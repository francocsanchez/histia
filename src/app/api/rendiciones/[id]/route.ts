import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getRenditionForUser } from "@/services/rendiciones";

export async function GET(request: Request, context: RouteContext<"/api/rendiciones/[id]">) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "rendiciones", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { id } = await context.params;
    return ok(await getRenditionForUser(id, user));
  } catch (error) {
    return fromUnknownError(error);
  }
}
