"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = isAdmin;
exports.can = can;
const readOnlyRoles = ["odontologo", "radiologo"];
function isAdmin(user) {
    return user.roles.includes("administrador");
}
function can(user, resource, action) {
    if (isAdmin(user)) {
        return true;
    }
    if (resource === "rx") {
        return user.roles.includes("radiologo");
    }
    if (resource === "atenciones") {
        return user.roles.includes("odontologo");
    }
    if (resource === "pacientes") {
        return readOnlyRoles.some((role) => user.roles.includes(role));
    }
    if (resource === "encuestas" ||
        resource === "admin-dashboard" ||
        resource === "liquidaciones" ||
        resource === "pagos" ||
        resource === "movimientos" ||
        resource === "tipos-movimientos" ||
        resource === "obras-sociales" ||
        resource === "codigos-obras-sociales" ||
        resource === "usuarios") {
        return false;
    }
    if (resource === "dashboard") {
        return true;
    }
    return action === "read" && readOnlyRoles.some((role) => user.roles.includes(role));
}
