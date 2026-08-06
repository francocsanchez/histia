import {
  AppError,
  fromUnknownError,
  ok,
  okWithPagination,
  parsePositiveInteger,
} from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { paymentCreateSchema } from "@/lib/validations/schemas";
import { createPayment, listPayments } from "@/services/pagos";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "pagos", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = parsePositiveInteger(searchParams.get("limit"), 10, 50);
    const userId = searchParams.get("userId") ?? undefined;
    const attentionMonth = searchParams.get("attentionMonth") ?? undefined;

    const result = await listPayments({
      page,
      limit,
      userId,
      attentionMonth,
    });

    return okWithPagination(result.data, result.pagination);
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "pagos", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para liquidar pagos", 403);
    }

    const body = paymentCreateSchema.parse(await request.json());
    const payment = await createPayment(body, user.id);

    return ok(payment, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}
