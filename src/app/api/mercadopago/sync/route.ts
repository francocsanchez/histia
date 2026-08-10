import {
  AppError,
  fromUnknownError,
  ok,
} from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { startMercadoPagoSync } from "@/services/mercadopago-sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "movimientos", "write")) {
      throw new AppError(
        "FORBIDDEN",
        "No tenes permisos para iniciar sincronizaciones de Mercado Pago",
        403,
      );
    }

    const result = await startMercadoPagoSync({
      syncType: "manual",
      requestedByUserId: user.id,
    });

    return ok(result, { status: result.created ? 202 : 200 });
  } catch (error) {
    return fromUnknownError(error);
  }
}
