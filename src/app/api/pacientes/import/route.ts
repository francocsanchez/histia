import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { importPacientesFromPreview } from "@/services/pacientes";

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);
    if (!isAdmin(user)) throw new AppError("FORBIDDEN", "No tenes permisos para importar pacientes", 403);
    const body = (await request.json()) as { rows?: Parameters<typeof importPacientesFromPreview>[0]["rows"] };
    return ok(await importPacientesFromPreview({ rows: Array.isArray(body.rows) ? body.rows : [] }));
  } catch (error) {
    return fromUnknownError(error);
  }
}
