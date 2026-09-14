import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { bruxismPlateReceiveSchema } from "@/lib/validations/schemas";
import { receiveBruxismPlate } from "@/services/placas-bruxismo";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiSessionUser(request.headers); if (!can(user, "placas-bruxismo", "write")) throw new AppError("FORBIDDEN", "No tenes permisos", 403); const input = bruxismPlateReceiveSchema.parse(await request.json()); return ok(await receiveBruxismPlate((await params).id, input.costoLaboratorioCentavos, user)); } catch (error) { return fromUnknownError(error); } }
