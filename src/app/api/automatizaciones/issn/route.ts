import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getIssnAutomationStatus, requestManualIssnRun } from "@/services/issn-automation";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);
    if (!can(user, "automatizaciones", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para ver automatizaciones", 403);
    }
    return ok(await getIssnAutomationStatus());
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);
    if (!can(user, "automatizaciones", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para ejecutar automatizaciones", 403);
    }
    return ok(await requestManualIssnRun());
  } catch (error) {
    return fromUnknownError(error);
  }
}
