import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { codigoObraSocialSchema } from "@/lib/validations/schemas";
import { updateCodigoObraSocial } from "@/services/codigos-obras-sociales";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "codigos-obras-sociales", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar", 403);
    }

    const body = codigoObraSocialSchema.parse(await request.json());
    const { id } = await context.params;
    const updated = await updateCodigoObraSocial(id, body);

    return ok(updated);
  } catch (error) {
    return fromUnknownError(error);
  }
}
