import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { normalizeDni } from "@/lib/utils";
import { getAttentionLookups } from "@/services/atenciones";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "atenciones", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { searchParams } = new URL(request.url);
    const dni = searchParams.get("dni");
    const patientId = searchParams.get("patientId") ?? undefined;
    const obraSocialId = searchParams.get("obraSocialId") ?? undefined;
    const fecha = searchParams.get("fecha") ?? undefined;
    const attentionId = searchParams.get("attentionId") ?? undefined;

    const result = await getAttentionLookups({
      dni: dni ? normalizeDni(dni) : undefined,
      patientId,
      obraSocialId,
      fecha,
      attentionId,
    });

    return ok(result);
  } catch (error) {
    return fromUnknownError(error);
  }
}
