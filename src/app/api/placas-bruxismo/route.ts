import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { bruxismPlateCreateSchema } from "@/lib/validations/schemas";
import { createBruxismPlate, listBruxismPlates } from "@/services/placas-bruxismo";

export async function GET(request: Request) { try { const user = await requireApiSessionUser(request.headers); if (!can(user, "placas-bruxismo", "read")) throw new AppError("FORBIDDEN", "No tenes permisos", 403); return ok(await listBruxismPlates(user)); } catch (error) { return fromUnknownError(error); } }
export async function POST(request: Request) { try { const user = await requireApiSessionUser(request.headers); if (!can(user, "placas-bruxismo", "write")) throw new AppError("FORBIDDEN", "No tenes permisos", 403); return ok(await createBruxismPlate(bruxismPlateCreateSchema.parse(await request.json()), user), { status: 201 }); } catch (error) { return fromUnknownError(error); } }
