import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { previewCodigosObrasSocialesWorkbook } from "@/services/codigos-obras-sociales";

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "codigos-obras-sociales", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para importar codigos", 403);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", "Debes adjuntar un archivo Excel", 400);
    }

    const lowerName = file.name.toLowerCase();

    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
      throw new AppError("VALIDATION_ERROR", "Solo se aceptan archivos .xlsx o .xls", 400);
    }

    const preview = await previewCodigosObrasSocialesWorkbook(
      file.name,
      await file.arrayBuffer(),
    );

    return ok(preview);
  } catch (error) {
    return fromUnknownError(error);
  }
}
