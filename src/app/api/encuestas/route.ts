import { AppError, fromUnknownError, okWithPagination, parsePositiveInteger } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listSurveyDashboard } from "@/services/surveys";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "encuestas", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder a encuestas", 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = parsePositiveInteger(searchParams.get("limit"), 10, 50);
    const search = searchParams.get("search") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const result = await listSurveyDashboard({ page, limit, search, status });

    return okWithPagination(result.campaigns, result.pagination, {
      headers: {
        "x-surveys-totals": JSON.stringify(result.totalsToday),
      },
    });
  } catch (error) {
    return fromUnknownError(error);
  }
}
