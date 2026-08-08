"use client";

import type { z } from "zod";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { movementDirectionLabels } from "@/lib/movement";
import { formatDate } from "@/lib/utils";
import { movementTypeSchema } from "@/lib/validations/schemas";
import { MovementTypeDto, movementDirectionValues } from "@/types/domain";

type FormValues = z.input<typeof movementTypeSchema>;
type SubmitValues = z.output<typeof movementTypeSchema>;

type ListPayload = {
  success: boolean;
  data: MovementTypeDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
};

export function TiposMovimientosManager({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<MovementTypeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<MovementTypeDto | null>(null);
  const [statusDialogItem, setStatusDialogItem] = useState<MovementTypeDto | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const form = useForm<FormValues, unknown, SubmitValues>({
    resolver: zodResolver(movementTypeSchema),
    defaultValues: { nombre: "", direccion: "egreso" },
  });

  const title = useMemo(
    () => (selected ? "Editar tipo de movimiento" : "Nuevo tipo de movimiento"),
    [selected],
  );

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        status,
      });

      if (search) {
        params.set("search", search);
      }

      const response = await fetch(`/api/tipos-movimientos?${params.toString()}`, {
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

  const loadFromEffect = useEffectEvent(async () => {
    await load();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [page, search, status]);

  const openCreate = () => {
    setSelected(null);
    form.reset({ nombre: "", direccion: "egreso" });
    setDialogOpen(true);
  };

  const openEdit = (item: MovementTypeDto) => {
    setSelected(item);
    form.reset({
      nombre: item.nombre,
      direccion: item.direccion,
    });
    setDialogOpen(true);
  };

  const submit = form.handleSubmit(async (values) => {
    const response = await fetch(
      selected ? `/api/tipos-movimientos/${selected.id}` : "/api/tipos-movimientos",
      {
        method: selected ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      form.setError("root", {
        message: payload.error?.message || "No se pudo guardar el tipo de movimiento",
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
      const response = await fetch(`/api/tipos-movimientos/${statusDialogItem.id}/status`, {
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
        title="Tipos de movimientos"
        description="Administra las categorias contables disponibles para ingresos y egresos."
        actionLabel={canManage ? "Nuevo tipo" : undefined}
        onAction={canManage ? openCreate : undefined}
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input
            placeholder="Buscar por nombre"
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
        </div>
      </Card>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState label={error} retry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState label="No hay tipos de movimientos para mostrar." />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Direccion</th>
                  <th className="px-4 py-3">Clase</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Actualizacion</th>
                  {canManage ? <th className="px-4 py-3 text-right">Acciones</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{item.nombre}</td>
                    <td className="px-4 py-3">{movementDirectionLabels[item.direccion]}</td>
                    <td className="px-4 py-3">
                      <Badge variant={item.systemKey ? "muted" : "default"}>
                        {item.systemKey ? "Sistema" : "Manual"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={item.activo ? "success" : "muted"}>
                        {item.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(item.updatedAt)}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => openEdit(item)}>
                            Editar
                          </Button>
                          <Button
                            variant={item.activo ? "destructive" : "secondary"}
                            size="sm"
                            onClick={() => setStatusDialogItem(item)}
                          >
                            {item.activo ? "Desactivar" : "Activar"}
                          </Button>
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
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
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
        title={title}
        description="Completa los datos y guarda los cambios."
      >
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="mb-2 block text-sm font-medium">Nombre</label>
            <Input {...form.register("nombre")} />
            {form.formState.errors.nombre ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.nombre.message}
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Direccion</label>
            <Select
              {...form.register("direccion")}
              disabled={Boolean(selected?.systemKey)}
            >
              {movementDirectionValues.map((item) => (
                <option key={item} value={item}>
                  {movementDirectionLabels[item]}
                </option>
              ))}
            </Select>
            {form.formState.errors.direccion ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.direccion.message}
              </p>
            ) : null}
          </div>

          {form.formState.errors.root ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
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
        title={
          statusDialogItem?.activo
            ? "Desactivar tipo de movimiento"
            : "Activar tipo de movimiento"
        }
        description={
          statusDialogItem?.activo
            ? "El tipo dejara de estar disponible para nuevas cargas manuales. Queres continuar?"
            : "El tipo volvera a estar disponible para nuevas cargas manuales. Queres continuar?"
        }
        confirmLabel={statusDialogItem?.activo ? "Desactivar" : "Activar"}
        confirmVariant={statusDialogItem?.activo ? "destructive" : "primary"}
      />
    </div>
  );
}
