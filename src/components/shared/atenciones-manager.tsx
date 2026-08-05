"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { attentionStatusLabels } from "@/lib/attention-status";
import { formatDate } from "@/lib/utils";
import { AttentionDto } from "@/types/domain";

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

export function AtencionesManager({
  isAdmin,
}: {
  isAdmin: boolean;
}) {
  const [items, setItems] = useState<AttentionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [obraSocialId, setObraSocialId] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [obrasSociales, setObrasSociales] = useState<LookupPayload["data"]["obrasSociales"]>(
    [],
  );
  const [usuariosCarga, setUsuariosCarga] = useState<LookupPayload["data"]["usuariosCarga"]>(
    [],
  );

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
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });

      if (search) params.set("search", search);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (obraSocialId) params.set("obraSocialId", obraSocialId);
      if (userId) params.set("userId", userId);

      const response = await fetch(`/api/atenciones?${params.toString()}`, {
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
    await loadLookups();
    await load();
  });

  const formatStatusSummary = (item: AttentionDto) => {
    const counts = item.codigos.reduce(
      (acc, codigo) => {
        acc[codigo.estado] = (acc[codigo.estado] ?? 0) + 1;
        return acc;
      },
      {} as Partial<Record<AttentionDto["codigos"][number]["estado"], number>>,
    );

    return Object.entries(counts)
      .map(([status, count]) => {
        const typedStatus = status as AttentionDto["codigos"][number]["estado"];
        return `${attentionStatusLabels[typedStatus]} (${count})`;
      })
      .join(" | ");
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [page, search, dateFrom, dateTo, obraSocialId, userId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atenciones"
        description="Registra prestaciones realizadas por odontologia y controla el consumo mensual por paciente."
        actionLabel="Nueva atencion"
        actionHref="/atenciones/nueva"
      />

      <Card
        className={`grid gap-3 p-4 ${
          isAdmin ? "xl:grid-cols-[1fr_180px_180px_260px_240px]" : "xl:grid-cols-[1fr_180px_180px_260px]"
        }`}
      >
        <Input
          placeholder="Buscar por paciente, DNI, obra social o codigo"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setPage(1);
            setDateFrom(event.target.value);
          }}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => {
            setPage(1);
            setDateTo(event.target.value);
          }}
        />
        <Select
          value={obraSocialId}
          onChange={(event) => {
            setPage(1);
            setObraSocialId(event.target.value);
          }}
        >
          <option value="">Todas las obras sociales</option>
          {obrasSociales.map((obraSocial) => (
            <option key={obraSocial.id} value={obraSocial.id}>
              {obraSocial.nombre}
            </option>
          ))}
        </Select>
        {isAdmin ? (
          <Select
            value={userId}
            onChange={(event) => {
              setPage(1);
              setUserId(event.target.value);
            }}
          >
            <option value="">Todos los cargadores</option>
            {usuariosCarga.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.label}
              </option>
            ))}
          </Select>
        ) : null}
      </Card>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState label={error} retry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState label="No hay atenciones para mostrar." />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[19%]" />
                <col className="w-[24%]" />
                <col className="w-[14%]" />
                <col className="w-[37%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Obra social</th>
                  <th className="px-4 py-3">Codigos</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">{formatDate(item.fecha)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.pacienteNombreCompleto}</p>
                      <p className="text-muted-foreground">DNI: {item.pacienteDni}</p>
                    </td>
                    <td className="px-4 py-3">{item.obraSocialNombre}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-foreground">
                        {item.cantidadCodigos} codigo{item.cantidadCodigos === 1 ? "" : "s"}{" "}
                        - {formatStatusSummary(item)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link href={`/atenciones/${item.id}/editar`}>
                          <Button variant="secondary" size="sm">
                            Editar
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Pagina {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
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
