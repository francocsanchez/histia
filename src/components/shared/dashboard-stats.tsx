"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { ErrorState, LoadingState } from "@/components/shared/states";
import { StatCard } from "@/components/shared/stat-card";
import { DashboardStatsDto } from "@/types/domain";

export function DashboardStats() {
  const [data, setData] = useState<DashboardStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/dashboard/stats", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar el dashboard");
      }

      setData(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const loadOnMount = useEffectEvent(async () => {
    await load();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadOnMount();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  if (loading) {
    return <LoadingState label="Cargando indicadores..." />;
  }

  if (error || !data) {
    return <ErrorState label={error || "No se pudo cargar el dashboard"} retry={load} />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Obras sociales activas" value={data.obrasSocialesActivas} />
      <StatCard label="Codigos activos" value={data.codigosActivos} />
      <StatCard label="Pacientes activos" value={data.pacientesActivos} />
      <StatCard label="Usuarios activos" value={data.usuariosActivos} />
    </div>
  );
}
