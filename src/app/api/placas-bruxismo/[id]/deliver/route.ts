import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { bruxismPlatePaymentSchema } from "@/lib/validations/schemas";
import { deliverBruxismPlate } from "@/services/placas-bruxismo";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiSessionUser(request.headers); if (!can(user, "placas-bruxismo", "write")) throw new AppError("FORBIDDEN", "No tenes permisos", 403); return ok(await deliverBruxismPlate((await params).id, bruxismPlatePaymentSchema.parse(await request.json()), user)); } catch (error) { return fromUnknownError(error); } }
