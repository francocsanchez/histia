"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { Check } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { attentionStatusLabels } from "@/lib/attention-status";
import { formatCurrencyFromCents, formatDateOnly } from "@/lib/utils";
import {
  attentionCodeStatusValues,
  PaymentCandidateLineDto,
  PaymentDto,
} from "@/types/domain";

type LookupPayload = {
  success: boolean;
  data: {
    users: Array<{
      id: string;
      label: string;
    }>;
    months: string[];
  };
  error?: { message?: string };
};

type CandidatePayload = {
  success: boolean;
  data: PaymentCandidateLineDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
};

type PaymentsPayload = {
  success: boolean;
  data: PaymentDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
};

type SelectionState = Record<
  string,
  {
    lineId: string;
    payCode: boolean;
    payCoseguroOdonto: boolean;
  }
>;

function getInitialSelection(lineId: string) {
  return {
    lineId,
    payCode: false,
    payCoseguroOdonto: false,
  };
}

function getPaymentCellClass(enabled: boolean) {
  return enabled ? "text-foreground" : "text-muted-foreground";
}

function formatTableDate(value: string) {
  return formatDateOnly(value);
}

export function PagosManager() {
  const [users, setUsers] = useState<LookupPayload["data"]["users"]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<PaymentCandidateLineDto[]>([]);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [selection, setSelection] = useState<SelectionState>({});
  const [candidateCache, setCandidateCache] = useState<Record<string, PaymentCandidateLineDto>>(
    {},
  );
  const [lookupLoading, setLookupLoading] = useState(true);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [attentionMonth, setAttentionMonth] = useState("");
  const [attentionStatus, setAttentionStatus] = useState("");
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidateTotalPages, setCandidateTotalPages] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentTotalPages, setPaymentTotalPages] = useState(1);
  const [successMessage, setSuccessMessage] = useState("");
  const [paymentDetailDialog, setPaymentDetailDialog] = useState<PaymentDto | null>(null);

  const loadLookups = async () => {
    setLookupLoading(true);

    try {
      const response = await fetch("/api/pagos/lookups", { cache: "no-store" });
      const payload = (await response.json()) as LookupPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudieron cargar los filtros");
      }

      setUsers(payload.data.users);
      setMonths(payload.data.months);
    } finally {
      setLookupLoading(false);
    }
  };

  const loadCandidates = async () => {
    setCandidatesLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(candidatePage),
        limit: "15",
      });

      if (userId) params.set("userId", userId);
      if (attentionMonth) params.set("attentionMonth", attentionMonth);
      if (attentionStatus) params.set("attentionStatus", attentionStatus);
      if (search) params.set("search", search);

      const response = await fetch(`/api/pagos/candidates?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as CandidatePayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudieron cargar los candidatos");
      }

      setCandidates(payload.data);
      setCandidateTotalPages(payload.pagination.totalPages);
      setCandidateCache((current) => {
        const next = { ...current };

        payload.data.forEach((line) => {
          next[line.lineId] = line;
        });

        return next;
      });
      setSelection((current) => {
        const next = { ...current };

        payload.data.forEach((line) => {
          const previous = current[line.lineId];

          next[line.lineId] = {
            lineId: line.lineId,
            payCode:
              line.canPayCode &&
              Boolean(previous?.payCode),
            payCoseguroOdonto:
              line.canPayCoseguroOdonto &&
              Boolean(previous?.payCoseguroOdonto),
          };
        });

        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      setCandidatesLoading(false);
    }
  };

  const loadPayments = async () => {
    setPaymentsLoading(true);
    setHistoryError("");

    try {
      const params = new URLSearchParams({
        page: String(paymentPage),
        limit: "10",
      });

      if (userId) params.set("userId", userId);
      if (attentionMonth) params.set("attentionMonth", attentionMonth);

      const response = await fetch(`/api/pagos?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as PaymentsPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar el historial");
      }

      setPayments(payload.data);
      setPaymentTotalPages(payload.pagination.totalPages);
    } catch (loadError) {
      setHistoryError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      setPaymentsLoading(false);
    }
  };

  const bootstrap = useEffectEvent(async () => {
    await loadLookups();
    await Promise.all([loadCandidates(), loadPayments()]);
  });

  const refreshData = useEffectEvent(async () => {
    await Promise.all([loadCandidates(), loadPayments()]);
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void bootstrap();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (lookupLoading) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void refreshData();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [lookupLoading, candidatePage, paymentPage, userId, attentionMonth, attentionStatus, search]);

  const selectedItems = useMemo(
    () =>
      Object.values(selection)
        .filter((line) => line.payCode || line.payCoseguroOdonto)
        .map(({ lineId, payCode, payCoseguroOdonto }) => ({
          lineId,
          payCode,
          payCoseguroOdonto,
        })),
    [selection],
  );

  const selectedSummary = useMemo(() => {
    return selectedItems.reduce(
      (acc, item) => {
        const line = candidateCache[item.lineId];

        if (!line) {
          return acc;
        }

        if (item.payCode) {
          acc.totalPagoCodigosCentavos += line.pagoOdontologoCentavos;
          acc.quantityConceptsPaid += 1;
        }

        if (item.payCoseguroOdonto) {
          acc.totalCoseguroOdontoCentavos += line.coseguroOdontoCentavos ?? 0;
          acc.quantityConceptsPaid += 1;
        }

        acc.totalHonorariosCentavos =
          acc.totalPagoCodigosCentavos + acc.totalCoseguroOdontoCentavos;

        return acc;
      },
      {
        totalPagoCodigosCentavos: 0,
        totalCoseguroOdontoCentavos: 0,
        totalHonorariosCentavos: 0,
        quantityConceptsPaid: 0,
      },
    );
  }, [candidateCache, selectedItems]);

  const selectedMonths = useMemo(
    () =>
      Array.from(
        new Set(
          selectedItems
            .map((item) => candidateCache[item.lineId])
            .filter((line): line is PaymentCandidateLineDto => Boolean(line))
            .map((line) => line.attentionMonth)
            .filter((month): month is string => Boolean(month)),
        ),
      ),
    [candidateCache, selectedItems],
  );

  const effectiveAttentionMonth =
    attentionMonth || (selectedMonths.length === 1 ? selectedMonths[0] : "");

  const hasMixedSelectedMonths =
    !attentionMonth && selectedItems.length > 0 && selectedMonths.length > 1;

  const toggleSelection = (
    line: PaymentCandidateLineDto,
    key: "payCode" | "payCoseguroOdonto",
    checked: boolean,
  ) => {
    const canToggle =
      (key === "payCode" ? line.canPayCode : line.canPayCoseguroOdonto);

    if (!canToggle) {
      return;
    }

    setSelection((current) => ({
      ...current,
      [line.lineId]: {
        ...(current[line.lineId] ?? getInitialSelection(line.lineId)),
        [key]: checked,
      },
    }));
  };

  const selectVisibleConcepts = (key: "payCode" | "payCoseguroOdonto") => {
    setSelection((current) => {
      const next = { ...current };

      candidates.forEach((line) => {
        const canToggle =
          key === "payCode" ? line.canPayCode : line.canPayCoseguroOdonto;

        if (!canToggle) {
          return;
        }

        next[line.lineId] = {
          ...(current[line.lineId] ?? getInitialSelection(line.lineId)),
          [key]: true,
        };
      });

      return next;
    });
  };

  const submitPayment = async () => {
    if (!userId || !effectiveAttentionMonth || selectedItems.length === 0) {
      return;
    }

    setSubmitting(true);
    setSuccessMessage("");
    setError("");

    try {
      const response = await fetch("/api/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          attentionMonth: effectiveAttentionMonth,
          selectedItems,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo generar el pago");
      }

      setSelection({});
      setCandidateCache({});
      setSuccessMessage("El pago se genero correctamente.");
      await Promise.all([loadCandidates(), loadPayments()]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  if (lookupLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pagos"
        description="Liquida honorarios odontologicos por concepto, separando codigo y coseguro odonto."
      />

      <Card className="grid gap-2 p-3 xl:grid-cols-[180px_180px_180px_1fr]">
        <Select
          className="h-10"
          value={userId}
          onChange={(event) => {
            setCandidatePage(1);
            setPaymentPage(1);
            setUserId(event.target.value);
          }}
        >
          <option value="">Todos los usuarios</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </Select>
        <Select
          className="h-10"
          value={attentionMonth}
          onChange={(event) => {
            setCandidatePage(1);
            setPaymentPage(1);
            setAttentionMonth(event.target.value);
          }}
        >
          <option value="">Todos los meses</option>
          {months.map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </Select>
        <Select
          className="h-10"
          value={attentionStatus}
          onChange={(event) => {
            setCandidatePage(1);
            setAttentionStatus(event.target.value);
          }}
        >
          <option value="">Todos los estados</option>
          {attentionCodeStatusValues.map((status) => (
            <option key={status} value={status}>
              {attentionStatusLabels[status]}
            </option>
          ))}
        </Select>
        <Input
          className="h-10"
          placeholder="Buscar por paciente, DNI, codigo, descripcion o odontologo"
          value={search}
          onChange={(event) => {
            setCandidatePage(1);
            setSearch(event.target.value);
          }}
        />
      </Card>

      <Card className="grid gap-3 p-3 md:grid-cols-[110px_1fr_1fr_1fr_auto]">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Conceptos</p>
          <p className="mt-1 text-lg font-semibold">{selectedSummary.quantityConceptsPaid}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Codigos</p>
          <p className="mt-1 text-lg font-semibold">
            {formatCurrencyFromCents(selectedSummary.totalPagoCodigosCentavos)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Coseguro odonto</p>
          <p className="mt-1 text-lg font-semibold">
            {formatCurrencyFromCents(selectedSummary.totalCoseguroOdontoCentavos)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total a pagar</p>
          <p className="mt-1 text-lg font-semibold">
            {formatCurrencyFromCents(selectedSummary.totalHonorariosCentavos)}
          </p>
        </div>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => selectVisibleConcepts("payCode")}
            disabled={submitting || candidatesLoading || candidates.length === 0}
          >
            Seleccionar codigos
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => selectVisibleConcepts("payCoseguroOdonto")}
            disabled={submitting || candidatesLoading || candidates.length === 0}
          >
            Seleccionar coseguros
          </Button>
          <Button
            onClick={() => void submitPayment()}
            disabled={
              submitting ||
              selectedItems.length === 0 ||
              !userId ||
              !effectiveAttentionMonth
            }
          >
            {submitting ? "Generando..." : "Generar pago"}
          </Button>
        </div>
      </Card>

      {!userId || !effectiveAttentionMonth ? (
        <Card className="p-3 text-sm text-muted-foreground">
          {hasMixedSelectedMonths
            ? "La seleccion incluye meses distintos. Filtra un mes para generar el pago."
            : "Selecciona usuario y mes de atencion para generar una liquidacion."}
        </Card>
      ) : null}

      {successMessage ? (
        <Card className="border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {successMessage}
        </Card>
      ) : null}

      {candidatesLoading ? <LoadingState label="Cargando conceptos pagables..." /> : null}
      {!candidatesLoading && error ? <ErrorState label={error} retry={loadCandidates} /> : null}
      {!candidatesLoading && !error && candidates.length === 0 ? (
        <EmptyState label="No hay conceptos disponibles para la vista actual." />
      ) : null}

      {!candidatesLoading && !error && candidates.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1260px] table-fixed text-xs">
              <colgroup>
                <col className="w-[72px]" />
                <col className="w-[170px]" />
                <col className="w-[100px]" />
                <col className="w-[120px]" />
                <col />
                <col className="w-[110px]" />
                <col className="w-[120px]" />
                <col className="w-[96px]" />
                <col className="w-[96px]" />
              </colgroup>
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Paciente</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">DNI</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Obra social</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">
                    <div className="grid grid-cols-[68px_1fr_48px_92px] gap-2">
                      <span>Codigo</span>
                      <span>Descripcion</span>
                      <span className="text-center">Pieza</span>
                      <span className="text-right">Valor</span>
                    </div>
                  </th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Coseg. odonto</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                  <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-muted-foreground" title="Pago codigo">$</th>
                  <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-muted-foreground" title="Pago coseguro odonto">+</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((line) => {
                  const currentSelection =
                    selection[line.lineId] ?? getInitialSelection(line.lineId);
                  const canToggleCode = line.canPayCode;
                  const canToggleCoseguro = line.canPayCoseguroOdonto;

                  return (
                    <tr key={line.lineId} className="border-t border-border align-top">
                      <td className="whitespace-nowrap px-3 py-2">{formatTableDate(line.attentionFecha)}</td>
                      <td className="px-3 py-2 font-medium">
                        <p>{line.pacienteNombreCompleto}</p>
                        <p className="text-[11px] text-muted-foreground">{line.userName}</p>
                      </td>
                      <td className="px-3 py-2">{line.pacienteDni}</td>
                      <td className="px-3 py-2">{line.obraSocialNombre}</td>
                      <td className="px-3 py-2">
                        <div className="grid grid-cols-[68px_1fr_48px_92px] items-center gap-2">
                          <p className="font-medium">{line.codigo}</p>
                          <p className="truncate text-muted-foreground">{line.codigoNombre}</p>
                          <p className="text-center">{line.pieza || "-"}</p>
                          <p className="text-right tabular-nums">
                            {formatCurrencyFromCents(line.pagoOdontologoCentavos)}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrencyFromCents(line.coseguroOdontoCentavos ?? 0)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{attentionStatusLabels[line.estado]}</span>
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-center ${getPaymentCellClass(canToggleCode)}`}>
                        {line.codePaymentStatus === "pagado" ? (
                          <span className="inline-flex items-center justify-center text-emerald-700">
                            <Check className="h-4 w-4" strokeWidth={3} />
                          </span>
                        ) : (
                          <label className="inline-flex cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              checked={currentSelection.payCode}
                              disabled={!canToggleCode}
                              onChange={(event) =>
                                toggleSelection(line, "payCode", event.target.checked)
                              }
                            />
                          </label>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-center ${getPaymentCellClass(canToggleCoseguro)}`}>
                        {line.coseguroOdontoPaymentStatus === "pagado" ? (
                          <span className="inline-flex items-center justify-center text-emerald-700">
                            <Check className="h-4 w-4" strokeWidth={3} />
                          </span>
                        ) : (
                          <label className="inline-flex cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              checked={currentSelection.payCoseguroOdonto}
                              disabled={!canToggleCoseguro}
                              onChange={(event) =>
                                toggleSelection(
                                  line,
                                  "payCoseguroOdonto",
                                  event.target.checked,
                                )
                              }
                            />
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Pagina {candidatePage} de {candidateTotalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={candidatePage <= 1}
                onClick={() => setCandidatePage((value) => value - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={candidatePage >= candidateTotalPages}
                onClick={() => setCandidatePage((value) => value + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <PageHeader
        title="Historial de pagos"
        description="Pagos ya generados para no repetir conceptos liquidados."
      />

      {paymentsLoading ? <LoadingState label="Cargando pagos generados..." /> : null}
      {!paymentsLoading && historyError ? (
        <ErrorState label={historyError} retry={loadPayments} />
      ) : null}
      {!paymentsLoading && !historyError && payments.length === 0 ? (
        <EmptyState label="Todavia no hay pagos generados." />
      ) : null}

      {!paymentsLoading && !historyError && payments.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-3 py-2">Odontologo</th>
                  <th className="px-3 py-2">Mes atencion</th>
                  <th className="px-3 py-2">Fecha pago</th>
                  <th className="px-3 py-2 text-right">Conceptos</th>
                  <th className="px-3 py-2 text-right">Codigos</th>
                  <th className="px-3 py-2 text-right">Coseguro odonto</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{payment.usuarioNombreSnapshot}</td>
                    <td className="px-3 py-2">{payment.attentionMonth}</td>
                    <td className="px-3 py-2">{formatTableDate(payment.paidAt)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {payment.quantityConceptsPaid}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrencyFromCents(payment.totalPagoCodigosCentavos)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrencyFromCents(payment.totalCoseguroOdontoCentavos)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatCurrencyFromCents(payment.totalHonorariosCentavos)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setPaymentDetailDialog(payment)}
                      >
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
              Pagina {paymentPage} de {paymentTotalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={paymentPage <= 1}
                onClick={() => setPaymentPage((value) => value - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={paymentPage >= paymentTotalPages}
                onClick={() => setPaymentPage((value) => value + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Dialog
        open={Boolean(paymentDetailDialog)}
        onClose={() => setPaymentDetailDialog(null)}
        title="Detalle del pago"
        description={
          paymentDetailDialog
            ? `${paymentDetailDialog.usuarioNombreSnapshot} · ${paymentDetailDialog.attentionMonth} · ${formatTableDate(paymentDetailDialog.paidAt)}`
            : undefined
        }
        className="max-w-6xl"
      >
        {paymentDetailDialog ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Card className="p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Conceptos</p>
                <p className="mt-1 text-lg font-semibold">
                  {paymentDetailDialog.quantityConceptsPaid}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Codigos</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrencyFromCents(paymentDetailDialog.totalPagoCodigosCentavos)}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Coseguro odonto</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrencyFromCents(paymentDetailDialog.totalCoseguroOdontoCentavos)}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrencyFromCents(paymentDetailDialog.totalHonorariosCentavos)}
                </p>
              </Card>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1360px] text-sm">
                <thead className="bg-muted/70 text-left">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Paciente</th>
                    <th className="px-3 py-2">DNI</th>
                    <th className="px-3 py-2">Obra social</th>
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">Descripcion</th>
                    <th className="px-3 py-2">Pieza</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-right">Importe codigo</th>
                    <th className="px-3 py-2 text-right">Coseguro odonto</th>
                    <th className="px-3 py-2 text-center">$</th>
                    <th className="px-3 py-2 text-center">+</th>
                    <th className="px-3 py-2 text-right">Total linea</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentDetailDialog.lineItems.map((lineItem, index) => (
                    <tr
                      key={`${paymentDetailDialog.id}-${lineItem.attentionId}-${lineItem.codigoObraSocialId}-${index}`}
                      className="border-t border-border"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatTableDate(lineItem.attentionFecha)}
                      </td>
                      <td className="px-3 py-2 font-medium">{lineItem.pacienteNombre}</td>
                      <td className="px-3 py-2">{lineItem.pacienteDni}</td>
                      <td className="px-3 py-2">{lineItem.obraSocialNombre}</td>
                      <td className="px-3 py-2">{lineItem.codigo}</td>
                      <td className="px-3 py-2">{lineItem.codigoNombre}</td>
                      <td className="px-3 py-2">{lineItem.pieza || "-"}</td>
                      <td className="px-3 py-2">{attentionStatusLabels[lineItem.estadoAtencionSnapshot]}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrencyFromCents(lineItem.pagoOdontologoCentavos)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrencyFromCents(lineItem.coseguroOdontoCentavos ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {lineItem.includesCodePayment ? (
                          <span className="inline-flex items-center justify-center text-emerald-700">
                            <Check className="h-4 w-4" strokeWidth={3} />
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {lineItem.includesCoseguroOdontoPayment ? (
                          <span className="inline-flex items-center justify-center text-emerald-700">
                            <Check className="h-4 w-4" strokeWidth={3} />
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrencyFromCents(lineItem.totalLineaCentavos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
