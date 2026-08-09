"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  movementDirectionLabels,
  movementOriginLabels,
} from "@/lib/movement";
import {
  formatCurrencyFromCents,
  formatDateOnly,
  formatMoneyInputFromCents,
  formatMoneyMaskedInput,
  getTodayDateOnly,
  parseMoneyInputToCents,
} from "@/lib/utils";
import {
  MovementCreateDto,
  MovementDirection,
  MovementDto,
  MovementTypeDto,
  movementDirectionValues,
  movementOriginTypeValues,
} from "@/types/domain";

type ListPayload = {
  success: boolean;
  data: MovementDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: {
    ingresosCentavos: number;
    egresosCentavos: number;
    saldoCentavos: number;
  };
  error?: { message?: string; fields?: Record<string, string> };
};

type MovementTypesPayload = {
  success: boolean;
  data: MovementTypeDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
};

type CreatePayload = {
  success: boolean;
  data: MovementDto;
  error?: { message?: string; fields?: Record<string, string> };
};

type FormState = MovementCreateDto & {
  direction: MovementDirection;
};

function MovementDirectionIcon({ direction }: { direction: MovementDirection }) {
  if (direction === "ingreso") {
    return <TrendingUp className="h-4 w-4 text-emerald-700" strokeWidth={2.5} />;
  }

  return <TrendingDown className="h-4 w-4 text-rose-700" strokeWidth={2.5} />;
}

export function MovimientosManager() {
  const [items, setItems] = useState<MovementDto[]>([]);
  const [movementTypes, setMovementTypes] = useState<MovementTypeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [direction, setDirection] = useState("");
  const [typeId, setTypeId] = useState("");
  const [originType, setOriginType] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [summary, setSummary] = useState<ListPayload["summary"]>({
    ingresosCentavos: 0,
    egresosCentavos: 0,
    saldoCentavos: 0,
  });
  const [form, setForm] = useState<FormState>({
    fecha: getTodayDateOnly(),
    descripcion: "",
    movementTypeId: "",
    montoCentavos: 0,
    direction: "egreso",
  });
  const [amountInput, setAmountInput] = useState("");
  const [formError, setFormError] = useState("");
  const [formFields, setFormFields] = useState<Record<string, string>>({});

  const activeMovementTypes = useMemo(
    () => movementTypes.filter((item) => item.activo),
    [movementTypes],
  );

  const filteredMovementTypes = useMemo(() => {
    if (!direction) {
      return activeMovementTypes;
    }

    return activeMovementTypes.filter((item) => item.direccion === direction);
  }, [activeMovementTypes, direction]);

  const manualDirectionTypes = useMemo(
    () => activeMovementTypes.filter((item) => item.direccion === form.direction),
    [activeMovementTypes, form.direction],
  );

  const loadMovementTypes = async () => {
    setLookupsLoading(true);

    try {
      const response = await fetch("/api/tipos-movimientos?status=active&limit=100", {
        cache: "no-store",
      });
      const payload = (await response.json()) as MovementTypesPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudieron cargar los tipos");
      }

      setMovementTypes(payload.data);
    } finally {
      setLookupsLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });

      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (direction) params.set("direction", direction);
      if (typeId) params.set("type", typeId);
      if (originType) params.set("originType", originType);

      const response = await fetch(`/api/movimientos?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ListPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar el listado");
      }

      setItems(payload.data);
      setTotalPages(payload.pagination.totalPages);
      setSummary(payload.summary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const loadFromEffect = useEffectEvent(async () => {
    await loadMovementTypes();
    await load();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [page, dateFrom, dateTo, direction, typeId, originType]);

  const resetForm = () => {
    const defaultDirection: MovementDirection = "egreso";
    const defaultType =
      activeMovementTypes.find((item) => item.direccion === defaultDirection)?.id ?? "";

    setForm({
      fecha: getTodayDateOnly(),
      descripcion: "",
      movementTypeId: defaultType,
      montoCentavos: 0,
      direction: defaultDirection,
    });
    setAmountInput("");
    setFormError("");
    setFormFields({});
  };

  const submitManualMovement = async () => {
    setSubmitting(true);
    setFormError("");
    setFormFields({});
    setSuccessMessage("");

    const montoCentavos = parseMoneyInputToCents(amountInput);

    if (!montoCentavos || montoCentavos < 1) {
      setFormFields({ montoCentavos: "El monto debe ser mayor que cero" });
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: form.fecha,
          descripcion: form.descripcion,
          movementTypeId: form.movementTypeId,
          montoCentavos,
        } satisfies MovementCreateDto),
      });
      const payload = (await response.json()) as CreatePayload;

      if (!response.ok || !payload.success) {
        setFormFields(payload.error?.fields ?? {});
        throw new Error(payload.error?.message || "No se pudo crear el movimiento");
      }

      setDialogOpen(false);
      resetForm();
      setSuccessMessage("El movimiento manual se registro correctamente.");
      await load();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Movimientos"
        description="Libro contable operativo de ingresos y egresos de la clinica."
        actionLabel="Nuevo movimiento"
        onAction={openCreate}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Total ingresos
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-700">
            {formatCurrencyFromCents(summary.ingresosCentavos)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Total egresos
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-rose-700">
            {formatCurrencyFromCents(summary.egresosCentavos)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Totalizador
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">
            {formatCurrencyFromCents(summary.saldoCentavos)}
          </p>
        </Card>
      </div>

      <Card className="grid gap-2 p-3 xl:grid-cols-[150px_150px_180px_220px_180px]">
        <Input
          className="h-10"
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setPage(1);
            setDateFrom(event.target.value);
          }}
        />
        <Input
          className="h-10"
          type="date"
          value={dateTo}
          onChange={(event) => {
            setPage(1);
            setDateTo(event.target.value);
          }}
        />
        <Select
          className="h-10"
          value={direction}
          onChange={(event) => {
            setPage(1);
            setDirection(event.target.value);
            setTypeId("");
          }}
        >
          <option value="">Todas las direcciones</option>
          {movementDirectionValues.map((item) => (
            <option key={item} value={item}>
              {movementDirectionLabels[item]}
            </option>
          ))}
        </Select>
        <Select
          className="h-10"
          value={typeId}
          onChange={(event) => {
            setPage(1);
            setTypeId(event.target.value);
          }}
        >
          <option value="">Todos los tipos</option>
          {filteredMovementTypes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nombre}
            </option>
          ))}
        </Select>
        <Select
          className="h-10"
          value={originType}
          onChange={(event) => {
            setPage(1);
            setOriginType(event.target.value);
          }}
        >
          <option value="">Todos los origenes</option>
          {movementOriginTypeValues.map((item) => (
            <option key={item} value={item}>
              {movementOriginLabels[item]}
            </option>
          ))}
        </Select>
      </Card>

      {successMessage ? (
        <Card className="border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {successMessage}
        </Card>
      ) : null}

      {loading || lookupsLoading ? <LoadingState label="Cargando movimientos..." /> : null}
      {!loading && !lookupsLoading && error ? <ErrorState label={error} retry={load} /> : null}
      {!loading && !lookupsLoading && !error && items.length === 0 ? (
        <EmptyState label="No hay movimientos para los filtros seleccionados." />
      ) : null}

      {!loading && !lookupsLoading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed text-sm">
              <colgroup>
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[190px]" />
                <col />
                <col className="w-[140px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
              </colgroup>
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Tipo</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Concepto</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Descripcion</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-muted-foreground">Monto</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Origen</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-3 py-2">{formatDateOnly(item.fecha)}</td>
                    <td className="px-3 py-2">
                      <div
                        className="inline-flex h-8 w-8 items-center justify-center border border-border bg-card"
                        title={movementDirectionLabels[item.direccion]}
                      >
                        <MovementDirectionIcon direction={item.direccion} />
                      </div>
                    </td>
                    <td className="px-3 py-2">{item.tipo}</td>
                    <td className="px-3 py-2">
                      <p>{item.descripcion}</p>
                      {item.metadata?.usuarioNombreSnapshot ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.metadata.usuarioNombreSnapshot} - {item.metadata.attentionMonth}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatCurrencyFromCents(item.montoCentavos)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="muted">{movementOriginLabels[item.origenTipo]}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={item.creadoAutomaticamente ? "muted" : "default"}>
                        {item.creadoAutomaticamente ? "Bloqueado" : "Manual"}
                      </Badge>
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
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (!submitting) {
            setDialogOpen(false);
          }
        }}
        title="Nuevo movimiento"
        description="Carga manual de un movimiento contable no ligado a otros modulos."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Fecha</label>
            <Input
              type="date"
              value={form.fecha}
              onChange={(event) =>
                setForm((current) => ({ ...current, fecha: event.target.value }))
              }
            />
            {formFields.fecha ? (
              <p className="mt-1 text-xs text-rose-700">{formFields.fecha}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Direccion</label>
            <Select
              value={form.direction}
              onChange={(event) => {
                const nextDirection = event.target.value as MovementDirection;
                const nextType =
                  activeMovementTypes.find((item) => item.direccion === nextDirection)?.id ?? "";

                setForm((current) => ({
                  ...current,
                  direction: nextDirection,
                  movementTypeId: nextType,
                }));
              }}
            >
              {movementDirectionValues.map((item) => (
                <option key={item} value={item}>
                  {movementDirectionLabels[item]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tipo de movimiento</label>
            <Select
              value={form.movementTypeId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  movementTypeId: event.target.value,
                }))
              }
            >
              <option value="">Selecciona un tipo</option>
              {manualDirectionTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </Select>
            {formFields.movementTypeId ? (
              <p className="mt-1 text-xs text-rose-700">{formFields.movementTypeId}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Monto</label>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={amountInput}
              onChange={(event) => {
                setAmountInput(formatMoneyMaskedInput(event.target.value));
              }}
              onBlur={() => {
                const parsed = parseMoneyInputToCents(amountInput);

                if (parsed === null) {
                  setAmountInput("");
                  return;
                }

                setAmountInput(formatMoneyInputFromCents(parsed));
              }}
            />
            {formFields.montoCentavos ? (
              <p className="mt-1 text-xs text-rose-700">{formFields.montoCentavos}</p>
            ) : null}
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Descripcion</label>
            <Input
              value={form.descripcion ?? ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, descripcion: event.target.value }))
              }
            />
            {formFields.descripcion ? (
              <p className="mt-1 text-xs text-rose-700">{formFields.descripcion}</p>
            ) : null}
          </div>
        </div>

        {formError ? (
          <Card className="mt-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            {formError}
          </Card>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDialogOpen(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submitManualMovement()} disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar movimiento"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
