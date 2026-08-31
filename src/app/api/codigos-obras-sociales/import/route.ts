import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { importCodigosObrasSocialesFromPreview } from "@/services/codigos-obras-sociales";

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "codigos-obras-sociales", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para importar codigos", 403);
    }

    const body = (await request.json()) as {
      rows?: Parameters<typeof importCodigosObrasSocialesFromPreview>[0]["rows"];
    };

    const result = await importCodigosObrasSocialesFromPreview({
      rows: Array.isArray(body.rows) ? body.rows : [],
    });

    return ok(result);
  } catch (error) {
    return fromUnknownError(error);
  }
}
