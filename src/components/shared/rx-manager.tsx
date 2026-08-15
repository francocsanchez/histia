"use client";

import type { z } from "zod";
import { useEffect, useEffectEvent, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, ExternalLink } from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrencyFromCents, formatDate, formatMoneyInputFromCents, formatMoneyMaskedInput, parseMoneyInputToCents } from "@/lib/utils";
import { rxAttentionSchema } from "@/lib/validations/schemas";
import { RxAttentionDto } from "@/types/domain";

type FormValues = z.input<typeof rxAttentionSchema>;
type SubmitValues = z.output<typeof rxAttentionSchema>;

type RxListPayload = {
  success: boolean;
  data: RxAttentionDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
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
    odontologos: Array<{ id: string; label: string }>;
    obrasSociales: Array<{ id: string; nombre: string }>;
  };
  error?: { message?: string };
};

const rxTypeLabels: Record<"carpal" | "panoramica", string> = {
  carpal: "Carpal",
  panoramica: "Panoramica",
};

function emptyFormValues(): FormValues {
  return {
    fecha: new Date().toISOString().slice(0, 10),
    pacienteId: "",
    derivanteTipo: "interno",
    derivanteUserId: "",
    derivanteExternoNombre: "",
    tipoRx: "carpal",
    valorCentavos: null,
    observaciones: "",
  };
}

export function RxManager() {
  const [items, setItems] = useState<RxAttentionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [rxTypeFilter, setRxTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<RxAttentionDto | null>(null);
  const [odontologos, setOdontologos] = useState<Array<{ id: string; label: string }>>([]);
  const [obrasSociales, setObrasSociales] = useState<Array<{ id: string; nombre: string }>>([]);
  const [patientLookupDni, setPatientLookupDni] = useState("");
  const [patientLookupLoading, setPatientLookupLoading] = useState(false);
  const [patientLookupError, setPatientLookupError] = useState("");
  const [matchedPatient, setMatchedPatient] = useState<LookupPayload["data"]["paciente"]>(null);
  const [valorInput, setValorInput] = useState("");
  const form = useForm<FormValues, unknown, SubmitValues>({
    resolver: zodResolver(rxAttentionSchema),
    defaultValues: emptyFormValues(),
  });

  const derivanteTipo = useWatch({
    control: form.control,
    name: "derivanteTipo",
  });

  const loadLookups = async (dni?: string) => {
    const query = dni ? `?dni=${encodeURIComponent(dni)}` : "";
    const response = await fetch(`/api/rx/lookups${query}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as LookupPayload;

    if (!response.ok || !payload.success) {
      throw new Error(payload.error?.message || "No se pudieron cargar los datos");
    }

    setOdontologos(payload.data.odontologos);
    setObrasSociales(payload.data.obrasSociales);
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
      if (rxTypeFilter) params.set("rxType", rxTypeFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const response = await fetch(`/api/rx?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as RxListPayload;

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

  const loadFromEffect = useEffectEvent(async () => {
    await load();
  });

  const loadLookupsFromEffect = useEffectEvent(async () => {
    await loadLookups();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadLookupsFromEffect();
      void loadFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [page, search, rxTypeFilter, dateFrom, dateTo]);

  const openCreate = () => {
    setSelected(null);
    form.reset(emptyFormValues());
    setPatientLookupDni("");
    setMatchedPatient(null);
    setPatientLookupError("");
    setValorInput("");
    setDialogOpen(true);
  };

  const openEdit = (item: RxAttentionDto) => {
    setSelected(item);
    form.reset({
      fecha: item.fecha.slice(0, 10),
      pacienteId: item.pacienteId,
      derivanteTipo: item.derivanteTipo,
      derivanteUserId: item.derivanteUserId ?? "",
      derivanteExternoNombre: item.derivanteTipo === "externo" ? item.derivanteNombre : "",
      tipoRx: item.tipoRx,
      valorCentavos: item.valorCentavos,
      observaciones: item.observaciones ?? "",
    });
    setPatientLookupDni(item.pacienteDni);
    setMatchedPatient({
      id: item.pacienteId,
      nombre: item.pacienteNombreCompleto.split(", ")[1] ?? "",
      apellido: item.pacienteNombreCompleto.split(", ")[0] ?? "",
      dni: item.pacienteDni,
      obraSocialId: null,
      obraSocialNombre: item.pacienteObraSocialNombre,
    });
    setPatientLookupError("");
    setValorInput(item.valorCentavos !== null ? formatMoneyInputFromCents(item.valorCentavos) : "");
    setDialogOpen(true);
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
        form.setValue("pacienteId", data.paciente.id);
        form.setValue("paciente", undefined);
        form.setValue("paciente.dni", data.paciente.dni);
        form.setValue("paciente.nombre", data.paciente.nombre);
        form.setValue("paciente.apellido", data.paciente.apellido);
        form.setValue("paciente.obraSocialId", data.paciente.obraSocialId ?? "");
      } else {
        form.setValue("pacienteId", "");
        form.setValue("paciente", {
          nombre: "",
          apellido: "",
          dni,
          obraSocialId: "",
        });
        form.setValue("paciente.dni", dni);
      }
    } catch (lookupError) {
      setPatientLookupError(lookupError instanceof Error ? lookupError.message : "No se pudo buscar el paciente");
    } finally {
      setPatientLookupLoading(false);
    }
  };

  const submit = form.handleSubmit(async (values) => {
    const body: SubmitValues = {
      ...values,
      valorCentavos: values.valorCentavos ?? null,
    };

    if (body.pacienteId) {
      body.paciente = undefined;
    }

    const response = await fetch(selected ? `/api/rx/${selected.id}` : "/api/rx", {
      method: selected ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      form.setError("root", {
        message: payload.error?.message || "No se pudo guardar la atencion RX",
      });
      return;
    }

    setDialogOpen(false);
    await load();
  });

  return (
    <div className="space-y-6">
      <PageHeader title="RX" description="Registra y administra radiografias realizadas a pacientes." actionLabel="Nueva RX" onAction={openCreate} />

      <Card className="grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_180px]">
        <Input
          placeholder="Buscar por DNI, paciente o derivante"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
        <Select
          value={rxTypeFilter}
          onChange={(event) => {
            setPage(1);
            setRxTypeFilter(event.target.value);
          }}
        >
          <option value="">Todos los tipos</option>
          <option value="carpal">Carpal</option>
          <option value="panoramica">Panoramica</option>
        </Select>
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
      </Card>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState label={error} retry={load} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState label="No hay atenciones RX para mostrar." /> : null}

      {!loading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">DNI</th>
                  <th className="min-w-[260px] px-4 py-3">Derivante</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Obra social</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3">{formatDate(item.fecha)}</td>
                    <td className="px-4 py-3 font-medium">{item.pacienteNombreCompleto}</td>
                    <td className="px-4 py-3">{item.pacienteDni}</td>
                    <td className="min-w-[260px] px-4 py-3">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="truncate font-medium">{item.derivanteNombre}</span>
                        <Badge variant="muted" className="gap-1 whitespace-nowrap">
                          {item.derivanteTipo === "interno" ? (
                            <>
                              <Building2 className="h-3 w-3" />
                              Interno
                            </>
                          ) : (
                            <>
                              <ExternalLink className="h-3 w-3" />
                              Externo
                            </>
                          )}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">{rxTypeLabels[item.tipoRx]}</td>
                    <td className="px-4 py-3">{item.valorCentavos !== null ? formatCurrencyFromCents(item.valorCentavos) : "-"}</td>
                    <td className="px-4 py-3">{item.pacienteObraSocialNombre ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openEdit(item)}>
                          Editar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Pagina {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Anterior
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={selected ? "Editar RX" : "Nueva RX"}
        description="Registra la atencion radiografica sin salir del flujo."
        className="max-w-5xl"
      >
        <form className="space-y-5" onSubmit={submit}>
          <Card className="p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div>
                <label className="mb-2 block text-sm font-medium">DNI del paciente</label>
                <Input value={patientLookupDni} onChange={(event) => setPatientLookupDni(event.target.value)} placeholder="Ingresa el DNI y busca" />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="secondary" onClick={searchPatientByDni} disabled={patientLookupLoading}>
                  {patientLookupLoading ? "Buscando..." : "Buscar paciente"}
                </Button>
              </div>
            </div>

            {patientLookupError ? <p className="mt-2 text-sm text-destructive">{patientLookupError}</p> : null}

            {matchedPatient ? (
              <div className="mt-4 border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium">
                  Paciente encontrado: {matchedPatient.apellido}, {matchedPatient.nombre}
                </p>
                <p className="text-muted-foreground">
                  DNI: {matchedPatient.dni}
                  {matchedPatient.obraSocialNombre ? ` · Obra social: ${matchedPatient.obraSocialNombre}` : ""}
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Nombre</label>
                  <Input {...form.register("paciente.nombre")} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Apellido</label>
                  <Input {...form.register("paciente.apellido")} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">DNI</label>
                  <Input {...form.register("paciente.dni")} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Obra social</label>
                  <Select {...form.register("paciente.obraSocialId")}>
                    <option value="">Sin obra social</option>
                    {obrasSociales.map((obra) => (
                      <option key={obra.id} value={obra.id}>
                        {obra.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Fecha</label>
              <Input type="date" {...form.register("fecha")} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Tipo de RX</label>
              <Select {...form.register("tipoRx")}>
                <option value="carpal">Carpal</option>
                <option value="panoramica">Panoramica</option>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Profesional derivante</label>
              <Select {...form.register("derivanteTipo")}>
                <option value="interno">Interno</option>
                <option value="externo">Externo</option>
              </Select>
            </div>
            <div>
              {derivanteTipo === "interno" ? (
                <>
                  <label className="mb-2 block text-sm font-medium">Odontologo interno</label>
                  <Select {...form.register("derivanteUserId")}>
                    <option value="">Seleccionar odontologo</option>
                    {odontologos.map((odontologo) => (
                      <option key={odontologo.id} value={odontologo.id}>
                        {odontologo.label}
                      </option>
                    ))}
                  </Select>
                </>
              ) : (
                <>
                  <label className="mb-2 block text-sm font-medium">Profesional externo</label>
                  <Input {...form.register("derivanteExternoNombre")} />
                </>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Valor</label>
              <Input
                inputMode="numeric"
                placeholder="0,00"
                value={valorInput}
                onChange={(event) => {
                  const formattedValue = formatMoneyMaskedInput(event.target.value);
                  setValorInput(formattedValue);
                  form.setValue("valorCentavos", parseMoneyInputToCents(formattedValue), { shouldDirty: true, shouldValidate: true });
                }}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Observaciones</label>
              <textarea
                className="min-h-28 w-full border border-input bg-white px-3 py-2 text-sm text-foreground"
                {...form.register("observaciones")}
              />
            </div>
          </div>

          {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar RX</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
