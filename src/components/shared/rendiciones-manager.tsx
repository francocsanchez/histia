"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { pdf } from "@react-pdf/renderer";

import { RendicionPdf } from "@/components/shared/rendicion-pdf";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatCurrencyFromCents, formatDateOnly } from "@/lib/utils";
import { PaymentDto, RenditionDto } from "@/types/domain";

type PaymentsPayload = { success: boolean; data: PaymentDto[]; pagination: { page: number; totalPages: number }; error?: { message?: string } };
type LookupPayload = { success: boolean; data: { users: { id: string; label: string }[] }; error?: { message?: string } };
type RenditionPayload = { success: boolean; data: RenditionDto; error?: { message?: string } };

export function RendicionesManager({ isAdmin }: { isAdmin: boolean }) {
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [users, setUsers] = useState<{ id: string; label: string }[]>([]);
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (isAdmin && userId) params.set("userId", userId);
      const response = await fetch(`/api/rendiciones?${params}`, { cache: "no-store" });
      const payload = await response.json() as PaymentsPayload;
      if (!response.ok || !payload.success) throw new Error(payload.error?.message || "No se pudieron cargar las rendiciones");
      setPayments(payload.data); setTotalPages(payload.pagination.totalPages);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Error inesperado"); }
    finally { setLoading(false); }
  }, [isAdmin, page, userId]);

  useEffect(() => { const timeout = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeout); }, [load]);
  useEffect(() => { if (!isAdmin) return; const timeout = window.setTimeout(() => { void (async () => { const response = await fetch("/api/rendiciones/lookups", { cache: "no-store" }); const payload = await response.json() as LookupPayload; if (response.ok && payload.success) setUsers(payload.data.users); })(); }, 0); return () => window.clearTimeout(timeout); }, [isAdmin]);

  async function download(payment: PaymentDto) {
    setDownloadingId(payment.id);
    try {
      const response = await fetch(`/api/rendiciones/${payment.id}`, { cache: "no-store" });
      const payload = await response.json() as RenditionPayload;
      if (!response.ok || !payload.success) throw new Error(payload.error?.message || "No se pudo preparar el PDF");
      const blob = await pdf(<RendicionPdf rendition={payload.data} />).toBlob();
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `rendicion-${payment.usuarioNombreSnapshot.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${payment.id.slice(-8)}.pdf`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) { setError(downloadError instanceof Error ? downloadError.message : "No se pudo descargar el PDF"); }
    finally { setDownloadingId(null); }
  }

  return <div className="space-y-6"><PageHeader title="Rendiciones" description="Liquidaciones emitidas y comprobantes descargables por profesional." />
    {isAdmin ? <Card className="p-4"><div className="max-w-sm"><label className="mb-2 block text-sm font-medium">Profesional</label><Select value={userId} onChange={(event) => { setUserId(event.target.value); setPage(1); }}><option value="">Todos los profesionales</option>{users.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}</Select></div></Card> : null}
    {error ? <ErrorState label={error} retry={() => void load()} /> : null}
    {loading ? <LoadingState label="Cargando rendiciones..." /> : null}
    {!loading && !error && payments.length === 0 ? <EmptyState label="Todavía no hay pagos realizados para mostrar." /> : null}
    {!loading && payments.length > 0 ? <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-sm"><thead className="bg-muted/70 text-left"><tr><th className="px-4 py-3">Profesional</th><th className="px-4 py-3">Fecha de pago</th><th className="px-4 py-3">Períodos</th><th className="px-4 py-3 text-right">Conceptos</th><th className="px-4 py-3 text-right">Códigos</th><th className="px-4 py-3 text-right">Coseguros</th><th className="px-4 py-3 text-right">Neto pagado</th><th className="px-4 py-3 text-right">Comprobante</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className="border-t border-border"><td className="px-4 py-3 font-medium">{payment.usuarioNombreSnapshot}</td><td className="px-4 py-3">{formatDateOnly(payment.paidAt)}</td><td className="px-4 py-3">{payment.attentionMonths.join(", ")}</td><td className="px-4 py-3 text-right tabular-nums">{payment.quantityConceptsPaid}</td><td className="px-4 py-3 text-right tabular-nums">{formatCurrencyFromCents(payment.totalPagoCodigosCentavos)}</td><td className="px-4 py-3 text-right tabular-nums">{formatCurrencyFromCents(payment.totalCoseguroOdontoCentavos)}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrencyFromCents(payment.totalNetoPagarCentavos)}</td><td className="px-4 py-3 text-right"><Button type="button" size="sm" variant="secondary" onClick={() => void download(payment)} disabled={downloadingId === payment.id}>{downloadingId === payment.id ? <FileText className="size-4 animate-pulse" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}{downloadingId === payment.id ? "Generando..." : "Descargar PDF"}</Button></td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-border px-4 py-3"><p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p><div className="flex gap-2"><Button type="button" size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button type="button" size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</Button></div></div></Card> : null}
  </div>;
}
