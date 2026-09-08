const ISSN_URL = "https://apps.issn.gov.ar/ConsultasWeb/servlet/com.consultasweb.estadoafiliado";

export type IssnAffiliationResult =
  | { kind: "active" | "baja" | "not_found" | "unknown"; estado: string }
  | { kind: "error"; error: string };

function htmlText(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractInputValue(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<input[^>]+name=["']${escaped}["'][^>]+value=['"]([^'"]*)['"]`, "i"));
  return match ? htmlText(match[1]) : "";
}

function extractReadonlyValue(html: string, id: string) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<span[^>]+id=["']${escaped}["'][^>]*>([\\s\\S]*?)</span>`, "i"));
  return match ? htmlText(match[1]) : "";
}

function extractCookie(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

export function classifyIssnStatus(estado: string): IssnAffiliationResult {
  const normalized = estado.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");

  if (!normalized) return { kind: "not_found", estado: "" };
  if (normalized.startsWith("BAJA")) return { kind: "baja", estado: normalized };
  if (normalized === "ACTIVO") return { kind: "active", estado: normalized };
  return { kind: "unknown", estado: normalized };
}

export async function verifyIssnAffiliation(dni: string): Promise<IssnAffiliationResult> {
  try {
    const initial = await fetch(ISSN_URL, { headers: { "User-Agent": "Histia ISSN verification" }, signal: AbortSignal.timeout(20_000) });
    if (!initial.ok) return { kind: "error", error: `ISSN respondio HTTP ${initial.status}` };

    const initialHtml = await initial.text();
    if (/sistema se encuentra en mantenimiento/i.test(initialHtml)) {
      return { kind: "error", error: "El sitio de ISSN se encuentra en mantenimiento" };
    }

    const gxState = extractInputValue(initialHtml, "GXState");
    if (!gxState) return { kind: "error", error: "ISSN no devolvio el estado de sesion requerido" };

    const form = new URLSearchParams({
      vTIDOCODIGO: "DNI",
      vNRODOC: dni,
      vNOMBRE: "",
      vESTADO: "",
      vTXTPLAN: "",
      vNROTIT: "0",
      GXState: gxState,
      _EventName: "E'CONSULTAR'.",
      _EventGridId: "",
      _EventRowId: "",
    });
    const response = await fetch(ISSN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: extractCookie(initial), "User-Agent": "Histia ISSN verification" },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { kind: "error", error: `ISSN respondio HTTP ${response.status}` };

    const html = await response.text();
    if (/sistema se encuentra en mantenimiento/i.test(html)) {
      return { kind: "error", error: "El sitio de ISSN se encuentra en mantenimiento" };
    }
    return classifyIssnStatus(extractReadonlyValue(html, "span_vESTADO"));
  } catch (error) {
    return { kind: "error", error: error instanceof Error ? error.message : "No se pudo consultar ISSN" };
  }
}
