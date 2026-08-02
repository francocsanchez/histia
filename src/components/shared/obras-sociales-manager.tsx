"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { obraSocialSchema } from "@/lib/validations/schemas";
import { ObraSocialDto } from "@/types/domain";

type ObrasSocialesResponse = {
  success: boolean;
  data: ObraSocialDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: { message?: string };
};

type FormValues = {
  nombre: string;
  cantidadPrestacionesMes: number;
};

export function ObrasSocialesManager({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<ObraSocialDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<ObraSocialDto | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(obraSocialSchema),
    defaultValues: { nombre: "", cantidadPrestacionesMes: 0 },
  });

  const title = useMemo(
    () => (selected ? "Editar obra social" : "Nueva obra social"),
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

      const response = await fetch(`/api/obras-sociales?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ObrasSocialesResponse;

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
    form.reset({ nombre: "", cantidadPrestacionesMes: 0 });
    setDialogOpen(true);
  };

  const openEdit = (item: ObraSocialDto) => {
    setSelected(item);
    form.reset({
      nombre: item.nombre,
      cantidadPrestacionesMes: item.cantidadPrestacionesMes,
    });
    setDialogOpen(true);
  };

  const submit = form.handleSubmit(async (values) => {
    const response = await fetch(
      selected ? `/api/obras-sociales/${selected.id}` : "/api/obras-sociales",
      {
        method: selected ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      const serverError = payload.error?.message || "No se pudo guardar";
      form.setError("root", { message: serverError });
      return;
    }

    setDialogOpen(false);
    await load();
  });

  const toggleStatus = async (item: ObraSocialDto) => {
    const confirmed = window.confirm(
      item.activo
        ? "Se desactivara la obra social. Queres continuar?"
        : "Se activara la obra social. Queres continuar?",
    );

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/obras-sociales/${item.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !item.activo }),
    });

    if (response.ok) {
      await load();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Obras sociales"
        description="Gestiona las coberturas con su limite mensual de prestaciones."
        actionLabel={canManage ? "Nueva obra social" : undefined}
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
        <EmptyState label="No hay obras sociales para mostrar." />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Prestaciones / mes</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Actualizacion</th>
                  {canManage ? <th className="px-4 py-3 text-right">Acciones</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{item.nombre}</td>
                    <td className="px-4 py-3">{item.cantidadPrestacionesMes}</td>
                    <td className="px-4 py-3">
                      <Badge variant={item.activo ? "success" : "muted"}>
                        {item.activo ? "Activa" : "Inactiva"}
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
                            onClick={() => toggleStatus(item)}
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
            <label className="mb-2 block text-sm font-medium">
              Cantidad de prestaciones por mes
            </label>
            <Input
              type="number"
              min={0}
              {...form.register("cantidadPrestacionesMes", { valueAsNumber: true })}
            />
            {form.formState.errors.cantidadPrestacionesMes ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.cantidadPrestacionesMes.message}
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
    </div>
  );
}
