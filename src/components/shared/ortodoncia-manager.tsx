"use client";

import type { z } from "zod";
import { useEffect, useEffectEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  formatCurrencyFromCents,
  formatDateOnly,
  formatMoneyInputFromCents,
  formatMoneyMaskedInput,
  getTodayDateOnly,
  parseMoneyInputToCents,
} from "@/lib/utils";
import {
  orthodonticPaymentSchema,
  orthodonticTreatmentSchema,
} from "@/lib/validations/schemas";
import {
  OrthodonticPaymentDto,
  OrthodonticTreatmentDto,
  OrthodonticTreatmentStatus,
  OrthodonticTreatmentType,
} from "@/types/domain";

type TreatmentFormValues = z.input<typeof orthodonticTreatmentSchema>;
type TreatmentSubmitValues = z.output<typeof orthodonticTreatmentSchema>;
type PaymentFormValues = z.input<typeof orthodonticPaymentSchema>;
type PaymentSubmitValues = z.output<typeof orthodonticPaymentSchema>;

type ListPayload = {
  success: boolean;
  data: OrthodonticTreatmentDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
};

type TreatmentPayload = {
  success: boolean;
  data: OrthodonticTreatmentDto;
  error?: { message?: string };
};

type LookupPayload = {
  success: boolean;
  data: {
    paciente: {
      id: string;
      nombre: string;
      apellido: string;
      dni: string;
      obraSocialId: string | null;
      obraSocialNombre: string | null;
    } | null;
    ortodoncistas: Array<{ id: string; label: string }>;
  };
  error?: { message?: string };
};

const treatmentTypeLabels: Record<OrthodonticTreatmentType, string> = {
  "damon-q": "DAMON Q",
  "arco-recto": "ARCO RECTO",
  "damon-ultimate": "DAMON ULTIMATE",
  "a-ligable-nac": "A. LIGABLE NAC",
};

const treatmentStatusLabels: Record<OrthodonticTreatmentStatus, string> = {
  activo: "Activo",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

function getEmptyTreatmentValues(
  orthodontistId: string,
): TreatmentFormValues {
  return {
    fechaInicio: getTodayDateOnly(),
    pacienteId: "",
    paciente: {
      nombre: "",
      apellido: "",
      dni: "",
      obraSocialId: "",
    },
    usuarioOrtodoncistaId: orthodontistId,
    tratamientoTipo: "damon-q",
    valorTratamientoCentavos: 0,
    valorMaterialesCentavos: 0,
    estado: "activo",
  };
}

function getEmptyPaymentValues(): PaymentFormValues {
  return {
    fecha: getTodayDateOnly(),
    montoCentavos: 0,
    porcentajeOrtodoncista: 0,
  };
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Card className="p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </Card>
  );
}

export function OrtodonciaManager({
  currentUserId,
  isAdmin,
}: {
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [items, setItems] = useState<OrthodonticTreatmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selected, setSelected] = useState<OrthodonticTreatmentDto | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<OrthodonticPaymentDto | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<OrthodonticPaymentDto | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [patientLookupDni, setPatientLookupDni] = useState("");
  const [patientLookupLoading, setPatientLookupLoading] = useState(false);
  const [patientLookupError, setPatientLookupError] = useState("");
  const [matchedPatient, setMatchedPatient] = useState<LookupPayload["data"]["paciente"]>(null);
  const [ortodoncistas, setOrtodontistas] = useState<LookupPayload["data"]["ortodoncistas"]>([]);
  const [valorTratamientoInput, setValorTratamientoInput] = useState("");
  const [valorMaterialesInput, setValorMaterialesInput] = useState("");
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const treatmentForm = useForm<
    TreatmentFormValues,
    unknown,
    TreatmentSubmitValues
  >({
    resolver: zodResolver(orthodonticTreatmentSchema),
    defaultValues: getEmptyTreatmentValues(currentUserId),
  });
  const paymentForm = useForm<PaymentFormValues, unknown, PaymentSubmitValues>({
    resolver: zodResolver(orthodonticPaymentSchema),
    defaultValues: getEmptyPaymentValues(),
  });

  const loadLookups = async (dni?: string) => {
    const query = dni ? `?dni=${encodeURIComponent(dni)}` : "";
    const response = await fetch(`/api/ortodoncia/lookups${query}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as LookupPayload;

    if (!response.ok || !payload.success) {
      throw new Error(payload.error?.message || "No se pudieron cargar los datos");
    }

    setOrtodontistas(payload.data.ortodoncistas);
    return payload.data;
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
      if (statusFilter) params.set("orthodonticTreatmentStatus", statusFilter);
      if (userId) params.set("userId", userId);

      const response = await fetch(`/api/ortodoncia?${params.toString()}`, {
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

  const bootstrap = useEffectEvent(async () => {
    await loadLookups();
    await load();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void bootstrap();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [page, search, dateFrom, dateTo, statusFilter, userId]);

  const openCreate = () => {
    const defaultOrthodontistId = isAdmin
      ? ortodoncistas[0]?.id ?? ""
      : currentUserId;
    setSelected(null);
    setSelectedPayment(null);
    treatmentForm.reset(getEmptyTreatmentValues(defaultOrthodontistId));
    paymentForm.reset(getEmptyPaymentValues());
    setMatchedPatient(null);
    setPatientLookupDni("");
    setPatientLookupError("");
    setValorTratamientoInput("");
    setValorMaterialesInput("");
    setDialogOpen(true);
  };

  const openEdit = (item: OrthodonticTreatmentDto) => {
    setSelected(item);
    setSelectedPayment(null);
    treatmentForm.reset({
      fechaInicio: item.fechaInicio.slice(0, 10),
      pacienteId: item.pacienteId,
      paciente: undefined,
      usuarioOrtodoncistaId: item.usuarioOrtodoncistaId,
      tratamientoTipo: item.tratamientoTipo,
      valorTratamientoCentavos: item.valorTratamientoCentavos,
      valorMaterialesCentavos: item.valorMaterialesCentavos,
      estado: item.estado,
    });
    paymentForm.reset(getEmptyPaymentValues());
    setMatchedPatient({
      id: item.pacienteId,
      nombre: item.pacienteNombreCompleto.split(", ")[1] ?? "",
      apellido: item.pacienteNombreCompleto.split(", ")[0] ?? "",
      dni: item.pacienteDni,
      obraSocialId: null,
      obraSocialNombre: null,
    });
    setPatientLookupDni(item.pacienteDni);
    setPatientLookupError("");
    setValorTratamientoInput(formatMoneyInputFromCents(item.valorTratamientoCentavos));
    setValorMaterialesInput(formatMoneyInputFromCents(item.valorMaterialesCentavos));
    setDialogOpen(true);
  };

  const refreshSelectedFromPayload = (payload: TreatmentPayload) => {
    setSelected(payload.data);
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.id === payload.data.id);

      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = payload.data;
        return next;
      }

      return [payload.data, ...current];
    });
  };

  const searchPatientByDni = async () => {
    const dni = patientLookupDni.trim();

    if (!dni) {
      setPatientLookupError("Ingresa un DNI para buscar");
      return;
    }

    setPatientLookupLoading(true);
    setPatientLookupError("");

    try {
      const data = await loadLookups(dni);
      setMatchedPatient(data.paciente);

      if (data.paciente) {
        treatmentForm.setValue("pacienteId", data.paciente.id);
        treatmentForm.setValue("paciente", undefined);
      } else {
        treatmentForm.setValue("pacienteId", "");
        treatmentForm.setValue("paciente", {
          nombre: "",
          apellido: "",
          dni,
          obraSocialId: "",
        });
        treatmentForm.setValue("paciente.dni", dni);
      }
    } catch (lookupError) {
      setPatientLookupError(
        lookupError instanceof Error ? lookupError.message : "No se pudo buscar el paciente",
      );
    } finally {
      setPatientLookupLoading(false);
    }
  };

  const submitTreatment = treatmentForm.handleSubmit(async (values) => {
    const body: TreatmentSubmitValues = {
      ...values,
      valorTratamientoCentavos: values.valorTratamientoCentavos ?? 0,
      valorMaterialesCentavos: values.valorMaterialesCentavos ?? 0,
    };

    if (body.pacienteId) {
      body.paciente = undefined;
    }

    const response = await fetch(
      selected ? `/api/ortodoncia/${selected.id}` : "/api/ortodoncia",
      {
        method: selected ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload = (await response.json()) as TreatmentPayload;

    if (!response.ok || !payload.success) {
      treatmentForm.setError("root", {
        message: payload.error?.message || "No se pudo guardar el tratamiento",
      });
      return;
    }

    refreshSelectedFromPayload(payload);
    setDialogOpen(false);
    await load();
  });

  const openNewPayment = () => {
    setSelectedPayment(null);
    paymentForm.reset(getEmptyPaymentValues());
    setPaymentAmountInput("");
    setPaymentDialogOpen(true);
  };

  const openEditPayment = (payment: OrthodonticPaymentDto) => {
    setSelectedPayment(payment);
    paymentForm.reset({
      fecha: payment.fecha.slice(0, 10),
      montoCentavos: payment.montoCentavos,
      porcentajeOrtodoncista: payment.porcentajeOrtodoncista,
    });
    setPaymentAmountInput(formatMoneyInputFromCents(payment.montoCentavos));
    setPaymentDialogOpen(true);
  };

  const submitPayment = paymentForm.handleSubmit(async (values) => {
    if (!selected) {
      return;
    }

    const url = selectedPayment
      ? `/api/ortodoncia/${selected.id}/payments/${selectedPayment.id}`
      : `/api/ortodoncia/${selected.id}/payments`;
    const method = selectedPayment ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as TreatmentPayload;

    if (!response.ok || !payload.success) {
      paymentForm.setError("root", {
        message: payload.error?.message || "No se pudo guardar el pago",
      });
      return;
    }

    refreshSelectedFromPayload(payload);
    setPaymentDialogOpen(false);
    await load();
  });

  const deletePayment = async () => {
    if (!selected || !paymentToDelete) {
      return;
    }

    setDeletingPayment(true);

    try {
      const response = await fetch(
        `/api/ortodoncia/${selected.id}/payments/${paymentToDelete.id}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as TreatmentPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo eliminar el pago");
      }

      refreshSelectedFromPayload(payload);
      setPaymentToDelete(null);
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el pago",
      );
    } finally {
      setDeletingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ortodoncia"
        description="Gestiona tratamientos de ortodoncia ya iniciados, sus pagos parciales y la liquidacion pendiente del profesional."
        actionLabel="Nuevo tratamiento"
        onAction={openCreate}
      />

      <Card
        className={`grid gap-3 p-4 ${
          isAdmin
            ? "xl:grid-cols-[1fr_180px_180px_180px_260px]"
            : "xl:grid-cols-[1fr_180px_180px_180px]"
        }`}
      >
        <Input
          placeholder="Buscar por paciente, DNI, sistema o ortodoncista"
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
          value={statusFilter}
          onChange={(event) => {
            setPage(1);
            setStatusFilter(event.target.value);
          }}
        >
          <option value="">Todos los estados</option>
          {Object.entries(treatmentStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
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
            <option value="">Todos los ortodoncistas</option>
            {ortodoncistas.map((user) => (
              <option key={user.id} value={user.id}>
                {user.label}
              </option>
            ))}
          </Select>
        ) : null}
      </Card>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState label={error} retry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState label="No hay tratamientos de ortodoncia para mostrar." />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-4 py-3">Inicio</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Sistema</th>
                  <th className="px-4 py-3 text-right">Presupuesto</th>
                  <th className="px-4 py-3 text-right">Pagado</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-right">% pagado</th>
                  <th className="px-4 py-3 text-right">Ortodoncista pendiente</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">{formatDateOnly(item.fechaInicio)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.pacienteNombreCompleto}</p>
                      <p className="text-muted-foreground">DNI: {item.pacienteDni}</p>
                      <p className="text-muted-foreground">{item.usuarioOrtodoncistaNombre}</p>
                    </td>
                    <td className="px-4 py-3">{treatmentTypeLabels[item.tratamientoTipo]}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrencyFromCents(item.totals.totalPresupuestadoCentavos)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrencyFromCents(item.totals.totalPagadoPacienteCentavos)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrencyFromCents(item.totals.saldoPacienteCentavos)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {item.totals.porcentajePagado.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrencyFromCents(item.totals.totalPendienteOrtodoncistaCentavos)}
                    </td>
                    <td className="px-4 py-3">{treatmentStatusLabels[item.estado]}</td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(item)}>
                        Ver detalle
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
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Anterior
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={selected ? "Editar tratamiento" : "Nuevo tratamiento"}
        description="Carga tratamientos de ortodoncia ya iniciados y controla los pagos del paciente."
        className="max-w-6xl"
      >
        <form className="space-y-6" onSubmit={submitTreatment}>
          <Card className="grid gap-4 p-4 md:grid-cols-[200px_1fr_auto]">
            <div className="md:col-span-3">
              <label className="mb-2 block text-sm font-medium">DNI del paciente</label>
              <div className="flex gap-2">
                <Input
                  value={patientLookupDni}
                  onChange={(event) => setPatientLookupDni(event.target.value)}
                  placeholder="Ingresa el DNI y busca"
                />
                <Button type="button" variant="secondary" onClick={() => void searchPatientByDni()} disabled={patientLookupLoading}>
                  {patientLookupLoading ? "Buscando..." : "Buscar paciente"}
                </Button>
              </div>
            </div>

            {matchedPatient ? (
              <div className="md:col-span-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium">{matchedPatient.apellido}, {matchedPatient.nombre}</p>
                <p className="text-muted-foreground">DNI: {matchedPatient.dni}</p>
              </div>
            ) : null}

            {patientLookupError ? (
              <p className="md:col-span-3 text-sm text-destructive">{patientLookupError}</p>
            ) : null}

            {!matchedPatient ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium">Nombre</label>
                  <Input {...treatmentForm.register("paciente.nombre")} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Apellido</label>
                  <Input {...treatmentForm.register("paciente.apellido")} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">DNI</label>
                  <Input {...treatmentForm.register("paciente.dni")} />
                </div>
              </>
            ) : null}
          </Card>

          <Card className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Fecha de inicio</label>
              <Input type="date" {...treatmentForm.register("fechaInicio")} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Sistema</label>
              <Select {...treatmentForm.register("tratamientoTipo")}>
                {Object.entries(treatmentTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Valor tratamiento</label>
              <Input
                value={valorTratamientoInput}
                onChange={(event) => {
                  const masked = formatMoneyMaskedInput(event.target.value);
                  setValorTratamientoInput(masked);
                  treatmentForm.setValue(
                    "valorTratamientoCentavos",
                    parseMoneyInputToCents(masked) ?? 0,
                  );
                }}
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Valor materiales</label>
              <Input
                value={valorMaterialesInput}
                onChange={(event) => {
                  const masked = formatMoneyMaskedInput(event.target.value);
                  setValorMaterialesInput(masked);
                  treatmentForm.setValue(
                    "valorMaterialesCentavos",
                    parseMoneyInputToCents(masked) ?? 0,
                  );
                }}
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Estado</label>
              <Select {...treatmentForm.register("estado")}>
                {Object.entries(treatmentStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Ortodoncista</label>
              <Select
                {...treatmentForm.register("usuarioOrtodoncistaId")}
                disabled={!isAdmin}
              >
                {ortodoncistas.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.label}
                  </option>
                ))}
              </Select>
            </div>
          </Card>

          {treatmentForm.formState.errors.root?.message ? (
            <p className="text-sm text-destructive">
              {treatmentForm.formState.errors.root.message}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cerrar
            </Button>
            <Button type="submit">{selected ? "Guardar cambios" : "Crear tratamiento"}</Button>
          </div>
        </form>

        {selected ? (
          <div className="mt-6 space-y-4 border-t border-border pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">Pagos del tratamiento</h3>
                <p className="text-sm text-muted-foreground">
                  Registra pagos parciales y controla el saldo del paciente.
                </p>
              </div>
              <Button type="button" onClick={openNewPayment}>
                Nuevo pago
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <StatCard
                label="Total tratamiento + materiales"
                value={formatCurrencyFromCents(selected.totals.totalPresupuestadoCentavos)}
              />
              <StatCard
                label="Total pagado paciente"
                value={formatCurrencyFromCents(selected.totals.totalPagadoPacienteCentavos)}
              />
              <StatCard
                label="Saldo paciente"
                value={formatCurrencyFromCents(selected.totals.saldoPacienteCentavos)}
              />
              <StatCard
                label="% pagado"
                value={`${selected.totals.porcentajePagado.toFixed(2)}%`}
              />
              <StatCard
                label="Total pendiente ortodoncista"
                value={formatCurrencyFromCents(selected.totals.totalPendienteOrtodoncistaCentavos)}
              />
              <StatCard
                label="Total pagado ortodoncista"
                value={formatCurrencyFromCents(selected.totals.totalPagadoOrtodoncistaCentavos)}
              />
            </div>

            {selected.payments.length === 0 ? (
              <EmptyState label="Todavia no hay pagos cargados para este tratamiento." />
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/70 text-left">
                      <tr>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2 text-right">Pago paciente</th>
                        <th className="px-3 py-2 text-right">% ortodoncista</th>
                        <th className="px-3 py-2 text-right">Monto ortodoncista</th>
                        <th className="px-3 py-2">Liquidacion</th>
                        <th className="px-3 py-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.payments.map((payment) => (
                        <tr key={payment.id} className="border-t border-border">
                          <td className="px-3 py-2">{formatDateOnly(payment.fecha)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCurrencyFromCents(payment.montoCentavos)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {payment.porcentajeOrtodoncista.toFixed(2)}%
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCurrencyFromCents(payment.montoOrtodoncistaCentavos)}
                          </td>
                          <td className="px-3 py-2">
                            {payment.paymentStatus === "pagado" ? "Pagado" : "Pendiente"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={payment.paymentStatus === "pagado"}
                                onClick={() => openEditPayment(payment)}
                              >
                                Editar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={payment.paymentStatus === "pagado"}
                                onClick={() => setPaymentToDelete(payment)}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        title={selectedPayment ? "Editar pago" : "Nuevo pago"}
        description="Cada pago calcula automaticamente el monto liquidable al ortodoncista."
      >
        <form className="space-y-4" onSubmit={submitPayment}>
          <div>
            <label className="mb-2 block text-sm font-medium">Fecha</label>
            <Input type="date" {...paymentForm.register("fecha")} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Monto pagado por el paciente</label>
            <Input
              value={paymentAmountInput}
              onChange={(event) => {
                const masked = formatMoneyMaskedInput(event.target.value);
                setPaymentAmountInput(masked);
                paymentForm.setValue("montoCentavos", parseMoneyInputToCents(masked) ?? 0);
              }}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">% para el ortodoncista</label>
            <Input type="number" min="0" max="100" step="0.01" {...paymentForm.register("porcentajeOrtodoncista")} />
          </div>
          {paymentForm.formState.errors.root?.message ? (
            <p className="text-sm text-destructive">
              {paymentForm.formState.errors.root.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{selectedPayment ? "Guardar pago" : "Agregar pago"}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(paymentToDelete)}
        title="Eliminar pago"
        description="Se eliminara este pago parcial del tratamiento. Solo es posible eliminar pagos que todavia no fueron liquidados."
        confirmLabel="Eliminar pago"
        confirmVariant="destructive"
        busy={deletingPayment}
        onConfirm={() => void deletePayment()}
        onClose={() => setPaymentToDelete(null)}
      />
    </div>
  );
}
