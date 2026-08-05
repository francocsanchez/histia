import { AppError, fromUnknownError, ok, okWithPagination, parsePositiveInteger } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { obraSocialSchema } from "@/lib/validations/schemas";
import {
  createObraSocial,
  listObrasSociales,
} from "@/services/obras-sociales";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = parsePositiveInteger(searchParams.get("limit"), 10, 50);
    const search = searchParams.get("search") ?? undefined;
    const status = (searchParams.get("status") as "all" | "active" | "inactive" | null) ?? "all";
    const result = await listObrasSociales({ page, limit, search, status }, user);

    return okWithPagination(result.data, result.pagination);
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "obras-sociales", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para crear", 403);
    }

    const body = obraSocialSchema.parse(await request.json());
    const created = await createObraSocial(body);
    return ok(created, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}
