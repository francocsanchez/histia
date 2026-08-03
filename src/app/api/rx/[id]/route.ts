import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { rxAttentionSchema } from "@/lib/validations/schemas";
import { updateRxAttention } from "@/services/rx";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "rx", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar", 403);
    }

    const body = rxAttentionSchema.parse(await request.json());
    const { id } = await context.params;
    const updated = await updateRxAttention(id, body);

    return ok(updated);
  } catch (error) {
    return fromUnknownError(error);
  }
}
