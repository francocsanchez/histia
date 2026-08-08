import { z } from "zod";

import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { setMovementTypeStatus } from "@/services/tipos-movimientos";

const statusSchema = z.object({
  activo: z.boolean(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "tipos-movimientos", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar", 403);
    }

    const body = statusSchema.parse(await request.json());
    const { id } = await context.params;
    const updated = await setMovementTypeStatus(id, body.activo);

    return ok(updated);
  } catch (error) {
    return fromUnknownError(error);
  }
}
