"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attentionStatusLabels = void 0;
exports.getAttentionStatusBadgeVariant = getAttentionStatusBadgeVariant;
exports.getAttentionStatusBadgeClassName = getAttentionStatusBadgeClassName;
exports.isAttentionCodeEditableByUser = isAttentionCodeEditableByUser;
exports.attentionStatusLabels = {
    "no-cargado": "No cargado",
    pendiente: "Pendiente",
    ok: "OK",
    diferido: "Diferido",
    denegado: "Denegado",
};
function getAttentionStatusBadgeVariant(status) {
    if (status === "ok") {
        return "success";
    }
    if (status === "denegado" || status === "diferido") {
        return "default";
    }
    return "muted";
}
function getAttentionStatusBadgeClassName(status) {
    if (status === "no-cargado") {
        return "border-slate-900 bg-slate-900 text-white";
    }
    if (status === "pendiente") {
        return "border-amber-300 bg-amber-100 text-amber-950";
    }
    if (status === "ok") {
        return "border-emerald-300 bg-emerald-100 text-emerald-900";
    }
    return "border-rose-300 bg-rose-100 text-rose-900";
}
function isAttentionCodeEditableByUser(status) {
    return status === "pendiente";
}
