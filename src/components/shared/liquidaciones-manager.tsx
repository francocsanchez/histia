"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  attentionStatusLabels,
  getAttentionStatusBadgeClassName,
  getAttentionStatusBadgeVariant,
} from "@/lib/attention-status";
import { formatCurrencyFromCents, formatDateOnly } from "@/lib/utils";
import { attentionCodeStatusValues, AttentionDto } from "@/types/domain";

type ListPayload = {
  success: boolean;
  data: AttentionDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
};

type LookupPayload = {
  success: boolean;
  data: {
    obrasSociales: Array<{
      id: string;
      nombre: string;
      cantidadPrestacionesMes: number;
    }>;
    usuariosCarga: Array<{
      id: string;
      label: string;
    }>;
  };
  error?: { message?: string };
};

function formatTableDate(value: string) {
  return formatDateOnly(value);
}

export function LiquidacionesManager() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AttentionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [obrasSociales, setObrasSociales] = useState<LookupPayload["data"]["obrasSociales"]>(
    [],
  );
  const [usuariosCarga, setUsuariosCarga] = useState<LookupPayload["data"]["usuariosCarga"]>(
    [],
  );
  const search = searchParams.get("search") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const obraSocialId = searchParams.get("obraSocialId") ?? "";
  const userId = searchParams.get("userId") ?? "";
  const attentionStatus = searchParams.get("attentionStatus") ?? "";
  const pageParam = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const currentQueryString = searchParams.toString();

  const updateFilters = (
    nextValues: Partial<{
      search: string;
      dateFrom: string;
      dateTo: string;
      obraSocialId: string;
      userId: string;
      attentionStatus: string;
      page: string;
    }>,
    resetPage = false,
  ) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(nextValues).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    if (resetPage) {
      params.delete("page");
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const loadLookups = async () => {
    const response = await fetch("/api/atenciones/lookups", {
      cache: "no-store",
    });
    const payload = (await response.json()) as LookupPayload;

    if (!response.ok || !payload.success) {
      throw new Error(payload.error?.message || "No se pudieron cargar los filtros");
    }

    setObrasSociales(payload.data.obrasSociales);
    setUsuariosCarga(payload.data.usuariosCarga);
  };

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(page));
      params.set("limit", "10");

      const response = await fetch(`/api/liquidaciones?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ListPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar el listado");
      }

      setItems(payload.data);
      setTotalPages(payload.pagination.totalPages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const loadFromEffect = useEffectEvent(async () => {
    await load();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [currentQueryString]);

  const loadLookupsFromEffect = useEffectEvent(async () => {
    try {
      await loadLookups();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    }
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadLookupsFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Liquidaciones"
        description="Consulta administrativa de atenciones para preparar futuras liquidaciones."
      />

      <Card className="grid gap-2 p-3 xl:grid-cols-[1fr_150px_150px_220px_220px_180px]">
        <Input
          className="h-10"
          placeholder="Buscar por paciente, DNI, obra social o codigo"
          value={search}
          onChange={(event) => {
            updateFilters({ search: event.target.value }, true);
          }}
        />
        <Input
          className="h-10"
          type="date"
          value={dateFrom}
          onChange={(event) => {
            updateFilters({ dateFrom: event.target.value }, true);
          }}
        />
        <Input
          className="h-10"
          type="date"
          value={dateTo}
          onChange={(event) => {
            updateFilters({ dateTo: event.target.value }, true);
          }}
        />
        <Select
          className="h-10"
          value={obraSocialId}
          onChange={(event) => {
            updateFilters({ obraSocialId: event.target.value }, true);
          }}
        >
          <option value="">Todas las obras sociales</option>
          {obrasSociales.map((obraSocial) => (
            <option key={obraSocial.id} value={obraSocial.id}>
              {obraSocial.nombre}
            </option>
          ))}
        </Select>
        <Select
          className="h-10"
          value={userId}
          onChange={(event) => {
            updateFilters({ userId: event.target.value }, true);
          }}
        >
          <option value="">Todos los cargadores</option>
          {usuariosCarga.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>
              {usuario.label}
            </option>
          ))}
        </Select>
        <Select
          className="h-10"
          value={attentionStatus}
          onChange={(event) => {
            updateFilters({ attentionStatus: event.target.value }, true);
          }}
        >
          <option value="">Todos los estados</option>
          {attentionCodeStatusValues.map((status) => (
            <option key={status} value={status}>
              {attentionStatusLabels[status]}
            </option>
          ))}
        </Select>
      </Card>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState label={error} retry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState label="No hay atenciones para liquidar en la vista actual." />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] table-fixed text-xs">
              <colgroup>
                <col className="w-[72px]" />
                <col className="w-[180px]" />
                <col className="w-[100px]" />
                <col className="w-[120px]" />
                <col />
                <col className="w-[110px]" />
                <col className="w-[140px]" />
                <col className="w-[130px]" />
                <col className="w-[92px]" />
              </colgroup>
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Paciente</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">DNI</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Obra social</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">
                    <div className="grid grid-cols-[72px_1fr_56px_92px] gap-2">
                      <span>Codigo</span>
                      <span>Descripcion</span>
                      <span className="text-center">Pieza</span>
                      <span className="text-right">Valor</span>
                    </div>
                  </th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Coseguro</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Coseguro odonto</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Accion</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-3 py-2">{formatTableDate(item.fecha)}</td>
                    <td className="px-3 py-2 font-medium">
                      {item.pacienteNombreCompleto}
                    </td>
                    <td className="px-3 py-2">{item.pacienteDni}</td>
                    <td className="px-3 py-2">{item.obraSocialNombre}</td>
                    <td className="px-3 py-2">
                      <div className="grid auto-rows-[minmax(34px,auto)]">
                        {item.codigos.map((codigo, index) => (
                          <div
                            key={`${item.id}-${codigo.codigoObraSocialId}-${index}`}
                            className="grid min-h-[34px] grid-cols-[72px_1fr_56px_92px] items-center gap-2 border-b border-dashed border-border/80 py-1 last:border-b-0"
                          >
                            <p className="font-medium">{codigo.codigo}</p>
                            <p className="truncate text-muted-foreground">
                              {codigo.codigoNombre}
                            </p>
                            <p className="text-center">{codigo.pieza || "-"}</p>
                            <p className="text-right tabular-nums">
                              {formatCurrencyFromCents(codigo.pagoOdontologoCentavos)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {formatCurrencyFromCents(item.totalCoseguroCentavos)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {formatCurrencyFromCents(item.totalCoseguroOdontoCentavos)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="grid auto-rows-[minmax(34px,auto)]">
                        {item.codigos.map((codigo, index) => (
                          <div
                            key={`${item.id}-status-${codigo.codigoObraSocialId}-${index}`}
                            className="flex min-h-[34px] items-center border-b border-dashed border-border/80 py-1 last:border-b-0"
                          >
                            <Badge
                              variant={getAttentionStatusBadgeVariant(codigo.estado)}
                              className={getAttentionStatusBadgeClassName(codigo.estado)}
                            >
                              {attentionStatusLabels[codigo.estado]}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/atenciones/${item.id}/editar?${buildEditQueryString(
                          currentQueryString,
                        )}`}
                      >
                        <Button variant="secondary" size="sm" className="w-full">
                          Editar
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Pagina {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateFilters({ page: String(page - 1) })}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateFilters({ page: String(page + 1) })}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function buildEditQueryString(currentQueryString: string) {
  const params = new URLSearchParams(currentQueryString);
  params.set("admin", "1");

  return params.toString();
}
