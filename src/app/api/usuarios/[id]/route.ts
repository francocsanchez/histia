import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { userUpdateSchema } from "@/lib/validations/schemas";
import { updateUser } from "@/services/users";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "usuarios", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar", 403);
    }

    const body = userUpdateSchema.parse(await request.json());
    const { id } = await context.params;
    const updated = await updateUser(id, body);

    return ok(updated);
  } catch (error) {
    return fromUnknownError(error);
  }
}
