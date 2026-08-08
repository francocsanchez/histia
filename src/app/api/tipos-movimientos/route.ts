import {
  AppError,
  fromUnknownError,
  ok,
  okWithPagination,
  parsePositiveInteger,
} from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { movementTypeSchema } from "@/lib/validations/schemas";
import {
  createMovementType,
  listMovementTypes,
} from "@/services/tipos-movimientos";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = parsePositiveInteger(searchParams.get("limit"), 10, 100);
    const search = searchParams.get("search") ?? undefined;
    const status = (searchParams.get("status") as "all" | "active" | "inactive" | null) ?? "all";
    const result = await listMovementTypes({ page, limit, search, status }, user);

    return okWithPagination(result.data, result.pagination);
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "tipos-movimientos", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para crear", 403);
    }

    const body = movementTypeSchema.parse(await request.json());
    const created = await createMovementType(body);
    return ok(created, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}
