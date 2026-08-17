import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { previewSurveyWorkbook } from "@/services/surveys";

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "encuestas", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para importar encuestas", 403);
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

    const preview = await previewSurveyWorkbook(file.name, await file.arrayBuffer());
    return ok(preview);
  } catch (error) {
    return fromUnknownError(error);
  }
}
