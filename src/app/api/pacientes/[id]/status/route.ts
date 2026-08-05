import { z } from "zod";

import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { setPacienteStatus } from "@/services/pacientes";

const statusSchema = z.object({
  activo: z.boolean(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!isAdmin(user)) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar", 403);
    }

    const body = statusSchema.parse(await request.json());
    const { id } = await context.params;
    const updated = await setPacienteStatus(id, body.activo);

    return ok(updated);
  } catch (error) {
    return fromUnknownError(error);
  }
}
