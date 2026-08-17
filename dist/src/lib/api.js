"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.ok = ok;
exports.okWithPagination = okWithPagination;
exports.fail = fail;
exports.fromUnknownError = fromUnknownError;
exports.parsePositiveInteger = parsePositiveInteger;
const server_1 = require("next/server");
const zod_1 = require("zod");
class AppError extends Error {
    code;
    status;
    fields;
    constructor(code, message, status, fields) {
        super(message);
        this.code = code;
        this.status = status;
        this.fields = fields;
    }
}
exports.AppError = AppError;
function ok(data, init) {
    return server_1.NextResponse.json({ success: true, data }, init);
}
function okWithPagination(data, pagination, init) {
    return server_1.NextResponse.json({ success: true, data, pagination }, init);
}
function fail(error) {
    return server_1.NextResponse.json({
        success: false,
        error: {
            code: error.code,
            message: error.message,
            fields: error.fields,
        },
    }, { status: error.status });
}
function fromUnknownError(error) {
    if (error instanceof AppError) {
        return fail(error);
    }
    if (error instanceof zod_1.ZodError) {
        const fields = Object.fromEntries(error.issues.map((issue) => [
            issue.path.join(".") || "form",
            issue.message,
        ]));
        return fail(new AppError("VALIDATION_ERROR", "Los datos ingresados no son validos", 400, fields));
    }
    console.error(error);
    return fail(new AppError("INTERNAL_ERROR", "No se pudo completar la operacion", 500));
}
function parsePositiveInteger(value, fallback, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback;
    }
    if (max && parsed > max) {
        return max;
    }
    return Math.floor(parsed);
}
