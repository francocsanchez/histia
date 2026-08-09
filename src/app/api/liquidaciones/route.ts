import {
  AppError,
  fromUnknownError,
  okWithPagination,
  parsePositiveInteger,
} from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { attentionCodeStatusValues, AttentionCodeStatus } from "@/types/domain";
import { listAttentions } from "@/services/atenciones";

function isAttentionCodeStatus(value: string): value is AttentionCodeStatus {
  return attentionCodeStatusValues.includes(value as AttentionCodeStatus);
}

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "liquidaciones", "read")) {
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
    const attentionStatusParam = searchParams.get("attentionStatus");
    const attentionStatus =
      attentionStatusParam && isAttentionCodeStatus(attentionStatusParam)
        ? attentionStatusParam
        : undefined;

    const result = await listAttentions({
      page,
      limit,
      search,
      dateFrom,
      dateTo,
      userId,
      obraSocialId,
      attentionStatus,
    }, user);

    return okWithPagination(result.data, result.pagination);
  } catch (error) {
    return fromUnknownError(error);
  }
}
