import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { obraSocialSchema } from "@/lib/validations/schemas";
import { updateObraSocial } from "@/services/obras-sociales";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "obras-sociales", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar", 403);
    }

    const body = obraSocialSchema.parse(await request.json());
    const { id } = await context.params;
    const updated = await updateObraSocial(id, body);

    return ok(updated);
  } catch (error) {
    return fromUnknownError(error);
  }
}
