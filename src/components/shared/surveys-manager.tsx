"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Clock3,
  MessageCircleMore,
  Send,
} from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { SurveyDto, SurveySettingsDto, WhatsAppConnectionDto } from "@/types/domain";

type PreviewRow = {
  previewId: string;
  rowNumber: number;
  patientNameSnapshot: string;
  doctorNameSnapshot: string;
  phoneRaw: string;
  phoneE164: string | null;
  attendanceAt: string | null;
  selected: boolean;
  valid: boolean;
  duplicate: boolean;
  errors: string[];
};

type PreviewPayload = {
  success: boolean;
  data: {
    fileName: string;
    importedYear: number;
    rows: PreviewRow[];
    summary: {
      totalRows: number;
      validRows: number;
      duplicateRows: number;
      invalidRows: number;
    };
  };
  error?: { message?: string };
};

type SurveyListPayload = {
  success: boolean;
  data: SurveyDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
};

type WhatsAppPayload = {
  success: boolean;
  data: WhatsAppConnectionDto;
  error?: { message?: string };
};

type SettingsPayload = {
  success: boolean;
  data: SurveySettingsDto;
  error?: { message?: string };
};

type DashboardTotals = {
  queued: number;
  waiting: number;
  completed: number;
  noResponse: number;
  sendFailed: number;
  deliveryUnknown: number;
};

const emptyTotals: DashboardTotals = {
  queued: 0,
  waiting: 0,
  completed: 0,
  noResponse: 0,
  sendFailed: 0,
  deliveryUnknown: 0,
};

const filterCards: Array<{
  key: keyof DashboardTotals;
  label: string;
  statusValue: string;
}> = [
  { key: "queued", label: "Pendientes", statusValue: "queued" },
  { key: "waiting", label: "Esperando respuesta", statusValue: "waiting" },
  { key: "completed", label: "Finalizadas", statusValue: "completed" },
  { key: "noResponse", label: "Sin respuesta", statusValue: "no_response" },
  { key: "sendFailed", label: "Fallidas", statusValue: "send_failed" },
  { key: "deliveryUnknown", label: "Delivery incierto", statusValue: "delivery_unknown" },
];

function getSurveyStatusMeta(status: SurveyDto["status"]) {
  if (status === "queued" || status === "leased_for_send") {
    return {
      label: status === "queued" ? "Pendiente" : "En envio",
      icon: Clock3,
      className: "text-muted-foreground",
    };
  }

  if (
    status === "waiting_rating" ||
    status === "waiting_comment_opt_in" ||
    status === "waiting_comment_text"
  ) {
    return {
      label: "Esperando respuesta",
      icon: MessageCircleMore,
      className: "text-primary",
    };
  }

  if (status === "completed") {
    return {
      label: "Finalizada",
      icon: CheckCircle2,
      className: "text-primary",
    };
  }

  if (status === "no_response") {
    return {
      label: "Sin respuesta",
      icon: CircleOff,
      className: "text-muted-foreground",
    };
  }

  if (status === "send_failed") {
    return {
      label: "Fallida",
      icon: AlertTriangle,
      className: "text-destructive",
    };
  }

  if (status === "delivery_unknown") {
    return {
      label: "Delivery incierto",
      icon: Send,
      className: "text-amber-600",
    };
  }

  return {
    label: "Cancelada",
    icon: CircleOff,
    className: "text-destructive",
  };
}

export function SurveysManager() {
  const [surveys, setSurveys] = useState<SurveyDto[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(true);
  const [surveysError, setSurveysError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [totals, setTotals] = useState<DashboardTotals>(emptyTotals);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewPayload["data"] | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [whatsApp, setWhatsApp] = useState<WhatsAppConnectionDto | null>(null);
  const [whatsAppLoading, setWhatsAppLoading] = useState(true);
  const [settings, setSettings] = useState<SurveySettingsDto | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [commentDialogSurvey, setCommentDialogSurvey] = useState<SurveyDto | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const loadSurveys = async () => {
    setSurveysLoading(true);
    setSurveysError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });

      if (search) {
        params.set("search", search);
      }

      if (status) {
        params.set("status", status);
      }

      const response = await fetch(`/api/encuestas?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as SurveyListPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar el listado");
      }

      setSurveys(payload.data);
      setTotalPages(payload.pagination.totalPages);
      setTotals(
        JSON.parse(response.headers.get("x-surveys-totals") || JSON.stringify(emptyTotals)),
      );
    } catch (error) {
      setSurveysError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSurveysLoading(false);
    }
  };

  const loadWhatsApp = async () => {
    setWhatsAppLoading(true);

    try {
      const response = await fetch("/api/encuestas/whatsapp", { cache: "no-store" });
      const payload = (await response.json()) as WhatsAppPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar el estado de WhatsApp");
      }

      setWhatsApp(payload.data);
    } finally {
      setWhatsAppLoading(false);
    }
  };

  const loadSettings = async () => {
    setSettingsLoading(true);

    try {
      const response = await fetch("/api/encuestas/settings", { cache: "no-store" });
      const payload = (await response.json()) as SettingsPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar la configuracion");
      }

      setSettings(payload.data);
    } catch (error) {
      setSurveysError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSettingsLoading(false);
    }
  };

  const loadSurveysFromEffect = useEffectEvent(async () => {
    await loadSurveys();
  });

  const loadWhatsAppFromEffect = useEffectEvent(async () => {
    await loadWhatsApp();
  });

  const loadSettingsFromEffect = useEffectEvent(async () => {
    await loadSettings();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSurveysFromEffect();
      void loadWhatsAppFromEffect();
      void loadSettingsFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSurveysFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [page, search, status]);

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

      const response = await fetch("/api/encuestas/preview", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as PreviewPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo procesar el archivo");
      }

      setPreview(payload.data);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Error inesperado");
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

  const createCampaign = async () => {
    if (!preview) {
      return;
    }

    setCreatingCampaign(true);
    setPreviewError("");

    try {
      const response = await fetch("/api/encuestas/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: preview.fileName,
          rows: preview.rows,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo crear la campana");
      }

      const campaignId = payload.data?.campaign?.id as string | undefined;

      if (campaignId) {
        const startResponse = await fetch(`/api/encuestas/campaigns/${campaignId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });
        const startPayload = await startResponse.json();

        if (!startResponse.ok || !startPayload.success) {
          throw new Error(startPayload.error?.message || "La campana se creo, pero no se pudo iniciar");
        }
      }

      setPreview(null);
      setPreviewError("");
      setSelectedFile(null);
      setImportDialogOpen(false);
      await loadSurveys();
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setCreatingCampaign(false);
    }
  };

  const openWhatsAppLinkTab = () => {
    const url = new URL("/encuestas/vincular", window.location.origin).toString();
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      if (!document.hasFocus()) {
        return;
      }

      window.location.assign("/encuestas/vincular");
    }, 300);
  };

  const clearImportDialog = () => {
    setImportDialogOpen(false);
    setSelectedFile(null);
    setPreview(null);
    setPreviewError("");
    setPreviewLoading(false);
    setCreatingCampaign(false);
  };

  const toggleGlobalPause = async () => {
    if (!settings) {
      return;
    }

    setSettingsSaving(true);
    setSurveysError("");

    try {
      const response = await fetch("/api/encuestas/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          globalPause: !settings.globalPause,
        }),
      });
      const payload = (await response.json()) as SettingsPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo actualizar la pausa de envios");
      }

      setSettings(payload.data);
      await loadSurveys();
    } catch (error) {
      setSurveysError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSettingsSaving(false);
    }
  };

  const whatsappConnected = whatsApp?.status === "connected";
  const sendingPaused = settings?.globalPause ?? false;
  const controlsBusy = settingsLoading || settingsSaving;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Encuestas"
        description="Importa atenciones desde Excel y revisa todas las encuestas en una sola tabla operativa."
        actions={
          <>
            <div className="inline-flex items-center gap-2 border border-border bg-card px-3 py-2 text-sm">
              <span
                className={`size-2.5 rounded-full ${
                  whatsAppLoading
                    ? "bg-muted-foreground/40"
                    : whatsappConnected
                      ? "bg-primary"
                      : "bg-destructive"
                }`}
              />
              <span>
                {whatsAppLoading
                  ? "WhatsApp"
                  : whatsappConnected
                    ? "Numero vinculado"
                    : "Sin vinculacion"}
              </span>
            </div>
            <Button type="button" variant="secondary" onClick={openWhatsAppLinkTab}>
              Vincular numero
            </Button>
            <Button
              type="button"
              variant={sendingPaused ? "primary" : "secondary"}
              onClick={() => void toggleGlobalPause()}
              disabled={controlsBusy}
            >
              {controlsBusy
                ? "Actualizando..."
                : sendingPaused
                  ? "Reanudar envios"
                  : "Pausar envios"}
            </Button>
            <Button type="button" onClick={() => setImportDialogOpen(true)}>
              Importar archivo
            </Button>
          </>
        }
      />

      <Card className={`p-4 ${sendingPaused ? "border-amber-300 bg-amber-50" : "bg-card"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {sendingPaused ? "Envios pausados" : "Envios activos"}
            </p>
            <p className="text-sm text-muted-foreground">
              {sendingPaused
                ? "No se enviaran mensajes nuevos aunque vuelvas a vincular WhatsApp, hasta que reanudes manualmente."
                : "Las encuestas listas pueden enviarse automaticamente dentro del horario operativo."}
            </p>
          </div>
          <Badge variant={sendingPaused ? "default" : "success"}>
            {sendingPaused ? "Pausa global activa" : "Operacion habilitada"}
          </Badge>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {filterCards.map((card) => {
          const active = status === card.statusValue;

          return (
            <button
              key={card.key}
              type="button"
              className={`border p-4 text-left transition ${
                active
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-accent"
              }`}
              onClick={() => {
                setPage(1);
                setStatus((current) => (current === card.statusValue ? "" : card.statusValue));
              }}
            >
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold">{totals[card.key]}</p>
            </button>
          );
        })}
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row">
            <Input
              placeholder="Buscar por paciente, doctor, telefono o archivo"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
            {status ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPage(1);
                  setStatus("");
                }}
              >
                Limpiar filtro
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {status
              ? `Filtrando por estado: ${status}`
              : "Mostrando todas las encuestas"}
          </p>
        </div>

        {surveysLoading ? <LoadingState label="Cargando encuestas..." /> : null}
        {!surveysLoading && surveysError ? (
          <ErrorState label={surveysError} retry={() => void loadSurveys()} />
        ) : null}
        {!surveysLoading && !surveysError && surveys.length === 0 ? (
          <EmptyState label="No hay encuestas para los filtros seleccionados." />
        ) : null}

        {!surveysLoading && !surveysError && surveys.length > 0 ? (
          <div className="overflow-x-auto border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-3 py-2">Paciente</th>
                  <th className="px-3 py-2">Numero</th>
                  <th className="px-3 py-2">Atencion</th>
                  <th className="px-3 py-2">Doctor</th>
                  <th className="px-3 py-2">Rating</th>
                  <th className="px-3 py-2">Comentario</th>
                  <th className="px-3 py-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((survey) => {
                  const statusMeta = getSurveyStatusMeta(survey.status);
                  const StatusIcon = statusMeta.icon;

                  return (
                    <tr key={survey.id} className="border-t border-border">
                      <td className="px-3 py-2 align-middle">
                        <div className="font-medium">{survey.patientNameSnapshot}</div>
                      </td>
                      <td className="px-3 py-2 align-middle">{survey.phoneMasked}</td>
                      <td className="px-3 py-2 align-middle">{formatDate(survey.attendanceAt)}</td>
                      <td className="px-3 py-2 align-middle">{survey.doctorNameSnapshot}</td>
                      <td className="px-3 py-2 align-middle">{survey.rating ?? "-"}</td>
                      <td className="px-3 py-2 align-middle">
                        {survey.comment ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setCommentDialogSurvey(survey)}
                          >
                            Comentarios
                          </Button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle text-center">
                        <span
                          className="inline-flex"
                          title={statusMeta.label}
                          aria-label={statusMeta.label}
                        >
                          <StatusIcon className={`size-4 ${statusMeta.className}`} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Pagina {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </Button>
            <Button
              type="button"
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

      <Dialog
        open={importDialogOpen}
        onClose={clearImportDialog}
        title="Importar encuestas"
        description="Carga el Excel, valida las filas y confirma la creacion para iniciar los envios."
        className="max-w-5xl"
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
            <Button type="button" onClick={() => void uploadPreview()} disabled={previewLoading}>
              {previewLoading ? "Procesando..." : "Validar archivo"}
            </Button>
          </div>

          {selectedFile ? (
            <p className="text-sm text-muted-foreground">Archivo seleccionado: {selectedFile.name}</p>
          ) : null}

          {previewError ? <p className="text-sm text-destructive">{previewError}</p> : null}

          {preview ? (
            <div className="space-y-4">
              <Card className="grid gap-3 p-4 md:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Registros</p>
                  <p className="mt-1 text-lg font-semibold">{preview.summary.totalRows}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Validos</p>
                  <p className="mt-1 text-lg font-semibold">{preview.summary.validRows}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Duplicados</p>
                  <p className="mt-1 text-lg font-semibold">{preview.summary.duplicateRows}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Invalidos</p>
                  <p className="mt-1 text-lg font-semibold">{preview.summary.invalidRows}</p>
                </div>
              </Card>

              <div className="max-h-[420px] overflow-auto border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/70 text-left">
                    <tr>
                      <th className="px-3 py-2">Incluir</th>
                      <th className="px-3 py-2">Paciente</th>
                      <th className="px-3 py-2">Numero</th>
                      <th className="px-3 py-2">Atencion</th>
                      <th className="px-3 py-2">Doctor</th>
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
                        <td className="px-3 py-2">{row.patientNameSnapshot}</td>
                        <td className="px-3 py-2">{row.phoneRaw}</td>
                        <td className="px-3 py-2">
                          {row.attendanceAt ? formatDate(row.attendanceAt) : "-"}
                        </td>
                        <td className="px-3 py-2">{row.doctorNameSnapshot}</td>
                        <td className="px-3 py-2">
                          {row.valid ? (
                            <Badge variant="success">Valida</Badge>
                          ) : row.duplicate ? (
                            <Badge variant="muted">Duplicada</Badge>
                          ) : (
                            <div className="space-y-1 text-xs text-destructive">
                              {row.errors.map((error) => (
                                <p key={error}>{error}</p>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={clearImportDialog}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void createCampaign()}
                  disabled={creatingCampaign}
                >
                  {creatingCampaign ? "Creando..." : "Crear e iniciar"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={Boolean(commentDialogSurvey)}
        onClose={() => setCommentDialogSurvey(null)}
        title="Comentario del paciente"
        description={
          commentDialogSurvey
            ? `${commentDialogSurvey.patientNameSnapshot} - ${formatDate(commentDialogSurvey.attendanceAt)}`
            : undefined
        }
        className="max-w-xl"
      >
        <div className="space-y-4">
          <Card className="bg-muted/30 p-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
              {commentDialogSurvey?.comment}
            </p>
          </Card>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setCommentDialogSurvey(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
