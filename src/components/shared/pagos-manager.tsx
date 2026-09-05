"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { attentionStatusLabels } from "@/lib/attention-status";
import {
  formatCurrencyFromCents,
  formatDateOnly,
  formatMoneyMaskedInput,
  parseMoneyInputToCents,
} from "@/lib/utils";
import {
  attentionCodeStatusValues,
  PaymentCandidateLineDto,
  PaymentDto,
  PaymentLineItemDto,
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
    sourceType: "attention" | "orthodontic-payment";
    lineId: string;
    payCode: boolean;
    payCoseguroOdonto: boolean;
  }
>;

type PaymentDebitDraft = {
  id: string;
  monto: string;
  observacion: string;
};

function getSelectionKey(line: Pick<PaymentCandidateLineDto, "sourceType" | "lineId">) {
  return `${line.sourceType}:${line.lineId}`;
}

function getInitialSelection(line: Pick<PaymentCandidateLineDto, "sourceType" | "lineId">) {
  return {
    sourceType: line.sourceType,
    lineId: line.lineId,
    payCode: false,
    payCoseguroOdonto: false,
  };
}

function createPaymentDebitDraft(): PaymentDebitDraft {
  return {
    id: crypto.randomUUID(),
    monto: "",
    observacion: "",
  };
}

function getPaymentCellClass(enabled: boolean) {
  return enabled ? "text-foreground" : "text-muted-foreground";
}

function formatTableDate(value: string) {
  return formatDateOnly(value);
}

function renderCandidateDescription(line: PaymentCandidateLineDto) {
  if (line.sourceType === "orthodontic-payment") {
    return (
      <div className="space-y-1">
        <p className="font-medium">{line.codigo}</p>
        <p className="text-muted-foreground">Pago parcial de ortodoncia</p>
        <p className="text-muted-foreground">
          Pago paciente: {formatCurrencyFromCents(line.orthodonticPaymentAmountCentavos ?? 0)}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[68px_1fr_48px_92px] items-center gap-2">
      <p className="font-medium">{line.codigo}</p>
      <p className="truncate text-muted-foreground">{line.codigoNombre}</p>
      <p className="text-center">{line.pieza || "-"}</p>
      <p className="text-right tabular-nums">
        {formatCurrencyFromCents(line.pagoOdontologoCentavos)}
      </p>
    </div>
  );
}

function renderPaymentLineItem(lineItem: PaymentLineItemDto) {
  if (lineItem.sourceType === "orthodontic-payment") {
    return (
      <tr
        key={`${lineItem.orthodonticTreatmentId}-${lineItem.orthodonticPaymentId}`}
        className="border-t border-border"
      >
        <td className="px-3 py-2">Ortodoncia</td>
        <td className="px-3 py-2 whitespace-nowrap">{formatTableDate(lineItem.paymentDate)}</td>
        <td className="px-3 py-2 font-medium">{lineItem.patientName}</td>
        <td className="px-3 py-2">{lineItem.patientDni}</td>
        <td className="px-3 py-2">{lineItem.treatmentType.toUpperCase()}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          {formatCurrencyFromCents(lineItem.paymentAmountCentavos)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {lineItem.percentageToOrthodontist.toFixed(2)}%
        </td>
        <td className="px-3 py-2 text-right font-medium tabular-nums">
          {formatCurrencyFromCents(lineItem.totalLineaCentavos)}
        </td>
      </tr>
    );
  }

  return (
    <tr
      key={`${lineItem.attentionId}-${lineItem.codigoObraSocialId}-${lineItem.pieza ?? "na"}-${lineItem.totalLineaCentavos}`}
      className="border-t border-border"
    >
      <td className="px-3 py-2">Atenciones</td>
      <td className="px-3 py-2 whitespace-nowrap">{formatTableDate(lineItem.attentionFecha)}</td>
      <td className="px-3 py-2 font-medium">{lineItem.pacienteNombre}</td>
      <td className="px-3 py-2">{lineItem.pacienteDni}</td>
      <td className="px-3 py-2">
        {lineItem.codigo} · {lineItem.codigoNombre}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatCurrencyFromCents(
          (lineItem.includesCodePayment ? lineItem.pagoOdontologoCentavos : 0) +
            (lineItem.includesCoseguroOdontoPayment ? lineItem.coseguroOdontoCentavos ?? 0 : 0),
        )}
      </td>
      <td className="px-3 py-2">
        {attentionStatusLabels[lineItem.estadoAtencionSnapshot]}
      </td>
      <td className="px-3 py-2 text-right font-medium tabular-nums">
        {formatCurrencyFromCents(lineItem.totalLineaCentavos)}
      </td>
    </tr>
  );
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
  const [paymentConfirmationOpen, setPaymentConfirmationOpen] = useState(false);
  const [debitItems, setDebitItems] = useState<PaymentDebitDraft[]>([]);

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
          next[getSelectionKey(line)] = line;
        });

        return next;
      });
      setSelection((current) => {
        const next = { ...current };

        payload.data.forEach((line) => {
          const key = getSelectionKey(line);
          const previous = current[key];

          next[key] = {
            sourceType: line.sourceType,
            lineId: line.lineId,
            payCode: line.canPayCode && Boolean(previous?.payCode),
            payCoseguroOdonto:
              line.canPayCoseguroOdonto && Boolean(previous?.payCoseguroOdonto),
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
        .map(({ sourceType, lineId, payCode, payCoseguroOdonto }) => ({
          sourceType,
          lineId,
          payCode,
          payCoseguroOdonto,
        })),
    [selection],
  );

  const selectedSummary = useMemo(() => {
    return selectedItems.reduce(
      (acc, item) => {
        const line = candidateCache[`${item.sourceType}:${item.lineId}`];

        if (!line) {
          return acc;
        }

        if (line.sourceType === "orthodontic-payment") {
          if (item.payCode) {
            acc.totalOrtodonciaCentavos += line.pagoOdontologoCentavos;
            acc.quantityConceptsPaid += 1;
          }
          acc.totalHonorariosCentavos =
            acc.totalPagoCodigosCentavos +
            acc.totalCoseguroOdontoCentavos +
            acc.totalOrtodonciaCentavos;
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
          acc.totalPagoCodigosCentavos +
          acc.totalCoseguroOdontoCentavos +
          acc.totalOrtodonciaCentavos;

        return acc;
      },
      {
        totalPagoCodigosCentavos: 0,
        totalCoseguroOdontoCentavos: 0,
        totalOrtodonciaCentavos: 0,
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
            .map((item) => candidateCache[`${item.sourceType}:${item.lineId}`])
            .filter((line): line is PaymentCandidateLineDto => Boolean(line))
            .map((line) => line.attentionMonth)
            .filter((month): month is string => Boolean(month)),
        ),
      ),
    [candidateCache, selectedItems],
  );

  const debitSummary = useMemo(() => {
    const parsedItems = debitItems.map((item) => ({
      ...item,
      montoCentavos: parseMoneyInputToCents(item.monto),
      observacion: item.observacion.trim(),
    }));
    const invalidItem = parsedItems.find(
      (item) => !item.montoCentavos || item.montoCentavos <= 0 || !item.observacion,
    );
    const totalDebitosCentavos = parsedItems.reduce(
      (total, item) => total + (item.montoCentavos ?? 0),
      0,
    );

    return {
      totalDebitosCentavos,
      totalNetoPagarCentavos:
        selectedSummary.totalHonorariosCentavos - totalDebitosCentavos,
      debitItems: parsedItems,
      validationMessage: invalidItem
        ? "Cada debito debe tener un importe mayor que cero y una observacion."
        : "",
    };
  }, [debitItems, selectedSummary.totalHonorariosCentavos]);

  const toggleSelection = (
    line: PaymentCandidateLineDto,
    key: "payCode" | "payCoseguroOdonto",
    checked: boolean,
  ) => {
    const canToggle =
      key === "payCode" ? line.canPayCode : line.canPayCoseguroOdonto;

    if (!canToggle) {
      return;
    }

    const selectionKey = getSelectionKey(line);

    setSelection((current) => ({
      ...current,
      [selectionKey]: {
        ...(current[selectionKey] ?? getInitialSelection(line)),
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

        const selectionKey = getSelectionKey(line);
        next[selectionKey] = {
          ...(current[selectionKey] ?? getInitialSelection(line)),
          [key]: true,
        };
      });

      return next;
    });
  };

  const updateDebitItem = (
    id: string,
    field: "monto" | "observacion",
    value: string,
  ) => {
    setDebitItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === "monto" ? formatMoneyMaskedInput(value) : value,
            }
          : item,
      ),
    );
  };

  const openPaymentConfirmation = () => {
    if (debitSummary.validationMessage) {
      setError(debitSummary.validationMessage);
      return;
    }

    if (debitSummary.totalNetoPagarCentavos < 0) {
      setError("Los debitos no pueden superar el total bruto de la liquidacion.");
      return;
    }

    setError("");
    setPaymentConfirmationOpen(true);
  };

  const submitPayment = async () => {
    if (!userId || selectedItems.length === 0) {
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
          selectedItems,
          debitItems: debitSummary.debitItems.map((item) => ({
            montoCentavos: item.montoCentavos,
            observacion: item.observacion,
          })),
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo generar el pago");
      }

      setSelection({});
      setCandidateCache({});
      setDebitItems([]);
      setPaymentConfirmationOpen(false);
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
        description="Liquida honorarios profesionales por concepto, integrando atenciones y ortodoncia."
      />

      <Card className="grid gap-2 p-3 xl:grid-cols-[180px_180px_180px_1fr]">
        <Select
          className="h-10"
          value={userId}
          onChange={(event) => {
            setCandidatePage(1);
            setPaymentPage(1);
            setDebitItems([]);
            setPaymentConfirmationOpen(false);
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
            setDebitItems([]);
            setPaymentConfirmationOpen(false);
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
          placeholder="Buscar por paciente, DNI, codigo, sistema o profesional"
          value={search}
          onChange={(event) => {
            setCandidatePage(1);
            setSearch(event.target.value);
          }}
        />
      </Card>

      <Card className="grid gap-3 p-3 xl:grid-cols-7">
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
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Ortodoncia</p>
          <p className="mt-1 text-lg font-semibold">
            {formatCurrencyFromCents(selectedSummary.totalOrtodonciaCentavos)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Debitos</p>
          <p className="mt-1 text-lg font-semibold">
            {formatCurrencyFromCents(debitSummary.totalDebitosCentavos)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total neto a pagar</p>
          <p className="mt-1 text-lg font-semibold">
            {formatCurrencyFromCents(debitSummary.totalNetoPagarCentavos)}
          </p>
        </div>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => selectVisibleConcepts("payCode")}
            disabled={submitting || candidatesLoading || candidates.length === 0}
          >
            Seleccionar conceptos
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
            onClick={openPaymentConfirmation}
            disabled={
              submitting ||
              selectedItems.length === 0 ||
              !userId
            }
          >
            {submitting ? "Generando..." : "Generar pago"}
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Debitos de la liquidacion</p>
            <p className="text-sm text-muted-foreground">
              Registra retiros u otros descuentos que se aplicaran solo al confirmar este pago.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setDebitItems((current) => [...current, createPaymentDebitDraft()])}
            disabled={!userId || selectedItems.length === 0 || submitting}
          >
            <Plus className="mr-1 h-4 w-4" />
            Agregar debito
          </Button>
        </div>

        {debitItems.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-3">
            {debitItems.map((item, index) => (
              <div
                key={item.id}
                className="grid items-end gap-2 md:grid-cols-[160px_1fr_auto]"
              >
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Importe #{index + 1}
                  </label>
                  <Input
                    inputMode="decimal"
                    placeholder="0,00"
                    value={item.monto}
                    onChange={(event) => updateDebitItem(item.id, "monto", event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Observacion
                  </label>
                  <Input
                    placeholder="Ej. Retiro de dinero"
                    value={item.observacion}
                    onChange={(event) =>
                      updateDebitItem(item.id, "observacion", event.target.value)
                    }
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() =>
                    setDebitItems((current) => current.filter((debit) => debit.id !== item.id))
                  }
                  aria-label={`Quitar debito ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {debitSummary.validationMessage ? (
          <p className="text-sm text-destructive">{debitSummary.validationMessage}</p>
        ) : null}
        {debitSummary.totalNetoPagarCentavos < 0 ? (
          <p className="text-sm text-destructive">
            Los debitos superan el total bruto de la liquidacion.
          </p>
        ) : null}
      </Card>

      {!userId ? (
        <Card className="p-3 text-sm text-muted-foreground">
          Selecciona un profesional para generar una liquidacion.
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
            <table className="w-full min-w-[1380px] table-fixed text-xs">
              <colgroup>
                <col className="w-[96px]" />
                <col className="w-[72px]" />
                <col className="w-[170px]" />
                <col className="w-[100px]" />
                <col className="w-[140px]" />
                <col />
                <col className="w-[110px]" />
                <col className="w-[120px]" />
                <col className="w-[96px]" />
                <col className="w-[96px]" />
              </colgroup>
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Origen</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Paciente</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">DNI</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Cobertura</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Concepto</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground text-right">Coseg. odonto</th>
                  <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-muted-foreground" title="Pago principal">$</th>
                  <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-muted-foreground" title="Pago coseguro odonto">+</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((line) => {
                  const selectionKey = getSelectionKey(line);
                  const currentSelection =
                    selection[selectionKey] ?? getInitialSelection(line);
                  const canToggleCode = line.canPayCode;
                  const canToggleCoseguro = line.canPayCoseguroOdonto;

                  return (
                    <tr key={selectionKey} className="border-t border-border align-top">
                      <td className="px-3 py-2">{line.sourceLabel}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatTableDate(
                          line.sourceType === "orthodontic-payment"
                            ? line.orthodonticPaymentDate ?? line.attentionFecha
                            : line.attentionFecha,
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        <p>{line.pacienteNombreCompleto}</p>
                        <p className="text-[11px] text-muted-foreground">{line.userName}</p>
                      </td>
                      <td className="px-3 py-2">{line.pacienteDni}</td>
                      <td className="px-3 py-2">
                        {line.sourceType === "orthodontic-payment" ? "-" : line.obraSocialNombre}
                      </td>
                      <td className="px-3 py-2">{renderCandidateDescription(line)}</td>
                      <td className="px-3 py-2">
                        {line.sourceType === "orthodontic-payment"
                          ? "Pago ortodoncia"
                          : attentionStatusLabels[line.estado]}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {line.sourceType === "orthodontic-payment"
                          ? "-"
                          : formatCurrencyFromCents(line.coseguroOdontoCentavos ?? 0)}
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
                        {line.sourceType === "orthodontic-payment" ? (
                          "-"
                        ) : line.coseguroOdontoPaymentStatus === "pagado" ? (
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
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-3 py-2">Profesional</th>
                  <th className="px-3 py-2">Mes</th>
                  <th className="px-3 py-2">Fecha pago</th>
                  <th className="px-3 py-2 text-right">Conceptos</th>
                  <th className="px-3 py-2 text-right">Codigos</th>
                  <th className="px-3 py-2 text-right">Coseguro odonto</th>
                  <th className="px-3 py-2 text-right">Ortodoncia</th>
                  <th className="px-3 py-2 text-right">Debitos</th>
                  <th className="px-3 py-2 text-right">Neto pagado</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{payment.usuarioNombreSnapshot}</td>
                    <td className="px-3 py-2">{payment.attentionMonths.join(", ")}</td>
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
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrencyFromCents(payment.totalOrtodonciaCentavos)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-destructive">
                      - {formatCurrencyFromCents(payment.totalDebitosCentavos)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatCurrencyFromCents(payment.totalNetoPagarCentavos)}
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
        open={paymentConfirmationOpen}
        onClose={() => setPaymentConfirmationOpen(false)}
        title="Confirmar liquidacion"
        description="Revisa el importe final antes de generar el pago. Esta accion marcara los conceptos como pagados."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Meses de atencion incluidos: {selectedMonths.join(", ")}.
          </p>
          <div className="divide-y divide-border border-y border-border text-sm">
            <div className="flex items-center justify-between gap-4 py-2">
              <span>Total codigos</span>
              <span className="font-medium tabular-nums">
                {formatCurrencyFromCents(selectedSummary.totalPagoCodigosCentavos)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <span>Total coseguros</span>
              <span className="font-medium tabular-nums">
                {formatCurrencyFromCents(selectedSummary.totalCoseguroOdontoCentavos)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <span>Total ortodoncia</span>
              <span className="font-medium tabular-nums">
                {formatCurrencyFromCents(selectedSummary.totalOrtodonciaCentavos)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 text-destructive">
              <span>Total debitos</span>
              <span className="font-medium tabular-nums">
                - {formatCurrencyFromCents(debitSummary.totalDebitosCentavos)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 text-base font-semibold">
              <span>Total a pagar</span>
              <span className="tabular-nums">
                {formatCurrencyFromCents(debitSummary.totalNetoPagarCentavos)}
              </span>
            </div>
          </div>

          {debitSummary.debitItems.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Debitos aplicados</p>
              {debitSummary.debitItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 border border-border px-3 py-2 text-sm"
                >
                  <span>{item.observacion}</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrencyFromCents(item.montoCentavos ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPaymentConfirmationOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void submitPayment()} disabled={submitting}>
              {submitting ? "Generando..." : "Confirmar pago"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(paymentDetailDialog)}
        onClose={() => setPaymentDetailDialog(null)}
        title="Detalle del pago"
        description={
          paymentDetailDialog
            ? `${paymentDetailDialog.usuarioNombreSnapshot} · ${paymentDetailDialog.attentionMonths.join(", ")} · ${formatTableDate(paymentDetailDialog.paidAt)}`
            : undefined
        }
        className="max-w-6xl"
      >
        {paymentDetailDialog ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-6">
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
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ortodoncia</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrencyFromCents(paymentDetailDialog.totalOrtodonciaCentavos)}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Debitos</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrencyFromCents(paymentDetailDialog.totalDebitosCentavos)}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total neto</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrencyFromCents(paymentDetailDialog.totalNetoPagarCentavos)}
                </p>
              </Card>
            </div>

            {paymentDetailDialog.debitItems.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Debitos aplicados</p>
                <div className="overflow-x-auto border border-border">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead className="bg-muted/70 text-left">
                      <tr>
                        <th className="px-3 py-2">Observacion</th>
                        <th className="px-3 py-2 text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentDetailDialog.debitItems.map((item, index) => (
                        <tr key={`${item.observacion}-${index}`} className="border-t border-border">
                          <td className="px-3 py-2">{item.observacion}</td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            - {formatCurrencyFromCents(item.montoCentavos)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="bg-muted/70 text-left">
                  <tr>
                    <th className="px-3 py-2">Origen</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Paciente</th>
                    <th className="px-3 py-2">DNI</th>
                    <th className="px-3 py-2">Concepto</th>
                    <th className="px-3 py-2 text-right">Base</th>
                    <th className="px-3 py-2">Estado / %</th>
                    <th className="px-3 py-2 text-right">Total linea</th>
                  </tr>
                </thead>
                <tbody>{paymentDetailDialog.lineItems.map(renderPaymentLineItem)}</tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
