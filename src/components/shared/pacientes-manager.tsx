"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { pacienteSchema } from "@/lib/validations/schemas";
import { ObraSocialDto, PacienteDto } from "@/types/domain";

type FormValues = {
  nombre: string;
  apellido: string;
  dni: string;
  obraSocialId?: string | null;
};

type ListPayload = {
  success: boolean;
  data: PacienteDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
};

export function PacientesManager({
  canCreateAttention,
  canManage,
  canToggleStatus,
}: {
  canCreateAttention: boolean;
  canManage: boolean;
  canToggleStatus: boolean;
}) {
  const [items, setItems] = useState<PacienteDto[]>([]);
  const [obrasSociales, setObrasSociales] = useState<ObraSocialDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [obraSocialId, setObraSocialId] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<PacienteDto | null>(null);
  const [statusDialogItem, setStatusDialogItem] = useState<PacienteDto | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(pacienteSchema),
    defaultValues: { nombre: "", apellido: "", dni: "", obraSocialId: "" },
  });
  const selectableObrasSociales = selected?.obraSocialId &&
    selected.obraSocialNombre &&
    !obrasSociales.some((obra) => obra.id === selected.obraSocialId)
      ? [
          {
            id: selected.obraSocialId,
            nombre: `${selected.obraSocialNombre} (inactiva)`,
          } satisfies Pick<ObraSocialDto, "id" | "nombre">,
          ...obrasSociales,
        ]
      : obrasSociales;
  const showActions = canManage || canCreateAttention;

  const loadObrasSociales = async () => {
    const response = await fetch("/api/obras-sociales?status=active&limit=100", {
      cache: "no-store",
    });
    const payload = await response.json();
    if (response.ok && payload.success) setObrasSociales(payload.data);
  };

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        status,
      });
      if (search) params.set("search", search);
      if (obraSocialId) params.set("obraSocialId", obraSocialId);

      const response = await fetch(`/api/pacientes?${params.toString()}`, {
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

  const loadObrasSocialesFromEffect = useEffectEvent(async () => {
    await loadObrasSociales();
  });

  const loadFromEffect = useEffectEvent(async () => {
    await load();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadObrasSocialesFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [page, search, status, obraSocialId]);

  const openCreate = () => {
    setSelected(null);
    form.reset({ nombre: "", apellido: "", dni: "", obraSocialId: "" });
    setDialogOpen(true);
  };

  const openEdit = (item: PacienteDto) => {
    setSelected(item);
    form.reset({
      nombre: item.nombre,
      apellido: item.apellido,
      dni: item.dni,
      obraSocialId: item.obraSocialId ?? "",
    });
    setDialogOpen(true);
  };

  const submit = form.handleSubmit(async (values) => {
    const response = await fetch(
      selected ? `/api/pacientes/${selected.id}` : "/api/pacientes",
      {
        method: selected ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      form.setError("root", {
        message: payload.error?.message || "No se pudo guardar el paciente",
      });
      return;
    }

    setDialogOpen(false);
    await load();
  });

  const toggleStatus = async () => {
    if (!statusDialogItem) {
      return;
    }

    setStatusSubmitting(true);

    try {
      const response = await fetch(`/api/pacientes/${statusDialogItem.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !statusDialogItem.activo }),
      });

      if (response.ok) {
        setStatusDialogItem(null);
        await load();
      }
    } finally {
      setStatusSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pacientes"
        description="Administra pacientes y su cobertura asociada."
        actionLabel={canManage ? "Nuevo paciente" : undefined}
        onAction={canManage ? openCreate : undefined}
      />

      <Card className="grid gap-3 p-4 md:grid-cols-[1fr_220px_260px]">
        <Input
          placeholder="Buscar por nombre, apellido o DNI"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
        <Select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </Select>
        <Select
          value={obraSocialId}
          onChange={(event) => {
            setPage(1);
            setObraSocialId(event.target.value);
          }}
        >
          <option value="">Todas las obras sociales</option>
          {selectableObrasSociales.map((obra) => (
            <option key={obra.id} value={obra.id}>
              {obra.nombre}
            </option>
          ))}
        </Select>
      </Card>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState label={error} retry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState label="No hay pacientes para mostrar." />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">DNI</th>
                  <th className="px-4 py-3">Obra social</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Actualizacion</th>
                  {showActions ? <th className="px-4 py-3 text-right">Acciones</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">
                      {item.apellido}, {item.nombre}
                    </td>
                    <td className="px-4 py-3">{item.dni}</td>
                    <td className="px-4 py-3">{item.obraSocialNombre ?? "Particular"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={item.activo ? "success" : "muted"}>
                        {item.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(item.updatedAt)}
                    </td>
                    {showActions ? (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canCreateAttention ? (
                            <Link href={`/atenciones/nueva?dni=${encodeURIComponent(item.dni)}`}>
                              <Button size="sm">Atender</Button>
                            </Link>
                          ) : null}
                          {canManage ? (
                            <Button variant="secondary" size="sm" onClick={() => openEdit(item)}>
                              Editar
                            </Button>
                          ) : null}
                          {canToggleStatus ? (
                            <Button
                              variant={item.activo ? "destructive" : "secondary"}
                              size="sm"
                              onClick={() => setStatusDialogItem(item)}
                            >
                              {item.activo ? "Desactivar" : "Activar"}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
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
              <Button
                variant="secondary"
                size="sm"
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
        onClose={() => setDialogOpen(false)}
        title={selected ? "Editar paciente" : "Nuevo paciente"}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <div>
            <label className="mb-2 block text-sm font-medium">Nombre</label>
            <Input {...form.register("nombre")} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Apellido</label>
            <Input {...form.register("apellido")} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">DNI</label>
            <Input {...form.register("dni")} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Obra social</label>
            <Select {...form.register("obraSocialId")}>
              <option value="">Sin obra social</option>
              {selectableObrasSociales.map((obra) => (
                <option key={obra.id} value={obra.id}>
                  {obra.nombre}
                </option>
              ))}
            </Select>
          </div>

          {form.formState.errors.root ? (
            <p className="md:col-span-2 text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(statusDialogItem)}
        onClose={() => setStatusDialogItem(null)}
        onConfirm={() => void toggleStatus()}
        busy={statusSubmitting}
        title={statusDialogItem?.activo ? "Desactivar paciente" : "Activar paciente"}
        description={
          statusDialogItem?.activo
            ? "El paciente quedara inactivo para nuevas operaciones administrativas. Queres continuar?"
            : "El paciente volvera a quedar activo en el sistema. Queres continuar?"
        }
        confirmLabel={statusDialogItem?.activo ? "Desactivar" : "Activar"}
        confirmVariant={statusDialogItem?.activo ? "destructive" : "primary"}
      />
    </div>
  );
}
