import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { movementUpdateSchema } from "@/lib/validations/schemas";
import { updateMovementDetails } from "@/services/movimientos";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "movimientos", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar movimientos", 403);
    }

    const { id } = await context.params;
    const body = movementUpdateSchema.parse(await request.json());
    const movement = await updateMovementDetails(id, body);

    return ok(movement);
  } catch (error) {
    return fromUnknownError(error);
  }
}
