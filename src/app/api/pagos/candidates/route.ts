import {
  AppError,
  fromUnknownError,
  okWithPagination,
  parsePositiveInteger,
} from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { attentionCodeStatusValues } from "@/types/domain";
import { listPaymentCandidates } from "@/services/pagos";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "pagos", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = parsePositiveInteger(searchParams.get("limit"), 10, 100);
    const userId = searchParams.get("userId") ?? undefined;
    const attentionMonth = searchParams.get("attentionMonth") ?? undefined;
    const attentionStatus = searchParams.get("attentionStatus") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const statusFilter =
      attentionStatus && attentionCodeStatusValues.includes(attentionStatus as never)
        ? (attentionStatus as (typeof attentionCodeStatusValues)[number])
        : undefined;

    const result = await listPaymentCandidates({
      page,
      limit,
      userId,
      attentionMonth,
      attentionStatus: statusFilter,
      search,
    });

    return okWithPagination(result.data, result.pagination);
  } catch (error) {
    return fromUnknownError(error);
  }
}
