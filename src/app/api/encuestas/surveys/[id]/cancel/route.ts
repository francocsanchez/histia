import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { cancelSurveyById } from "@/services/surveys";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "encuestas", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para cancelar encuestas", 403);
    }

    const { id } = await context.params;
    const data = await cancelSurveyById(id);
    return ok(data);
  } catch (error) {
    return fromUnknownError(error);
  }
}
