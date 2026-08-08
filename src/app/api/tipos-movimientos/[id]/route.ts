import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { movementTypeSchema } from "@/lib/validations/schemas";
import { updateMovementType } from "@/services/tipos-movimientos";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "tipos-movimientos", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar", 403);
    }

    const body = movementTypeSchema.parse(await request.json());
    const { id } = await context.params;
    const updated = await updateMovementType(id, body);

    return ok(updated);
  } catch (error) {
    return fromUnknownError(error);
  }
}
