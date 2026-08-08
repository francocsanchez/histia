import {
  AppError,
  fromUnknownError,
  ok,
  parsePositiveInteger,
} from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { movementCreateSchema } from "@/lib/validations/schemas";
import { createManualMovement, listMovements } from "@/services/movimientos";
import {
  MovementDirection,
  MovementOriginType,
  movementDirectionValues,
  movementOriginTypeValues,
} from "@/types/domain";

function parseEnumValue<T extends string>(
  value: string | null,
  options: readonly T[],
): T | undefined {
  if (!value) {
    return undefined;
  }

  return options.includes(value as T) ? (value as T) : undefined;
}

export async function GET(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "movimientos", "read")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para acceder", 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = parsePositiveInteger(searchParams.get("limit"), 10, 50);
    const dateFrom = searchParams.get("dateFrom") ?? undefined;
    const dateTo = searchParams.get("dateTo") ?? undefined;
    const directionParam = searchParams.get("direction");
    const typeId = searchParams.get("type") ?? undefined;
    const originTypeParam = searchParams.get("originType");

    const direction = parseEnumValue<MovementDirection>(
      directionParam,
      movementDirectionValues,
    );
    const originType = parseEnumValue<MovementOriginType>(
      originTypeParam,
      movementOriginTypeValues,
    );

    const result = await listMovements({
      page,
      limit,
      dateFrom,
      dateTo,
      direction,
      typeId,
      originType,
    });

    return Response.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "movimientos", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para crear movimientos", 403);
    }

    const body = movementCreateSchema.parse(await request.json());
    const movement = await createManualMovement(body, user.id);

    return ok(movement, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}
