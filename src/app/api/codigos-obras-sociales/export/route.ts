import { AppError, fromUnknownError } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { buildCodigosObrasSocialesWorkbook } from "@/services/codigos-obras-sociales";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "codigos-obras-sociales", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para exportar codigos", 403);
    }

    const workbook = await buildCodigosObrasSocialesWorkbook();
    const fileName = `codigos-obras-sociales-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const body = new Uint8Array(workbook);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fromUnknownError(error);
  }
}
