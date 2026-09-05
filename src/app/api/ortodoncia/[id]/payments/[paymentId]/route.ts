import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { orthodonticPaymentSchema } from "@/lib/validations/schemas";
import {
  deleteOrthodonticPayment,
  updateOrthodonticPayment,
} from "@/services/ortodoncia";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "ortodoncia", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar", 403);
    }

    const body = orthodonticPaymentSchema.parse(await request.json());
    const { id, paymentId } = await context.params;
    const updated = await updateOrthodonticPayment(id, paymentId, body, user);

    return ok(updated);
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "ortodoncia", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para eliminar", 403);
    }

    const { id, paymentId } = await context.params;
    const updated = await deleteOrthodonticPayment(id, paymentId, user);

    return ok(updated);
  } catch (error) {
    return fromUnknownError(error);
  }
}
