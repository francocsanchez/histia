import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public code:
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "VALIDATION_ERROR"
      | "DUPLICATE_RECORD"
      | "INACTIVE_RELATED_RECORD"
      | "INVALID_CREDENTIALS"
      | "INTERNAL_ERROR",
    message: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function okWithPagination<T>(
  data: T,
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
  init?: ResponseInit,
) {
  return NextResponse.json({ success: true, data, pagination }, init);
}

export function fail(error: AppError) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        fields: error.fields,
      },
    },
    { status: error.status },
  );
}

export function fromUnknownError(error: unknown) {
  if (error instanceof AppError) {
    return fail(error);
  }

  if (error instanceof ZodError) {
    const fields = Object.fromEntries(
      error.issues.map((issue) => [
        issue.path.join(".") || "form",
        issue.message,
      ]),
    );

    return fail(
      new AppError(
        "VALIDATION_ERROR",
        "Los datos ingresados no son validos",
        400,
        fields,
      ),
    );
  }

  console.error(error);

  return fail(
    new AppError(
      "INTERNAL_ERROR",
      "No se pudo completar la operacion",
      500,
    ),
  );
}

export function parsePositiveInteger(
  value: string | null,
  fallback: number,
  max?: number,
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  if (max && parsed > max) {
    return max;
  }

  return Math.floor(parsed);
}
