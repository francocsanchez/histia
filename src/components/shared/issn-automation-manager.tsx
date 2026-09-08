"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";

import { ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { IssnAutomationDto } from "@/services/issn-automation";

type Payload = { success: boolean; data: IssnAutomationDto; error?: { message?: string } };

const statusLabel = {
  idle: "Sin ejecutar",
  running: "En ejecucion",
  completed: "Completada",
  error: "Detenida por error",
} as const;

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value)) : "-";
}

export function IssnAutomationManager() {
  const [data, setData] = useState<IssnAutomationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/automatizaciones/issn", { cache: "no-store" });
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.success) throw new Error(payload.error?.message || "No se pudo cargar la automatizacion");
      setData(payload.data);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFromEffect = useEffectEvent(async () => {
    await load();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadFromEffect();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);
  useEffect(() => {
    if (data?.status !== "running" && !data?.manualRunRequestedAt) return;
    const interval = window.setInterval(() => void load(), 3_000);
    return () => window.clearInterval(interval);
  }, [data?.manualRunRequestedAt, data?.status, load]);

  const execute = async () => {
    setRunning(true);
    try {
      const response = await fetch("/api/automatizaciones/issn", { method: "POST" });
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.success) throw new Error(payload.error?.message || "No se pudo solicitar la ejecucion");
      setData(payload.data);
      await load();
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : "Error inesperado");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Automatizaciones" description="Controla las tareas automaticas de Histia." />
      {loading ? <LoadingState label="Cargando automatizaciones..." /> : null}
      {!loading && error && !data ? <ErrorState label={error} retry={() => void load()} /> : null}
      {!loading && data ? (
        <Card className="space-y-5 p-5">
          <div className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Verificacion ISSN</h2>
              <p className="text-sm text-muted-foreground">Consulta pacientes ISSN cada 3 segundos y desactiva solo bajas confirmadas.</p>
            </div>
            <Button type="button" onClick={() => void execute()} disabled={running || data.status === "running" || Boolean(data.manualRunRequestedAt)}>
              {running || data.status === "running" || data.manualRunRequestedAt ? "En ejecucion..." : "Ejecutar ahora"}
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-muted-foreground">Estado</p><p className="font-medium">{data.manualRunRequestedAt && data.status !== "running" ? "Pendiente" : statusLabel[data.status]}</p></div>
            <div><p className="text-muted-foreground">Origen</p><p className="font-medium">{data.origin === "manual" ? "Manual" : data.origin === "scheduled" ? "Programada" : "-"}</p></div>
            <div><p className="text-muted-foreground">Inicio</p><p className="font-medium">{dateTime(data.startedAt)}</p></div>
            <div><p className="text-muted-foreground">Fin</p><p className="font-medium">{dateTime(data.finishedAt)}</p></div>
          </div>
          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-5">
            <div><p className="text-sm text-muted-foreground">Progreso</p><p className="text-lg font-semibold">{data.processed} / {data.total}</p></div>
            <div><p className="text-sm text-muted-foreground">Desactivados</p><p className="text-lg font-semibold">{data.deactivated}</p></div>
            <div><p className="text-sm text-muted-foreground">Sin cambios</p><p className="text-lg font-semibold">{data.unchanged}</p></div>
            <div><p className="text-sm text-muted-foreground">Errores</p><p className="text-lg font-semibold">{data.errors}</p></div>
            <div><p className="text-sm text-muted-foreground">Proxima corrida</p><p className="text-lg font-semibold">02:00</p></div>
          </div>
          {data.lastError ? <p className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{data.lastError}</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
