import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { orthodonticPaymentSchema } from "@/lib/validations/schemas";
import { addOrthodonticPayment } from "@/services/ortodoncia";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "ortodoncia", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar", 403);
    }

    const body = orthodonticPaymentSchema.parse(await request.json());
    const { id } = await context.params;
    const updated = await addOrthodonticPayment(id, body, user);

    return ok(updated);
  } catch (error) {
    return fromUnknownError(error);
  }
}
