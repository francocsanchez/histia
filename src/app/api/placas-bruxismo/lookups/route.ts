import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getBruxismLookups } from "@/services/placas-bruxismo";
export async function GET(request: Request) { try { const user = await requireApiSessionUser(request.headers); if (!can(user, "placas-bruxismo", "read")) throw new AppError("FORBIDDEN", "No tenes permisos", 403); return ok(await getBruxismLookups(new URL(request.url).searchParams.get("dni") ?? undefined)); } catch (error) { return fromUnknownError(error); } }
