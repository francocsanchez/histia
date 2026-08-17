import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { surveyCampaignCreateSchema } from "@/lib/validations/schemas";
import { createSurveyCampaignFromPreview } from "@/services/surveys";

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "encuestas", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para crear campanas", 403);
    }

    const body = surveyCampaignCreateSchema.parse(await request.json());
    const created = await createSurveyCampaignFromPreview({
      fileName: body.fileName,
      rows: body.rows,
      user,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}
