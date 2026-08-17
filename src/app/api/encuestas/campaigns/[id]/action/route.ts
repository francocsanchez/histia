import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { surveyCampaignActionSchema } from "@/lib/validations/schemas";
import { updateSurveyCampaignStatus } from "@/services/surveys";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "encuestas", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para administrar campanas", 403);
    }

    const { id } = await context.params;
    const body = surveyCampaignActionSchema.parse(await request.json());
    const data = await updateSurveyCampaignStatus({ campaignId: id, action: body.action });
    return ok(data);
  } catch (error) {
    return fromUnknownError(error);
  }
}
