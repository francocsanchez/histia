"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { ErrorState, LoadingState } from "@/components/shared/states";
import { StatCard } from "@/components/shared/stat-card";
import { getAttentionStatusBadgeClassName } from "@/lib/attention-status";
import { cn } from "@/lib/utils";
import { DashboardMonthlyStatsDto } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type DashboardPayload = {
  success: boolean;
  data: DashboardMonthlyStatsDto;
  error?: { message?: string };
};

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const [yearValue, monthValue] = month.split("-");
  const date = new Date(Number(yearValue), Number(monthValue) - 1 + delta, 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

function formatMonthLabel(month: string) {
  const [yearValue, monthValue] = month.split("-");
  const date = new Date(Number(yearValue), Number(monthValue) - 1, 1);

  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function DashboardStats() {
  const [month, setMonth] = useState(getCurrentMonthValue());
  const [selectedUserId, setSelectedUserId] = useState("");
  const [data, setData] = useState<DashboardMonthlyStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const currentMonth = getCurrentMonthValue();

  const load = async (options?: { nextUserId?: string }) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ month });
      const nextUserId = options?.nextUserId ?? selectedUserId;

      if (nextUserId) {
        params.set("userId", nextUserId);
      }

      const response = await fetch(`/api/dashboard/stats?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as DashboardPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar el dashboard");
      }

      setData(payload.data);

      if (
        payload.data.availableUsers.length > 0 &&
        payload.data.selectedUser.id !== selectedUserId
      ) {
        setSelectedUserId(payload.data.selectedUser.id);
      }
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
    const timeout = window.setTimeout(() => {
      void loadOnChange();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [month]);

  if (loading && !data) {
    return <LoadingState label="Cargando actividad mensual..." />;
  }

  if (error && !data) {
    return <ErrorState label={error} retry={() => void load()} />;
  }

  if (!data) {
    return <ErrorState label="No se pudo cargar el dashboard" retry={() => void load()} />;
  }

  const chartMaxValue = Math.max(...data.dailyAttentions.map((item) => item.total), 1);
  const isAdminView = data.availableUsers.length > 0;

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Panel mensual
            </p>
            <h2 className="mt-2 text-2xl font-semibold capitalize tracking-tight">
              {formatMonthLabel(data.month)}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Actividad registrada por {data.selectedUser.nombreCompleto || "usuario actual"}.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[auto_180px] xl:grid-cols-[auto_180px_260px]">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setMonth((currentMonth) => shiftMonth(currentMonth, -1))}
              >
                Mes anterior
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={month >= currentMonth}
                onClick={() => setMonth((currentMonth) => shiftMonth(currentMonth, 1))}
              >
                Mes siguiente
              </Button>
            </div>
            <Input
              type="month"
              value={month}
              max={currentMonth}
              onChange={(event) => setMonth(event.target.value || currentMonth)}
            />
            {isAdminView ? (
              <Select
                value={selectedUserId}
                onChange={(event) => {
                  const nextUserId = event.target.value;
                  setSelectedUserId(nextUserId);
                  void load({ nextUserId });
                }}
              >
                {data.availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.label}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
        </div>
      </Card>

      {error ? <ErrorState label={error} retry={() => void load()} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="Atenciones del mes" value={data.totals.atenciones} />
        <StatCard label="Codigos del mes" value={data.totals.codigos} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-4">
            <h3 className="text-base font-semibold">Atenciones diarias</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cantidad de atenciones cargadas por dia durante el mes seleccionado.
            </p>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[780px] p-4">
              <div className="flex h-72 items-end gap-2 border-b border-l border-border px-3 pb-3 pt-6">
                {data.dailyAttentions.map((item) => {
                  const barHeight = `${Math.max((item.total / chartMaxValue) * 100, item.total > 0 ? 8 : 2)}%`;

                  return (
                    <div
                      key={item.date}
                      className="flex min-w-0 flex-1 flex-col items-center gap-2 self-stretch"
                    >
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {item.total}
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={cn(
                            "w-full border border-primary/40 bg-[color:var(--chart-2)] transition-[height]",
                            item.total === 0 && "bg-muted",
                          )}
                          style={{ height: barHeight }}
                          title={`Dia ${item.day}: ${item.total} atenciones`}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{item.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-4">
            <h3 className="text-base font-semibold">Codigos por estado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Distribucion mensual de codigos cargados segun su estado actual.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {data.statusSummary.map((item) => (
                  <tr key={item.status} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Badge className={getAttentionStatusBadgeClassName(item.status)}>
                        {item.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{item.total}</td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/30">
                  <td className="px-4 py-3 font-semibold">Total</td>
                  <td className="px-4 py-3 text-right font-semibold">{data.totals.codigos}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
