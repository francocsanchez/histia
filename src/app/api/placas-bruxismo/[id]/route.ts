import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getBruxismPlate } from "@/services/placas-bruxismo";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiSessionUser(request.headers); if (!can(user, "placas-bruxismo", "read")) throw new AppError("FORBIDDEN", "No tenes permisos", 403); return ok(await getBruxismPlate((await params).id, user)); } catch (error) { return fromUnknownError(error); } }
