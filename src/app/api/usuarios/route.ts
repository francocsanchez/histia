import { AppError, fromUnknownError, ok, okWithPagination, parsePositiveInteger } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { userCreateSchema } from "@/lib/validations/schemas";
import { createUser, listUsers } from "@/services/users";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "usuarios", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = parsePositiveInteger(searchParams.get("limit"), 10, 50);
    const search = searchParams.get("search") ?? undefined;
    const status = (searchParams.get("status") as "all" | "active" | "inactive" | null) ?? "all";
    const role = searchParams.get("role") as
      | "administrador"
      | "odontologo"
      | "ortodoncista"
      | "radiologo"
      | null;
    const result = await listUsers({ page, limit, search, status, role: role ?? undefined });

    return okWithPagination(result.data, result.pagination);
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "usuarios", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para crear", 403);
    }

    const body = userCreateSchema.parse(await request.json());
    const created = await createUser(body);
    return ok(created, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}
