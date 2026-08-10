import {
  AppError,
  fromUnknownError,
  okWithPagination,
  parsePositiveInteger,
} from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listMercadoPagoSyncs } from "@/services/mercadopago-sync";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "movimientos", "read")) {
      throw new AppError(
        "FORBIDDEN",
        "No tenes permisos para consultar sincronizaciones de Mercado Pago",
        403,
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = parsePositiveInteger(searchParams.get("limit"), 10, 50);
    const result = await listMercadoPagoSyncs({ page, limit });

    return okWithPagination(result.data, result.pagination);
  } catch (error) {
    return fromUnknownError(error);
  }
}
