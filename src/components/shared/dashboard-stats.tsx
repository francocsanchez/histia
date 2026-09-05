"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { ErrorState, LoadingState } from "@/components/shared/states";
import { StatCard } from "@/components/shared/stat-card";
import { getAttentionStatusBadgeClassName } from "@/lib/attention-status";
import { cn, formatCurrencyFromCents } from "@/lib/utils";
import { DashboardMonthlyStatsDto } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type ChartTooltipState = {
  x: number;
  y: number;
  lines: string[];
};

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

function EmptyChart({ label }: { label: string }) {
  return <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">{label}</div>;
}

function ChartTooltip({ tooltip }: { tooltip: ChartTooltipState | null }) {
  if (!tooltip) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-20 min-w-44 rounded-md border border-border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: "translate(-50%, calc(-100% - 12px))",
      }}
    >
      {tooltip.lines.map((line) => (
        <p key={line} className="whitespace-nowrap leading-5 text-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

function AnnualHonorariumChart({
  items,
}: {
  items: DashboardMonthlyStatsDto["annualHonorariumByMonth"];
}) {
  const [tooltip, setTooltip] = useState<ChartTooltipState | null>(null);
  const maxValue = Math.max(...items.map((item) => item.totalCentavos), 0);

  if (maxValue === 0) {
    return <EmptyChart label="No hay honorarios pendientes ni pagados para el año seleccionado." />;
  }

  return (
    <div className="relative space-y-4 overflow-x-auto" onMouseLeave={() => setTooltip(null)}>
      <ChartTooltip tooltip={tooltip} />
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <span className="h-3 w-3 rounded-full bg-amber-500" />
          Pendiente
        </span>
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          Pagado
        </span>
      </div>
      <div className="min-w-[720px]">
        <div className="flex h-72 items-end gap-3 border-b border-l border-border px-3 pb-3 pt-6">
          {items.map((item) => {
            const height = `${Math.max((item.totalCentavos / maxValue) * 100, item.totalCentavos > 0 ? 8 : 2)}%`;

            return (
              <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center gap-2 self-stretch">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {formatCurrencyFromCents(item.totalCentavos)}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="flex w-full cursor-pointer flex-col overflow-hidden border border-primary/20 transition-opacity hover:opacity-90"
                    style={{ height }}
                    onMouseMove={(event) => {
                      const bounds = event.currentTarget.parentElement?.parentElement?.parentElement?.getBoundingClientRect();

                      if (!bounds) {
                        return;
                      }

                      setTooltip({
                        x: event.clientX - bounds.left,
                        y: event.clientY - bounds.top,
                        lines: [
                          item.label,
                          `Pendiente: ${formatCurrencyFromCents(item.pendienteCentavos)}`,
                          `Pagado: ${formatCurrencyFromCents(item.pagadoCentavos)}`,
                          `Total: ${formatCurrencyFromCents(item.totalCentavos)}`,
                        ],
                      });
                    }}
                  >
                    {item.pendienteCentavos > 0 ? (
                      <div
                        className="w-full bg-amber-500"
                        style={{
                          height: `${(item.pendienteCentavos / item.totalCentavos) * 100}%`,
                        }}
                      />
                    ) : null}
                    {item.pagadoCentavos > 0 ? (
                      <div
                        className="w-full bg-emerald-500"
                        style={{
                          height: `${(item.pagadoCentavos / item.totalCentavos) * 100}%`,
                        }}
                      />
                    ) : null}
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
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
  const annualPendingAttentionCodesCentavos = data.annualHonorariumByMonth.reduce(
    (sum, item) => sum + item.pendingAttentionCodeCentavos,
    0,
  );
  const annualPaidCentavos = data.annualHonorariumByMonth.reduce(
    (sum, item) => sum + item.pagadoCentavos,
    0,
  );

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="xl:col-span-1">
          <StatCard label="Atenciones del mes" value={data.totals.atenciones} />
        </div>
        <div className="xl:col-span-1">
          <StatCard label="Codigos del mes" value={data.totals.codigos} />
        </div>
        <div className="xl:col-span-2">
          <StatCard
            label="Honorarios pendientes del año"
            value={formatCurrencyFromCents(annualPendingAttentionCodesCentavos)}
          />
        </div>
        <div className="xl:col-span-2">
          <StatCard
            label="Honorarios pagados del año"
            value={formatCurrencyFromCents(annualPaidCentavos)}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-4">
          <h3 className="text-base font-semibold">Honorarios anualizados</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Suma mes a mes de valor atencion mas coseguro odonto para {data.selectedUser.nombreCompleto || "el usuario seleccionado"}, separando lo pendiente de cobrar y lo ya pagado del anio de {data.month.slice(0, 4)}.
          </p>
        </div>
        <div className="p-4">
          <AnnualHonorariumChart items={data.annualHonorariumByMonth} />
        </div>
      </Card>

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
