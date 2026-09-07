"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { attentionStatusLabels, getAttentionStatusBadgeClassName } from "@/lib/attention-status";
import { formatCurrencyFromCents, formatDateOnly } from "@/lib/utils";
import { AttentionCodeControlDto, AttentionCodeStatus } from "@/types/domain";

type Payload = {
  success: boolean;
  data: AttentionCodeControlDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
};

export function AttentionCodeStatusManager({
  attentionStatus,
  dateFrom,
  dateTo,
  userId,
}: {
  attentionStatus: AttentionCodeStatus;
  dateFrom: string;
  dateTo: string;
  userId: string;
}) {
  const [items, setItems] = useState<AttentionCodeControlDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        attentionStatus,
        dateFrom,
        dateTo,
        page: String(page),
        limit: "20",
      });

      if (userId) params.set("userId", userId);

      const response = await fetch(`/api/atenciones/codigos-por-estado?${params}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as Payload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudieron cargar los codigos");
      }

      setItems(payload.data);
      setTotal(payload.pagination.total);
      setTotalPages(payload.pagination.totalPages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const loadOnChange = useEffectEvent(async () => {
    await load();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadOnChange(), 0);
    return () => window.clearTimeout(timeout);
  }, [page]);

  const returnParams = new URLSearchParams({
    from: "status-control",
    attentionStatus,
    dateFrom,
    dateTo,
  });

  if (userId) returnParams.set("userId", userId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Codigos ${attentionStatusLabels[attentionStatus].toLowerCase()}`}
        description={`Control de ${total} codigo${total === 1 ? "" : "s"} del periodo seleccionado. No se muestra el valor de atencion.`}
      />

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState label={error} retry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState label="No hay codigos con este estado para el periodo seleccionado." />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1250px] text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Obra social</th>
                  <th className="px-4 py-3">Odontologo</th>
                  <th className="px-4 py-3">Codigo</th>
                  <th className="px-4 py-3">Pieza</th>
                  <th className="px-4 py-3 text-right">Coseguro</th>
                  <th className="px-4 py-3 text-right">Coseguro odonto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="min-w-[300px] px-4 py-3">Observacion</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.lineId} className="border-t border-border align-top">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateOnly(item.fecha)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.pacienteNombreCompleto}</p>
                      <p className="text-muted-foreground">DNI: {item.pacienteDni}</p>
                    </td>
                    <td className="px-4 py-3">{item.obraSocialNombre}</td>
                    <td className="px-4 py-3">{item.usuarioCargaNombre}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.codigo}</p>
                      <p className="text-muted-foreground">{item.codigoNombre}</p>
                    </td>
                    <td className="px-4 py-3">{item.pieza || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrencyFromCents(item.coseguroCentavos ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrencyFromCents(item.coseguroOdontoCentavos ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getAttentionStatusBadgeClassName(item.estado)}>
                        {attentionStatusLabels[item.estado]}
                      </Badge>
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-3">
                      {item.observacion || <span className="text-muted-foreground">Sin observacion</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.estado === "pendiente" ? (
                        <Link href={`/atenciones/${item.attentionId}/editar?${returnParams}`}>
                          <Button variant="secondary" size="sm">Editar</Button>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin edicion</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">Pagina {page} de {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
