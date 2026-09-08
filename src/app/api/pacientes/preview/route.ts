import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { previewPacientesWorkbook } from "@/services/pacientes";

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);
    if (!isAdmin(user)) throw new AppError("FORBIDDEN", "No tenes permisos para importar pacientes", 403);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Debes adjuntar un archivo Excel", 400);
    if (!/\.xlsx?$/i.test(file.name)) {
      throw new AppError("VALIDATION_ERROR", "Solo se aceptan archivos .xlsx o .xls", 400);
    }
    return ok(await previewPacientesWorkbook(file.name, await file.arrayBuffer()));
  } catch (error) {
    return fromUnknownError(error);
  }
}
