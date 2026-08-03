import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { attentionSchema } from "@/lib/validations/schemas";
import { updateAttention } from "@/services/atenciones";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "atenciones", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar", 403);
    }

    const body = attentionSchema.parse(await request.json());
    const { id } = await context.params;
    const updated = await updateAttention(id, body);

    return ok(updated);
  } catch (error) {
    return fromUnknownError(error);
  }
}
