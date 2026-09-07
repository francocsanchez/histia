import {
  AppError,
  fromUnknownError,
  okWithPagination,
  parsePositiveInteger,
} from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { attentionCodeStatusValues, AttentionCodeStatus } from "@/types/domain";
import { listAttentionCodeLines } from "@/services/atenciones";

function isAttentionStatus(value: string | null): value is AttentionCodeStatus {
  return attentionCodeStatusValues.includes(value as AttentionCodeStatus);
}

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "atenciones", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { searchParams } = new URL(request.url);
    const attentionStatus = searchParams.get("attentionStatus");

    if (!isAttentionStatus(attentionStatus)) {
      throw new AppError("VALIDATION_ERROR", "El estado de codigo no es valido", 400);
    }

    const result = await listAttentionCodeLines(
      {
        page: parsePositiveInteger(searchParams.get("page"), 1),
        limit: parsePositiveInteger(searchParams.get("limit"), 20, 50),
        dateFrom: searchParams.get("dateFrom") ?? undefined,
        dateTo: searchParams.get("dateTo") ?? undefined,
        userId: searchParams.get("userId") ?? undefined,
        attentionStatus,
      },
      user,
    );

    return okWithPagination(result.data, result.pagination);
  } catch (error) {
    return fromUnknownError(error);
  }
}
