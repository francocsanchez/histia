import { AttentionCodeStatus } from "@/types/domain";

export const attentionStatusLabels: Record<AttentionCodeStatus, string> = {
  "no-cargado": "No cargado",
  pendiente: "Pendiente",
  ok: "OK",
  diferido: "Diferido",
  denegado: "Denegado",
};

export function getAttentionStatusBadgeVariant(status: AttentionCodeStatus) {
  if (status === "ok") {
    return "success" as const;
  }

  if (status === "denegado" || status === "diferido") {
    return "default" as const;
  }

  return "muted" as const;
}

export function getAttentionStatusBadgeClassName(status: AttentionCodeStatus) {
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

export function isAttentionCodeEditableByUser(status: AttentionCodeStatus) {
  return status === "pendiente";
}
