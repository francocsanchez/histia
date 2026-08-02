import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { userPasswordSchema } from "@/lib/validations/schemas";
import { setUserPassword } from "@/services/users";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "usuarios", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar", 403);
    }

    const body = userPasswordSchema.parse(await request.json());
    const { id } = await context.params;
    const result = await setUserPassword(id, body.password);

    return ok(result);
  } catch (error) {
    return fromUnknownError(error);
  }
}
