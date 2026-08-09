"use client";

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { AdminDashboardCodeStatusItemDto, AdminDashboardDto } from "@/types/domain";
import { cn, formatCurrencyFromCents } from "@/lib/utils";

type AdminDashboardPayload = {
  success: boolean;
  data: AdminDashboardDto;
  error?: { message?: string };
};

type ChartTooltipState = {
  x: number;
  y: number;
  lines: string[];
};

const chartPalette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const statusChartColors: Record<AdminDashboardCodeStatusItemDto["status"], string> = {
  "no-cargado": "#0f172a",
  pendiente: "#d97706",
  ok: "#059669",
  diferido: "#e11d48",
  denegado: "#be123c",
};

function getCurrentYearValue() {
  return String(new Date().getFullYear());
}

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthOption(month: string) {
  const [yearValue, monthValue] = month.split("-");
  const date = new Date(Number(yearValue), Number(monthValue) - 1, 1);

  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-4 text-4xl font-semibold tracking-tight",
          tone === "success" && "text-emerald-700",
          tone === "danger" && "text-rose-700",
        )}
      >
        {value}
      </p>
    </Card>
  );
}

function ChartShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function ChartTooltip({ tooltip }: { tooltip: ChartTooltipState | null }) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const element = tooltipRef.current;
    const parent = element?.parentElement;

    if (!tooltip || !element || !parent) {
      setPosition(null);
      return;
    }

    const margin = 12;
    const gap = 12;
    const tooltipWidth = element.offsetWidth;
    const tooltipHeight = element.offsetHeight;
    const parentWidth = parent.clientWidth;
    const parentHeight = parent.clientHeight;

    const minLeft = margin;
    const maxLeft = Math.max(parentWidth - tooltipWidth - margin, margin);
    const desiredLeft = tooltip.x - tooltipWidth / 2;
    const left = Math.min(Math.max(desiredLeft, minLeft), maxLeft);

    const topAbove = tooltip.y - tooltipHeight - gap;
    const topBelow = tooltip.y + gap;
    const minTop = margin;
    const maxTop = Math.max(parentHeight - tooltipHeight - margin, margin);
    const top = topAbove >= minTop
      ? topAbove
      : Math.min(Math.max(topBelow, minTop), maxTop);

    setPosition({ left, top });
  }, [tooltip]);

  if (!tooltip) {
    return null;
  }

  return (
    <div
      ref={tooltipRef}
      className="pointer-events-none absolute z-20 min-w-40 rounded-md border border-border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
      style={{
        left: position?.left ?? tooltip.x,
        top: position?.top ?? tooltip.y,
        visibility: position ? "visible" : "hidden",
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

function PieChart({
  items,
  unitFormatter,
}: {
  items: Array<{ id: string; label: string; total: number }>;
  unitFormatter: (value: number) => string;
}) {
  const [tooltip, setTooltip] = useState<ChartTooltipState | null>(null);
  const total = items.reduce((sum, item) => sum + item.total, 0);

  if (total === 0 || items.length === 0) {
    return <EmptyChart label="No hay datos para mostrar." />;
  }

  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const slices = items.map((item, index) => {
    const previousTotal = items
      .slice(0, index)
      .reduce((sum, currentItem) => sum + currentItem.total, 0);
    const fraction = item.total / total;

    return {
      ...item,
      color: chartPalette[index % chartPalette.length],
      dash: fraction * circumference,
      offset: circumference - (previousTotal / total) * circumference,
      percentage: fraction * 100,
    };
  });

  return (
    <div className="relative grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
      <ChartTooltip tooltip={tooltip} />
      <div className="flex justify-center">
        <svg
          viewBox="0 0 200 200"
          className="h-52 w-52 -rotate-90"
          onMouseLeave={() => setTooltip(null)}
        >
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="color-mix(in oklab, var(--border) 70%, transparent)"
            strokeWidth="28"
          />
          {slices.map((item) => (
            <circle
              key={item.id}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="28"
              strokeDasharray={`${item.dash} ${circumference - item.dash}`}
              strokeDashoffset={item.offset}
              strokeLinecap="butt"
              className="cursor-pointer transition-opacity hover:opacity-85"
              onMouseMove={(event) => {
                const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();

                if (!bounds) {
                  return;
                }

                setTooltip({
                  x: event.clientX - bounds.left,
                  y: event.clientY - bounds.top,
                  lines: [
                    item.label,
                    `${unitFormatter(item.total)} (${item.percentage.toFixed(1)}%)`,
                  ],
                });
              }}
            />
          ))}
          <circle cx="100" cy="100" r="48" fill="white" />
        </svg>
      </div>
      <div className="space-y-3">
        {slices.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 text-sm"
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate">{item.label}</span>
            <span className="text-right font-medium">
              {unitFormatter(item.total)} ({item.percentage.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({
  items,
  valueFormatter,
}: {
  items: Array<{ month: number; label: string; total: number }>;
  valueFormatter: (value: number) => string;
}) {
  const [tooltip, setTooltip] = useState<ChartTooltipState | null>(null);
  const maxValue = Math.max(...items.map((item) => item.total), 0);

  if (maxValue === 0) {
    return <EmptyChart label="No hay datos para el año seleccionado." />;
  }

  return (
    <div className="relative overflow-x-auto" onMouseLeave={() => setTooltip(null)}>
      <ChartTooltip tooltip={tooltip} />
      <div className="min-w-[720px]">
        <div className="flex h-72 items-end gap-3 border-b border-l border-border px-3 pb-3 pt-6">
          {items.map((item) => {
            const height = `${Math.max((item.total / maxValue) * 100, item.total > 0 ? 8 : 2)}%`;

            return (
              <div
                key={item.month}
                className="flex min-w-0 flex-1 flex-col items-center gap-2 self-stretch"
              >
                <span className="text-[11px] font-medium text-muted-foreground">
                  {valueFormatter(item.total)}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full cursor-pointer border border-primary/40 bg-[color:var(--chart-2)] transition-opacity hover:opacity-85"
                    style={{ height }}
                    onMouseMove={(event) => {
                      const bounds = event.currentTarget.parentElement?.parentElement?.parentElement?.getBoundingClientRect();

                      if (!bounds) {
                        return;
                      }

                      setTooltip({
                        x: event.clientX - bounds.left,
                        y: event.clientY - bounds.top,
                        lines: [item.label, valueFormatter(item.total)],
                      });
                    }}
                  />
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

function LineChart({
  items,
}: {
  items: Array<{
    month: number;
    label: string;
    ingresosCentavos: number;
    egresosCentavos: number;
  }>;
}) {
  const [tooltip, setTooltip] = useState<ChartTooltipState | null>(null);
  const maxValue = Math.max(
    ...items.flatMap((item) => [item.ingresosCentavos, item.egresosCentavos]),
    0,
  );

  if (maxValue === 0) {
    return <EmptyChart label="No hay movimientos para el año seleccionado." />;
  }

  const width = 720;
  const height = 280;
  const paddingX = 36;
  const paddingY = 24;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const buildPath = (key: "ingresosCentavos" | "egresosCentavos") =>
    items
      .map((item, index) => {
        const x = paddingX + (index / Math.max(items.length - 1, 1)) * chartWidth;
        const y =
          height -
          paddingY -
          ((item[key] ?? 0) / maxValue) * chartHeight;

        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

  return (
    <div className="relative space-y-4 overflow-x-auto">
      <ChartTooltip tooltip={tooltip} />
      <div className="flex gap-4 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-600" />
          Ingresos
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-600" />
          Egresos
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[720px]"
        onMouseLeave={() => setTooltip(null)}
      >
        <rect x="0" y="0" width={width} height={height} fill="white" />
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = height - paddingY - tick * chartHeight;
          return (
            <line
              key={tick}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="color-mix(in oklab, var(--border) 70%, transparent)"
              strokeWidth="1"
            />
          );
        })}
        <path d={buildPath("ingresosCentavos")} fill="none" stroke="#059669" strokeWidth="3" />
        <path d={buildPath("egresosCentavos")} fill="none" stroke="#e11d48" strokeWidth="3" />
        {items.map((item, index) => {
          const x = paddingX + (index / Math.max(items.length - 1, 1)) * chartWidth;
          const incomeY =
            height - paddingY - (item.ingresosCentavos / maxValue) * chartHeight;
          const expenseY =
            height - paddingY - (item.egresosCentavos / maxValue) * chartHeight;
          const areaWidth = chartWidth / Math.max(items.length - 1, 1);

          return (
            <g key={item.month}>
              <circle cx={x} cy={incomeY} r="4" fill="#059669" />
              <circle cx={x} cy={expenseY} r="4" fill="#e11d48" />
              <rect
                x={Math.max(x - areaWidth / 2, 0)}
                y={0}
                width={Math.max(areaWidth, 32)}
                height={height}
                fill="transparent"
                onMouseMove={(event) => {
                  const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();

                  if (!bounds) {
                    return;
                  }

                  setTooltip({
                    x: event.clientX - bounds.left,
                    y: event.clientY - bounds.top,
                    lines: [
                      item.label,
                      `Ingresos: ${formatCurrencyFromCents(item.ingresosCentavos)}`,
                      `Egresos: ${formatCurrencyFromCents(item.egresosCentavos)}`,
                    ],
                  });
                }}
              />
              <text
                x={x}
                y={height - 6}
                textAnchor="middle"
                fontSize="11"
                fill="var(--muted-foreground)"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HorizontalBarChart({
  items,
}: {
  items: AdminDashboardCodeStatusItemDto[];
}) {
  const [tooltip, setTooltip] = useState<ChartTooltipState | null>(null);
  const maxValue = Math.max(...items.map((item) => item.total), 0);

  if (maxValue === 0) {
    return <EmptyChart label="No hay codigos para el año seleccionado." />;
  }

  return (
    <div className="relative space-y-4" onMouseLeave={() => setTooltip(null)}>
      <ChartTooltip tooltip={tooltip} />
      <div className="space-y-4">
        {items.map((item) => {
          const width = `${(item.total / maxValue) * 100}%`;

          return (
            <div key={item.status} className="grid gap-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="inline-flex items-center gap-2 font-medium">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: statusChartColors[item.status] }}
                  />
                  {item.label}
                </span>
                <span className="text-muted-foreground">{item.total}</span>
              </div>
              <div className="h-4 rounded-full bg-muted/60">
                <div
                  className="h-4 cursor-pointer rounded-full transition-opacity hover:opacity-85"
                  style={{
                    width,
                    backgroundColor: statusChartColors[item.status],
                  }}
                  onMouseMove={(event) => {
                    const bounds = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();

                    if (!bounds) {
                      return;
                    }

                    setTooltip({
                      x: event.clientX - bounds.left,
                      y: event.clientY - bounds.top,
                      lines: [item.label, `${item.total} codigos`],
                    });
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [year, setYear] = useState(getCurrentYearValue());
  const [month, setMonth] = useState(getCurrentMonthValue());
  const [data, setData] = useState<AdminDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (nextYear?: string, nextMonth?: string) => {
    setLoading(true);
    setError("");

    try {
      const targetYear = nextYear ?? year;
      const targetMonth = nextMonth ?? month;
      const params = new URLSearchParams({
        year: targetYear,
        month: targetMonth,
      });
      const response = await fetch(`/api/dashboard/admin?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as AdminDashboardPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar el dashboard");
      }

      setData(payload.data);
      setYear(String(payload.data.year));
      setMonth(payload.data.month);
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
  }, []);

  const availableYears = useMemo(
    () => data?.availableYears.map((item) => String(item)) ?? [year],
    [data, year],
  );
  const availableMonths = useMemo(
    () => data?.availableMonths ?? [month],
    [data, month],
  );

  if (loading && !data) {
    return <LoadingState label="Cargando indicadores del sistema..." />;
  }

  if (error && !data) {
    return <ErrorState label={error} retry={() => void load()} />;
  }

  if (!data) {
    return <ErrorState label="No se pudo cargar el dashboard" retry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Tablero de indicadores administrativos del sistema."
      />

      <Card className="flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between">
        <div className="md:flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Vista anual
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Indicadores {data.year}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            El balance total siempre refleja el historico completo de movimientos.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="w-full md:w-44">
            <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Año
            </label>
            <Select
              value={year}
              onChange={(event) => {
                const nextYear = event.target.value;
                setYear(nextYear);
                void load(nextYear, month);
              }}
            >
              {availableYears.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full md:w-52">
            <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Mes odontologos
            </label>
            <Select
              value={month}
              onChange={(event) => {
                const nextMonth = event.target.value;
                setMonth(nextMonth);
                void load(year, nextMonth);
              }}
            >
              {availableMonths.map((item) => (
                <option key={item} value={item}>
                  {formatMonthOption(item)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {error ? <ErrorState label={error} retry={() => void load()} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Pacientes activos"
          value={String(data.summary.pacientesActivos)}
        />
        <SummaryCard
          label="Odontologos activos"
          value={String(data.summary.odontologosActivos)}
        />
        <SummaryCard
          label="Balance total en pesos"
          value={formatCurrencyFromCents(data.summary.balanceTotalCentavos)}
          tone={data.summary.balanceTotalCentavos >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartShell
          title="Pacientes por obra social"
          description="Distribucion actual de pacientes activos segun su cobertura."
        >
          <PieChart
            items={data.patientsByObraSocial}
            unitFormatter={(value) => String(value)}
          />
        </ChartShell>

        <ChartShell
          title="Atenciones anualizadas"
          description="Cantidad de atenciones registradas por mes en el año seleccionado."
        >
          <BarChart
            items={data.attentionsByMonth}
            valueFormatter={(value) => String(value)}
          />
        </ChartShell>

        <ChartShell
          title="RX realizadas"
          description="Cantidad de estudios RX registrados por mes en el año seleccionado."
        >
          <BarChart
            items={data.rxByMonth}
            valueFormatter={(value) => String(value)}
          />
        </ChartShell>

        <ChartShell
          title="Ingresos vs egresos anualizados"
          description="Comparacion mensual de movimientos de ingreso y egreso."
        >
          <LineChart items={data.movementsByMonth} />
        </ChartShell>

        <ChartShell
          title="Codigos por estado"
          description="Distribucion anual de lineas de codigos segun su estado de auditoria."
        >
          <HorizontalBarChart items={data.codesByStatus} />
        </ChartShell>

        <ChartShell
          title="Odontologos por codigos del mes"
          description={`Comparacion mensual de codigos por odontologo, segmentados por estado para ${formatMonthOption(data.month)}.`}
        >
          <DentistPerformanceChart items={data.dentistPerformanceByMonth} />
        </ChartShell>

        <ChartShell
          title="Ingresos por tipo de movimiento"
          description="Distribucion anual de ingresos segun el tipo de movimiento."
        >
          <PieChart
            items={data.incomeByMovementType}
            unitFormatter={(value) => formatCurrencyFromCents(value)}
          />
        </ChartShell>

        <ChartShell
          title="Egresos por tipo de movimiento"
          description="Distribucion anual de egresos segun el tipo de movimiento."
        >
          <PieChart
            items={data.expenseByMovementType}
            unitFormatter={(value) => formatCurrencyFromCents(value)}
          />
        </ChartShell>
      </div>
    </div>
  );
}

function DentistPerformanceChart({
  items,
}: {
  items: AdminDashboardDto["dentistPerformanceByMonth"];
}) {
  const [tooltip, setTooltip] = useState<ChartTooltipState | null>(null);
  const maxValue = Math.max(...items.map((item) => item.total), 0);

  if (maxValue === 0 || items.length === 0) {
    return <EmptyChart label="No hay codigos cargados para el mes seleccionado." />;
  }

  return (
    <div className="relative space-y-4" onMouseLeave={() => setTooltip(null)}>
      <ChartTooltip tooltip={tooltip} />
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(statusChartColors).map(([status, color]) => (
          <span key={status} className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            {items[0]?.statuses.find((item) => item.status === status)?.label ?? status}
          </span>
        ))}
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.userId} className="grid gap-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="truncate font-medium">{item.nombreCompleto}</span>
              <span className="whitespace-nowrap text-muted-foreground">
                {item.total} codigos
              </span>
            </div>
            <div className="flex h-5 overflow-hidden rounded-full bg-muted/60">
              {item.statuses
                .filter((statusItem) => statusItem.total > 0)
                .map((statusItem) => (
                  <div
                    key={`${item.userId}-${statusItem.status}`}
                    className="h-full cursor-pointer transition-opacity hover:opacity-85"
                    style={{
                      width: `${(statusItem.total / maxValue) * 100}%`,
                      backgroundColor: statusChartColors[statusItem.status],
                    }}
                    onMouseMove={(event) => {
                      const bounds = event.currentTarget.parentElement?.parentElement?.parentElement?.getBoundingClientRect();

                      if (!bounds) {
                        return;
                      }

                      setTooltip({
                        x: event.clientX - bounds.left,
                        y: event.clientY - bounds.top,
                        lines: [
                          item.nombreCompleto,
                          `${statusItem.label}: ${statusItem.total} codigos`,
                          `Total del mes: ${item.total} codigos`,
                        ],
                      });
                    }}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
