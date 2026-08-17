"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSession = getSession;
exports.toSessionUser = toSessionUser;
exports.requireSessionUser = requireSessionUser;
exports.requireApiSessionUser = requireApiSessionUser;
const headers_1 = require("next/headers");
const navigation_1 = require("next/navigation");
const api_1 = require("@/lib/api");
const auth_1 = require("@/lib/auth");
const utils_1 = require("@/lib/utils");
async function getSession() {
    return (0, auth_1.getAuth)().api.getSession({
        headers: await (0, headers_1.headers)(),
    });
}
function toSessionUser(session) {
    if (!session) {
        return null;
    }
    const user = session.user;
    return {
        id: user.id,
        email: user.email,
        nombre: user.name,
        apellido: String(user.apellido ?? ""),
        activo: Boolean(user.activo ?? true),
        roles: (0, utils_1.splitRoles)(String(user.roles ?? "")),
        authRole: String(user.role ?? "user"),
    };
}
async function requireSessionUser() {
    const session = await getSession();
    const user = toSessionUser(session);
    if (!user) {
        (0, navigation_1.redirect)("/login");
    }
    if (!user.activo) {
        (0, navigation_1.redirect)("/login?error=inactivo");
    }
    return user;
}
async function requireApiSessionUser(requestHeaders) {
    const session = await (0, auth_1.getAuth)().api.getSession({
        headers: requestHeaders,
    });
    const user = toSessionUser(session);
    if (!user) {
        throw new api_1.AppError("UNAUTHORIZED", "Debes iniciar sesion", 401);
    }
    if (!user.activo) {
        throw new api_1.AppError("FORBIDDEN", "Tu usuario esta inactivo", 403);
    }
    return user;
}
