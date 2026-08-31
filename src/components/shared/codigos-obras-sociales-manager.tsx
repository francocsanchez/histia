"use client";

import type { z } from "zod";
import { Download, Upload } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
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
import {
  formatCurrencyFromCents,
  formatDate,
  formatMoneyInputFromCents,
  formatMoneyMaskedInput,
  parseMoneyInputToCents,
} from "@/lib/utils";
import { codigoObraSocialSchema } from "@/lib/validations/schemas";
import { CodigoObraSocialDto, ObraSocialDto } from "@/types/domain";

type FormValues = z.input<typeof codigoObraSocialSchema>;
type SubmitValues = z.output<typeof codigoObraSocialSchema>;

type ListPayload = {
  success: boolean;
  data: CodigoObraSocialDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
};

type ImportPreviewRow = {
  previewId: string;
  rowNumber: number;
  id: string;
  codigo: string;
  nombre: string;
  obraSocialId: string;
  obraSocial: string;
  valor: string;
  activo: string;
  operation: "create" | "update" | null;
  selected: boolean;
  valid: boolean;
  errors: string[];
};

type PreviewPayload = {
  success: boolean;
  data: {
    fileName: string;
    rows: ImportPreviewRow[];
    summary: {
      totalRows: number;
      validRows: number;
      invalidRows: number;
      createRows: number;
      updateRows: number;
    };
  };
  error?: { message?: string };
};

type ImportPayload = {
  success: boolean;
  data: {
    created: number;
    updated: number;
    processed: number;
  };
  error?: { message?: string };
};

export function CodigosObrasSocialesManager({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<CodigoObraSocialDto[]>([]);
  const [obrasSociales, setObrasSociales] = useState<ObraSocialDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [obraSocialId, setObraSocialId] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<CodigoObraSocialDto | null>(null);
  const [statusDialogItem, setStatusDialogItem] = useState<CodigoObraSocialDto | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [valorInput, setValorInput] = useState("0,00");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewPayload["data"] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const form = useForm<FormValues, unknown, SubmitValues>({
    resolver: zodResolver(codigoObraSocialSchema),
    defaultValues: { nombre: "", codigo: "", obraSocialId: "", valorCentavos: 0 },
  });

  const loadObrasSociales = async () => {
    const response = await fetch("/api/obras-sociales?status=active&limit=100", {
      cache: "no-store",
    });
    const payload = await response.json();

    if (response.ok && payload.success) {
      setObrasSociales(payload.data);
    }
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

      const response = await fetch(`/api/codigos-obras-sociales?${params.toString()}`, {
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
    form.reset({ nombre: "", codigo: "", obraSocialId: "", valorCentavos: 0 });
    setValorInput("0,00");
    setDialogOpen(true);
  };

  const openEdit = (item: CodigoObraSocialDto) => {
    setSelected(item);
    form.reset({
      nombre: item.nombre,
      codigo: item.codigo,
      obraSocialId: item.obraSocialId,
      valorCentavos: item.valorCentavos,
    });
    setValorInput(formatMoneyInputFromCents(item.valorCentavos));
    setDialogOpen(true);
  };

  const submit = form.handleSubmit(async (values) => {
    const response = await fetch(
      selected ? `/api/codigos-obras-sociales/${selected.id}` : "/api/codigos-obras-sociales",
      {
        method: selected ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      form.setError("root", {
        message: payload.error?.message || "No se pudo guardar el codigo",
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
      const response = await fetch(`/api/codigos-obras-sociales/${statusDialogItem.id}/status`, {
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

  const clearImportDialog = () => {
    setImportDialogOpen(false);
    setSelectedFile(null);
    setPreview(null);
    setPreviewError("");
    setPreviewLoading(false);
    setImporting(false);
  };

  const downloadWorkbook = async () => {
    setDownloading(true);
    setPreviewError("");

    try {
      const response = await fetch("/api/codigos-obras-sociales/export", {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message || "No se pudo descargar el Excel");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition");
      const fileNameMatch = disposition?.match(/filename="(.+)"/i);
      const fileName = fileNameMatch?.[1] ?? "codigos-obras-sociales.xlsx";
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : "Error inesperado al descargar",
      );
    } finally {
      setDownloading(false);
    }
  };

  const uploadPreview = async () => {
    if (!selectedFile) {
      setPreviewError("Debes seleccionar un archivo Excel");
      return;
    }

    setPreviewLoading(true);
    setPreviewError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/codigos-obras-sociales/preview", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as PreviewPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo procesar el archivo");
      }

      setPreview(payload.data);
    } catch (previewLoadError) {
      setPreviewError(
        previewLoadError instanceof Error ? previewLoadError.message : "Error inesperado",
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const togglePreviewRow = (previewId: string) => {
    setPreview((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row) =>
              row.previewId === previewId && row.valid
                ? { ...row, selected: !row.selected }
                : row,
            ),
          }
        : current,
    );
  };

  const includeAllValidPreviewRows = () => {
    setPreview((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row) =>
              row.valid ? { ...row, selected: true } : row,
            ),
          }
        : current,
    );
  };

  const importWorkbook = async () => {
    if (!preview) {
      return;
    }

    setImporting(true);
    setPreviewError("");

    try {
      const response = await fetch("/api/codigos-obras-sociales/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.rows }),
      });
      const payload = (await response.json()) as ImportPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo importar el archivo");
      }

      clearImportDialog();
      await load();
    } catch (importError) {
      setPreviewError(importError instanceof Error ? importError.message : "Error inesperado");
    } finally {
      setImporting(false);
    }
  };

  const selectedValidRows =
    preview?.rows.filter((row) => row.selected && row.valid).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Codigos de obras sociales"
        description="Define prestaciones y valores monetarios por cada obra social."
        actions={
          canManage ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void downloadWorkbook()}
                disabled={downloading}
              >
                <Download className="size-4" aria-hidden="true" />
                {downloading ? "Descargando..." : "Descargar Excel"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setImportDialogOpen(true)}
              >
                <Upload className="size-4" aria-hidden="true" />
                Importar Excel
              </Button>
            </>
          ) : null
        }
        actionLabel={canManage ? "Nuevo codigo" : undefined}
        onAction={canManage ? openCreate : undefined}
      />

      <Card className="grid gap-3 p-4 md:grid-cols-[1fr_220px_260px]">
        <Input
          placeholder="Buscar por nombre o codigo"
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
          {obrasSociales.map((obra) => (
            <option key={obra.id} value={obra.id}>
              {obra.nombre}
            </option>
          ))}
        </Select>
      </Card>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState label={error} retry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState label="No hay codigos para mostrar." />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-4 py-3">Prestacion</th>
                  <th className="px-4 py-3">Codigo</th>
                  <th className="px-4 py-3">Obra social</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Actualizacion</th>
                  {canManage ? <th className="px-4 py-3 text-right">Acciones</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{item.nombre}</td>
                    <td className="px-4 py-3">{item.codigo}</td>
                    <td className="px-4 py-3">{item.obraSocialNombre}</td>
                    <td className="px-4 py-3">{formatCurrencyFromCents(item.valorCentavos)}</td>
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
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEdit(item)}
                          >
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
                onClick={() => setPage((value) => value - 1)}
              >
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
        open={importDialogOpen}
        onClose={clearImportDialog}
        title="Importar codigos"
        description="Carga el Excel exportado, valida las filas y aplica altas o actualizaciones sin tocar los codigos ausentes."
        className="max-w-6xl"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium">Archivo Excel</label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              type="button"
              onClick={() => void uploadPreview()}
              disabled={previewLoading}
            >
              {previewLoading ? "Validando..." : "Validar archivo"}
            </Button>
          </div>

          {selectedFile ? (
            <p className="text-sm text-muted-foreground">
              Archivo seleccionado: {selectedFile.name}
            </p>
          ) : null}

          {previewError ? <p className="text-sm text-destructive">{previewError}</p> : null}

          {preview ? (
            <div className="space-y-4">
              <Card className="grid gap-3 p-4 md:grid-cols-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Filas</p>
                  <p className="mt-1 text-lg font-semibold">{preview.summary.totalRows}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Validas</p>
                  <p className="mt-1 text-lg font-semibold">{preview.summary.validRows}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">A crear</p>
                  <p className="mt-1 text-lg font-semibold">{preview.summary.createRows}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    A actualizar
                  </p>
                  <p className="mt-1 text-lg font-semibold">{preview.summary.updateRows}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Invalidas
                  </p>
                  <p className="mt-1 text-lg font-semibold">{preview.summary.invalidRows}</p>
                </div>
              </Card>

              <div className="max-h-[420px] overflow-auto border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/70 text-left">
                    <tr>
                      <th className="px-3 py-2">Incluir</th>
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Accion</th>
                      <th className="px-3 py-2">Codigo</th>
                      <th className="px-3 py-2">Prestacion</th>
                      <th className="px-3 py-2">Obra social</th>
                      <th className="px-3 py-2">Valor</th>
                      <th className="px-3 py-2">Activo</th>
                      <th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.previewId} className="border-t border-border align-top">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            disabled={!row.valid}
                            onChange={() => togglePreviewRow(row.previewId)}
                          />
                        </td>
                        <td className="px-3 py-2">{row.rowNumber}</td>
                        <td className="px-3 py-2">
                          {row.operation === "update" ? (
                            <Badge variant="muted">Actualizar</Badge>
                          ) : row.operation === "create" ? (
                            <Badge variant="default">Crear</Badge>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-2">{row.codigo || "-"}</td>
                        <td className="px-3 py-2">{row.nombre || "-"}</td>
                        <td className="px-3 py-2">
                          <div>{row.obraSocial || "-"}</div>
                          <p className="text-xs text-muted-foreground">{row.obraSocialId || "-"}</p>
                        </td>
                        <td className="px-3 py-2">{row.valor || "-"}</td>
                        <td className="px-3 py-2">{row.activo || "-"}</td>
                        <td className="px-3 py-2">
                          {row.valid ? (
                            <Badge variant="success">Valida</Badge>
                          ) : (
                            <div className="space-y-1 text-xs text-destructive">
                              {row.errors.map((message) => (
                                <p key={message}>{message}</p>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    {selectedValidRows} filas validas seleccionadas para importar.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={includeAllValidPreviewRows}
                    disabled={preview.summary.validRows === 0}
                  >
                    Incluir todos los validos
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={clearImportDialog}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void importWorkbook()}
                    disabled={importing || selectedValidRows === 0}
                  >
                    {importing ? "Importando..." : "Aplicar importacion"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={selected ? "Editar codigo" : "Nuevo codigo"}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Nombre</label>
            <Input {...form.register("nombre")} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Codigo</label>
            <Input {...form.register("codigo")} />
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
                form.setValue("valorCentavos", parseMoneyInputToCents(formattedValue) ?? 0, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Obra social</label>
            <Select {...form.register("obraSocialId")}>
              <option value="">Seleccionar obra social</option>
              {obrasSociales.map((obra) => (
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialogOpen(false)}
            >
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
        title={statusDialogItem?.activo ? "Desactivar codigo" : "Activar codigo"}
        description={
          statusDialogItem?.activo
            ? "El codigo dejara de estar disponible para nuevas atenciones. Queres continuar?"
            : "El codigo volvera a estar disponible para su uso en el sistema. Queres continuar?"
        }
        confirmLabel={statusDialogItem?.activo ? "Desactivar" : "Activar"}
        confirmVariant={statusDialogItem?.activo ? "destructive" : "primary"}
      />
    </div>
  );
}
