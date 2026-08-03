"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { ErrorState, LoadingState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { attentionSchema } from "@/lib/validations/schemas";
import { AttentionDto } from "@/types/domain";

type FormValues = z.input<typeof attentionSchema>;

type LookupPayload = {
  success: boolean;
  data: {
    paciente: {
      id: string;
      nombre: string;
      apellido: string;
      dni: string;
      activo: boolean;
      obraSocialId: string | null;
      obraSocialNombre: string | null;
      obraSocialActiva: boolean;
    } | null;
    codigos: Array<{
      id: string;
      nombre: string;
      codigo: string;
      valorCentavos: number;
    }>;
    obrasSociales: Array<{
      id: string;
      nombre: string;
      cantidadPrestacionesMes: number;
    }>;
    usuariosCarga: Array<{
      id: string;
      label: string;
    }>;
    resumenMensual: {
      limiteMensual: number;
      usadasMes: number;
      disponibles: number;
      superaTope: boolean;
    } | null;
  };
  error?: { message?: string };
};

function emptyLine() {
  return {
    codigoObraSocialId: "",
    pieza: "",
    coseguroCentavos: null,
    observacion: "",
    pagoOdontologoCentavos: 0,
    estado: "pendiente" as const,
  };
}

function getDefaultValues(initialAttention?: AttentionDto): FormValues {
  if (!initialAttention) {
    return {
      fecha: new Date().toISOString().slice(0, 10),
      pacienteId: "",
      paciente: {
        nombre: "",
        apellido: "",
        dni: "",
        obraSocialId: "",
      },
      observacionGeneral: "",
      codigos: [emptyLine()],
    };
  }

  return {
    fecha: initialAttention.fecha.slice(0, 10),
    pacienteId: initialAttention.pacienteId,
    paciente: {
      nombre: "",
      apellido: "",
      dni: initialAttention.pacienteDni,
      obraSocialId: initialAttention.obraSocialId,
    },
    observacionGeneral: initialAttention.observacionGeneral ?? "",
    codigos:
      initialAttention.codigos.length > 0
        ? initialAttention.codigos.map((line) => ({
            codigoObraSocialId: line.codigoObraSocialId,
            pieza: line.pieza ?? "",
            coseguroCentavos: line.coseguroCentavos,
            observacion: line.observacion ?? "",
            pagoOdontologoCentavos: line.pagoOdontologoCentavos,
            estado: line.estado,
          }))
        : [emptyLine()],
  };
}

export function AttentionForm({
  mode,
  initialAttention,
}: {
  mode: "create" | "edit";
  initialAttention?: AttentionDto;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [patientLookupDni, setPatientLookupDni] = useState(
    initialAttention?.pacienteDni ?? "",
  );
  const [patientLookupLoading, setPatientLookupLoading] = useState(false);
  const [patientLookupError, setPatientLookupError] = useState("");
  const [matchedPatient, setMatchedPatient] = useState<LookupPayload["data"]["paciente"]>(
    initialAttention
      ? {
          id: initialAttention.pacienteId,
          nombre: initialAttention.pacienteNombreCompleto.split(", ")[1] ?? "",
          apellido: initialAttention.pacienteNombreCompleto.split(", ")[0] ?? "",
          dni: initialAttention.pacienteDni,
          activo: true,
          obraSocialId: initialAttention.obraSocialId,
          obraSocialNombre: initialAttention.obraSocialNombre,
          obraSocialActiva: true,
        }
      : null,
  );
  const [obrasSociales, setObrasSociales] = useState<LookupPayload["data"]["obrasSociales"]>(
    [],
  );
  const [codigosDisponibles, setCodigosDisponibles] = useState<
    LookupPayload["data"]["codigos"]
  >([]);
  const [resumenMensual, setResumenMensual] = useState<
    LookupPayload["data"]["resumenMensual"]
  >(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(attentionSchema),
    defaultValues: getDefaultValues(initialAttention),
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "codigos",
  });
  const fecha = useWatch({
    control: form.control,
    name: "fecha",
  });
  const pacienteId = useWatch({
    control: form.control,
    name: "pacienteId",
  });
  const inlineObraSocialId = useWatch({
    control: form.control,
    name: "paciente.obraSocialId",
  });
  const lineValues = useWatch({
    control: form.control,
    name: "codigos",
  });

  const selectedCodeOptions = new Map(
    codigosDisponibles.map((codigo) => [codigo.id, codigo]),
  );
  const currentCodesCount =
    lineValues?.filter((line) => Boolean(line?.codigoObraSocialId)).length ?? 0;
  const projectedUsage = (resumenMensual?.usadasMes ?? 0) + currentCodesCount;
  const projectedExceeded = resumenMensual
    ? projectedUsage > resumenMensual.limiteMensual
    : false;

  const bootstrapData = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await loadLookups(
        initialAttention
          ? {
              patientId: initialAttention.pacienteId,
              fecha: initialAttention.fecha.slice(0, 10),
            }
          : undefined,
      );

      if (initialAttention && data.paciente) {
        setMatchedPatient(data.paciente);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const loadLookups = async (params?: {
    dni?: string;
    patientId?: string;
    obraSocialId?: string;
    fecha?: string;
  }) => {
    const searchParams = new URLSearchParams();

    if (params?.dni) searchParams.set("dni", params.dni);
    if (params?.patientId) searchParams.set("patientId", params.patientId);
    if (params?.obraSocialId) searchParams.set("obraSocialId", params.obraSocialId);
    if (params?.fecha) searchParams.set("fecha", params.fecha);
    if (initialAttention?.id) searchParams.set("attentionId", initialAttention.id);

    const query = searchParams.toString();
    const response = await fetch(
      `/api/atenciones/lookups${query ? `?${query}` : ""}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as LookupPayload;

    if (!response.ok || !payload.success) {
      throw new Error(payload.error?.message || "No se pudieron cargar los datos");
    }

    setObrasSociales(payload.data.obrasSociales);
    setCodigosDisponibles(payload.data.codigos);
    setResumenMensual(payload.data.resumenMensual);

    return payload.data;
  };

  const bootstrap = useEffectEvent(async () => {
    await bootstrapData();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void bootstrap();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const refreshAvailability = useEffectEvent(async () => {
    try {
      if (pacienteId) {
        const data = await loadLookups({
          patientId: pacienteId,
          fecha,
        });
        setMatchedPatient(data.paciente);
        setPatientLookupError("");
        return;
      }

      if (inlineObraSocialId) {
        await loadLookups({
          obraSocialId: inlineObraSocialId,
          fecha,
        });
        setPatientLookupError("");
        return;
      }

      setCodigosDisponibles([]);
      setResumenMensual(null);
    } catch (lookupError) {
      setPatientLookupError(
        lookupError instanceof Error ? lookupError.message : "No se pudo recalcular el resumen",
      );
    }
  });

  useEffect(() => {
    if (!loading) {
      const timeout = window.setTimeout(() => {
        void refreshAvailability();
      }, 0);

      return () => window.clearTimeout(timeout);
    }
  }, [loading, fecha, pacienteId, inlineObraSocialId]);

  const searchPatientByDni = async () => {
    const dni = patientLookupDni.trim();

    if (!dni) {
      setPatientLookupError("Ingresa un DNI para buscar");
      return;
    }

    setPatientLookupLoading(true);
    setPatientLookupError("");

    try {
      const data = await loadLookups({
        dni,
        fecha,
      });

      setMatchedPatient(data.paciente);

      if (data.paciente) {
        form.setValue("pacienteId", data.paciente.id);
        form.setValue("paciente.dni", data.paciente.dni);
        form.setValue("paciente.nombre", data.paciente.nombre);
        form.setValue("paciente.apellido", data.paciente.apellido);
        form.setValue("paciente.obraSocialId", data.paciente.obraSocialId ?? "");
      } else {
        form.setValue("pacienteId", "");
        form.setValue("paciente.dni", dni);
        form.setValue("paciente.nombre", "");
        form.setValue("paciente.apellido", "");
      }
    } catch (lookupError) {
      setPatientLookupError(
        lookupError instanceof Error ? lookupError.message : "No se pudo buscar el paciente",
      );
    } finally {
      setPatientLookupLoading(false);
    }
  };

  const submit = form.handleSubmit(async (values) => {
    const body: FormValues = {
      ...values,
      codigos: values.codigos.map((line) => ({
        ...line,
        coseguroCentavos:
          line.coseguroCentavos === null ||
          line.coseguroCentavos === undefined ||
          Number.isNaN(line.coseguroCentavos)
            ? null
            : Number(line.coseguroCentavos),
        pagoOdontologoCentavos: Number(line.pagoOdontologoCentavos),
      })),
    };

    if (body.pacienteId) {
      body.paciente = undefined;
    }

    const response = await fetch(
      mode === "edit" && initialAttention
        ? `/api/atenciones/${initialAttention.id}`
        : "/api/atenciones",
      {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      form.setError("root", {
        message: payload.error?.message || "No se pudo guardar la atencion",
      });
      return;
    }

    router.push("/atenciones");
    router.refresh();
  });

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState label={error} retry={() => void bootstrapData()} />;
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium">Paciente</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Busca por DNI y, si no existe, completa el alta inline sin salir del flujo.
            </p>
          </div>
          <Link href="/atenciones">
            <Button type="button" variant="secondary">
              Volver al listado
            </Button>
          </Link>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-2 block text-sm font-medium">DNI del paciente</label>
            <Input
              value={patientLookupDni}
              onChange={(event) => setPatientLookupDni(event.target.value)}
              placeholder="Ingresa el DNI y busca"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              onClick={searchPatientByDni}
              disabled={patientLookupLoading}
            >
              {patientLookupLoading ? "Buscando..." : "Buscar paciente"}
            </Button>
          </div>
        </div>

        {patientLookupError ? (
          <p className="mt-3 text-sm text-destructive">{patientLookupError}</p>
        ) : null}

        {matchedPatient ? (
          <div className="mt-4 border border-border bg-muted/40 p-4 text-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">
                  Paciente encontrado: {matchedPatient.apellido}, {matchedPatient.nombre}
                </p>
                <p className="text-muted-foreground">
                  DNI: {matchedPatient.dni}
                  {matchedPatient.obraSocialNombre
                    ? ` | Obra social: ${matchedPatient.obraSocialNombre}`
                    : " | Sin obra social"}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant={matchedPatient.activo ? "success" : "muted"}>
                  {matchedPatient.activo ? "Activo" : "Inactivo"}
                </Badge>
                <Badge variant={matchedPatient.obraSocialActiva ? "success" : "muted"}>
                  {matchedPatient.obraSocialActiva ? "Obra social activa" : "Obra social inactiva"}
                </Badge>
              </div>
            </div>
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
                <option value="">Seleccionar obra social</option>
                {obrasSociales.map((obraSocial) => (
                  <option key={obraSocial.id} value={obraSocial.id}>
                    {obraSocial.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Fecha</label>
              <Input type="date" {...form.register("fecha")} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Observacion general</label>
              <textarea
                className="min-h-28 w-full border border-input bg-white px-3 py-2 text-sm text-foreground"
                {...form.register("observacionGeneral")}
              />
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <p className="text-sm font-medium">Control mensual</p>
          {resumenMensual ? (
            <div className="mt-3 space-y-2 text-sm">
              <p>Limite mensual: {resumenMensual.limiteMensual}</p>
              <p>Codigos ya cargados en el mes: {resumenMensual.usadasMes}</p>
              <p>
                Disponibles antes de esta atencion: {resumenMensual.disponibles}
              </p>
              <p>Codigos de esta atencion: {currentCodesCount}</p>
              <p className={projectedExceeded ? "font-medium text-amber-700" : ""}>
                Total proyectado del mes: {projectedUsage}
              </p>
              {projectedExceeded ? (
                <div className="border border-amber-300 bg-amber-50 p-3 text-amber-900">
                  Estas superando el tope mensual permitido para este paciente. Se
                  podra guardar igual, pero quedara advertido en el flujo.
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Selecciona o crea un paciente con obra social activa para ver disponibilidad y codigos.
            </p>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border px-3 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">Codigos de la atencion</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecciona el codigo y completa solo los datos administrativos necesarios.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => append(emptyLine())}>
            Agregar codigo
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[920px] text-sm">
            <thead className="bg-muted/70 text-left">
              <tr>
                <th className="px-3 py-2">Codigo</th>
                <th className="px-3 py-2">Pieza</th>
                <th className="px-3 py-2">Coseguro</th>
                <th className="px-3 py-2">Observacion</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const selectedCodeId = lineValues?.[index]?.codigoObraSocialId ?? "";
                const selectedCode = selectedCodeOptions.get(selectedCodeId);

                return (
                  <tr key={field.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <Select
                        {...form.register(`codigos.${index}.codigoObraSocialId`)}
                        onChange={(event) => {
                          const nextCodeId = event.target.value;
                          form.setValue(`codigos.${index}.codigoObraSocialId`, nextCodeId, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });

                          const code = selectedCodeOptions.get(nextCodeId);
                          if (code) {
                            form.setValue(
                              `codigos.${index}.pagoOdontologoCentavos`,
                              code.valorCentavos,
                              { shouldDirty: true, shouldValidate: true },
                            );
                          }
                        }}
                      >
                        <option value="">Seleccionar codigo</option>
                        {codigosDisponibles.map((codigo) => (
                          <option key={codigo.id} value={codigo.id}>
                            {codigo.codigo} - {codigo.nombre}
                          </option>
                        ))}
                      </Select>
                      {selectedCode ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {selectedCode.nombre}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="w-20"
                        maxLength={4}
                        {...form.register(`codigos.${index}.pieza`)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        {...form.register(`codigos.${index}.coseguroCentavos`, {
                          setValueAs: (value) => (value === "" ? null : Number(value)),
                        })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input {...form.register(`codigos.${index}.observacion`)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            if (fields.length > 1) {
                              remove(index);
                            }
                          }}
                          disabled={fields.length <= 1}
                        >
                          Quitar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {form.formState.errors.root ? (
        <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Link href="/atenciones">
          <Button type="button" variant="secondary">
            Cancelar
          </Button>
        </Link>
        <Button type="submit">
          {mode === "edit" ? "Guardar cambios" : "Guardar atencion"}
        </Button>
      </div>
    </form>
  );
}
