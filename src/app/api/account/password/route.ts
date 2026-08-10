import { fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { userPasswordSchema } from "@/lib/validations/schemas";
import { setUserPassword } from "@/services/users";

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);
    const body = userPasswordSchema.parse(await request.json());
    const result = await setUserPassword(user.id, body.password);

    return ok(result);
  } catch (error) {
    return fromUnknownError(error);
  }
}
