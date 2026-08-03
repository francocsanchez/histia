import {
  AppError,
  fromUnknownError,
  ok,
  okWithPagination,
  parsePositiveInteger,
} from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { attentionSchema } from "@/lib/validations/schemas";
import { createAttention, listAttentions } from "@/services/atenciones";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "atenciones", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = parsePositiveInteger(searchParams.get("limit"), 10, 50);
    const search = searchParams.get("search") ?? undefined;
    const dateFrom = searchParams.get("dateFrom") ?? undefined;
    const dateTo = searchParams.get("dateTo") ?? undefined;
    const userId = searchParams.get("userId") ?? undefined;
    const obraSocialId = searchParams.get("obraSocialId") ?? undefined;
    const patientId = searchParams.get("patientId") ?? undefined;

    const result = await listAttentions({
      page,
      limit,
      search,
      dateFrom,
      dateTo,
      userId,
      obraSocialId,
      patientId,
    });

    return okWithPagination(result.data, result.pagination);
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "atenciones", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para crear", 403);
    }

    const body = attentionSchema.parse(await request.json());
    const created = await createAttention(body, user);

    return ok(created, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}
