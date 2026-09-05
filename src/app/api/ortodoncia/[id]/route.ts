import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { orthodonticTreatmentSchema } from "@/lib/validations/schemas";
import {
  getOrthodonticTreatment,
  updateOrthodonticTreatment,
} from "@/services/ortodoncia";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "ortodoncia", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { id } = await context.params;
    const treatment = await getOrthodonticTreatment(id, user);

    return ok(treatment);
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "ortodoncia", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar", 403);
    }

    const body = orthodonticTreatmentSchema.parse(await request.json());
    const { id } = await context.params;
    const updated = await updateOrthodonticTreatment(id, body, user);

    return ok(updated);
  } catch (error) {
    return fromUnknownError(error);
  }
}
