import { AppError, fromUnknownError } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { buildPacientesWorkbook } from "@/services/pacientes";

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);
    if (!isAdmin(user)) throw new AppError("FORBIDDEN", "No tenes permisos para exportar pacientes", 403);

    const workbook = await buildPacientesWorkbook();
    const fileName = `pacientes-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new Response(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fromUnknownError(error);
  }
}
