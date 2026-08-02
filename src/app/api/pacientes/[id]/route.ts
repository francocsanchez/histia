import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { pacienteSchema } from "@/lib/validations/schemas";
import { updatePaciente } from "@/services/pacientes";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "pacientes", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar", 403);
    }

    const body = pacienteSchema.parse(await request.json());
    const { id } = await context.params;
    const updated = await updatePaciente(id, body);

    return ok(updated);
  } catch (error) {
    return fromUnknownError(error);
  }
}
