import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getSurveyCampaignDetail } from "@/services/surveys";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "encuestas", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para ver campanas", 403);
    }

    const { id } = await context.params;
    const data = await getSurveyCampaignDetail(id);
    return ok(data);
  } catch (error) {
    return fromUnknownError(error);
  }
}
