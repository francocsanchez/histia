import {
  AppError,
  fromUnknownError,
  ok,
  okWithPagination,
  parsePositiveInteger,
} from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { rxAttentionSchema } from "@/lib/validations/schemas";
import { createRxAttention, listRxAttentions } from "@/services/rx";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "rx", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = parsePositiveInteger(searchParams.get("limit"), 10, 50);
    const search = searchParams.get("search") ?? undefined;
    const rxType =
      (searchParams.get("rxType") as "carpal" | "panoramica" | null) ?? undefined;
    const dateFrom = searchParams.get("dateFrom") ?? undefined;
    const dateTo = searchParams.get("dateTo") ?? undefined;

    const result = await listRxAttentions({
      page,
      limit,
      search,
      rxType,
      dateFrom,
      dateTo,
    });

    return okWithPagination(result.data, result.pagination);
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "rx", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para crear", 403);
    }

    const body = rxAttentionSchema.parse(await request.json());
    const created = await createRxAttention(body, user);

    return ok(created, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}
