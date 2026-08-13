"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  isPaymentMovementMetadata,
  movementDirectionLabels,
  movementOriginLabels,
} from "@/lib/movement";
import {
  formatCurrencyFromCents,
  formatDate,
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
  MercadoPagoSyncDto,
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

type UpdatePayload = {
  success: boolean;
  data: MovementDto;
  error?: { message?: string; fields?: Record<string, string> };
};

type MercadoPagoSyncTriggerPayload = {
  success: boolean;
  data?: {
    created: boolean;
  };
  error?: { message?: string };
};

type MercadoPagoSyncsPayload = {
  success: boolean;
  data: MercadoPagoSyncDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
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

function formatSignedMovementAmount(item: MovementDto) {
  const formatted = formatCurrencyFromCents(item.montoCentavos);

  if (item.direccion === "egreso") {
    return `-${formatted}`;
  }

  return formatted;
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncSubmitting, setSyncSubmitting] = useState(false);
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
  const [selectedMovement, setSelectedMovement] = useState<MovementDto | null>(null);
  const [editForm, setEditForm] = useState({
    movementTypeId: "",
    descripcion: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [latestMercadoPagoSync, setLatestMercadoPagoSync] = useState<MercadoPagoSyncDto | null>(
    null,
  );

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

  const editableTypeOptions = useMemo(() => {
    if (!selectedMovement) {
      return activeMovementTypes;
    }

    return activeMovementTypes.filter(
      (item) => item.direccion === selectedMovement.direccion,
    );
  }, [activeMovementTypes, selectedMovement]);

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

  const loadLatestMercadoPagoSync = async () => {
    const response = await fetch("/api/mercadopago/syncs?limit=5", {
      cache: "no-store",
    });
    const payload = (await response.json()) as MercadoPagoSyncsPayload;

    if (!response.ok || !payload.success) {
      throw new Error(
        payload.error?.message || "No se pudo cargar el estado de sincronizacion",
      );
    }

    const latestRelevantSync =
      payload.data.find((item) => item.status === "PROCESSED") ?? payload.data[0] ?? null;

    setLatestMercadoPagoSync(latestRelevantSync);
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
    await Promise.all([loadMovementTypes(), load(), loadLatestMercadoPagoSync()]);
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

  const openEdit = (movement: MovementDto) => {
    setSelectedMovement(movement);
    setEditForm({
      movementTypeId: movement.tipoMovimientoId ?? "",
      descripcion: movement.descripcion ?? "",
    });
    setEditError("");
    setEditFields({});
    setEditDialogOpen(true);
  };

  const submitMovementEdit = async () => {
    if (!selectedMovement) {
      return;
    }

    setEditSubmitting(true);
    setEditError("");
    setEditFields({});
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/movimientos/${selectedMovement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementTypeId: editForm.movementTypeId,
          descripcion: editForm.descripcion,
        }),
      });
      const payload = (await response.json()) as UpdatePayload;

      if (!response.ok || !payload.success) {
        setEditFields(payload.error?.fields ?? {});
        throw new Error(payload.error?.message || "No se pudo editar el movimiento");
      }

      setEditDialogOpen(false);
      setSelectedMovement(null);
      setSuccessMessage("El movimiento se actualizo correctamente.");
      await load();
    } catch (updateError) {
      setEditError(updateError instanceof Error ? updateError.message : "Error inesperado");
    } finally {
      setEditSubmitting(false);
    }
  };

  const triggerMercadoPagoSync = async () => {
    setSyncSubmitting(true);
    setSuccessMessage("");
    setError("");

    try {
      const response = await fetch("/api/mercadopago/sync", {
        method: "POST",
      });
      const payload = (await response.json()) as MercadoPagoSyncTriggerPayload;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error?.message || "No se pudo iniciar la sincronizacion de Mercado Pago",
        );
      }

      setSuccessMessage(
        payload.data?.created
          ? "Se inicio la sincronizacion manual de Mercado Pago."
          : "Ya existe una sincronizacion reciente de Mercado Pago en curso.",
      );
      await Promise.all([load(), loadLatestMercadoPagoSync()]);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Error inesperado");
    } finally {
      setSyncSubmitting(false);
    }
  };

  const latestSyncLabel = latestMercadoPagoSync
    ? formatDate(latestMercadoPagoSync.processedAt ?? latestMercadoPagoSync.updatedAt)
    : "Sin sincronizaciones";
  const latestSyncStatusLabel =
    latestMercadoPagoSync?.status === "PROCESSED"
      ? "Correcta"
      : latestMercadoPagoSync?.status === "FAILED"
        ? "Con error"
        : latestMercadoPagoSync
          ? "En proceso"
          : "Sin datos";
  const latestSyncDotClass =
    latestMercadoPagoSync?.status === "PROCESSED"
      ? "bg-emerald-500"
      : latestMercadoPagoSync?.status === "FAILED"
        ? "bg-rose-500"
        : latestMercadoPagoSync
          ? "bg-amber-500"
          : "bg-muted-foreground/30";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Movimientos"
        description="Libro contable operativo de ingresos y egresos de la clinica."
        actionLabel="Nuevo movimiento"
        onAction={openCreate}
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => void triggerMercadoPagoSync()}
            disabled={syncSubmitting}
            title="Forzar sincronizacion de Mercado Pago"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${syncSubmitting ? "animate-spin" : ""}`}
            />
            {syncSubmitting ? "Sincronizando..." : "Forzar sync"}
          </Button>
        }
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

      <Card className="grid items-center gap-2 p-3 xl:grid-cols-[150px_150px_180px_220px_180px_minmax(240px,1fr)]">
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
        <div className="flex min-h-10 items-center justify-start rounded-md border border-border px-3 xl:justify-end">
          <div className="flex items-center gap-3 whitespace-nowrap text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${latestSyncDotClass}`} />
            <p className="text-left text-sm text-foreground xl:text-right">
              <span className="font-medium">Ultima sync Mercado Pago:</span> {latestSyncLabel}
              <span className="ml-2 text-muted-foreground">• {latestSyncStatusLabel}</span>
            </p>
          </div>
        </div>
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
                <col className="w-[260px]" />
                <col />
              <col className="w-[140px]" />
              <col className="w-[190px]" />
              <col className="w-[120px]" />
              </colgroup>
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Tipo</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Concepto</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Descripcion</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-muted-foreground">Monto</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Origen</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Accion</th>
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
                      {isPaymentMovementMetadata(item.metadata) ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.metadata.usuarioNombreSnapshot} - {item.metadata.attentionMonth}
                        </p>
                      ) : null}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium tabular-nums ${
                        item.direccion === "ingreso" ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatSignedMovementAmount(item)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="muted" className="inline-flex whitespace-nowrap">
                        {movementOriginLabels[item.origenTipo]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(item)}
                      >
                        Editar
                      </Button>
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

      <Dialog
        open={editDialogOpen}
        onClose={() => {
          if (!editSubmitting) {
            setEditDialogOpen(false);
            setSelectedMovement(null);
          }
        }}
        title="Editar movimiento"
        description="Actualiza el concepto y la descripcion del movimiento."
      >
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Concepto</label>
            <Select
              value={editForm.movementTypeId}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  movementTypeId: event.target.value,
                }))
              }
            >
              <option value="">Selecciona un concepto</option>
              {editableTypeOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </Select>
            {editFields.movementTypeId ? (
              <p className="mt-1 text-xs text-rose-700">{editFields.movementTypeId}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Descripcion</label>
            <Input
              value={editForm.descripcion}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  descripcion: event.target.value,
                }))
              }
            />
            {editFields.descripcion ? (
              <p className="mt-1 text-xs text-rose-700">{editFields.descripcion}</p>
            ) : null}
          </div>
        </div>

        {editError ? (
          <Card className="mt-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            {editError}
          </Card>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditDialogOpen(false);
              setSelectedMovement(null);
            }}
            disabled={editSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void submitMovementEdit()}
            disabled={editSubmitting}
          >
            {editSubmitting ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
