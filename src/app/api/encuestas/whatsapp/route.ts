import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import {
  getWhatsAppConnectionStatus,
  prepareWhatsAppQrLinking,
  requestWhatsAppDisconnect,
} from "@/services/surveys";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "encuestas", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para ver WhatsApp", 403);
    }

    return ok(await getWhatsAppConnectionStatus());
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "encuestas", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para desvincular WhatsApp", 403);
    }

    const body = await request.json().catch(() => ({}));

    if (body.action === "disconnect") {
      return ok(await requestWhatsAppDisconnect());
    }

    if (body.action === "prepare-qr") {
      return ok(await prepareWhatsAppQrLinking());
    }

    if (body.action !== "disconnect") {
      throw new AppError("VALIDATION_ERROR", "Accion de WhatsApp no valida", 400);
    }
  } catch (error) {
    return fromUnknownError(error);
  }
}
