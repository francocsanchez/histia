import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { surveySettingsSchema } from "@/lib/validations/schemas";
import { getSurveySettings, updateSurveySettings } from "@/services/surveys";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "encuestas", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para ver configuracion", 403);
    }

    return ok(await getSurveySettings());
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "encuestas", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para editar configuracion", 403);
    }

    const body = surveySettingsSchema.parse(await request.json());
    return ok(await updateSurveySettings(body));
  } catch (error) {
    return fromUnknownError(error);
  }
}
