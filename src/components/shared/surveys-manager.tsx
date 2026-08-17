"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import {
  SurveyCampaignDto,
  SurveyDto,
  SurveySettingsDto,
  WhatsAppConnectionDto,
} from "@/types/domain";

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

type CampaignListPayload = {
  success: boolean;
  data: SurveyCampaignDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
};

type CampaignDetailPayload = {
  success: boolean;
  data: {
    campaign: SurveyCampaignDto;
    surveys: SurveyDto[];
  };
  error?: { message?: string };
};

type SettingsPayload = {
  success: boolean;
  data: SurveySettingsDto;
  error?: { message?: string };
};

type WhatsAppPayload = {
  success: boolean;
  data: WhatsAppConnectionDto;
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

type CampaignAction = "start" | "pause" | "resume" | "cancel";

function getCampaignActionButtons(campaign: SurveyCampaignDto | null): CampaignAction[] {
  if (!campaign) {
    return [];
  }

  if (campaign.status === "ready") {
    return ["start", "cancel"];
  }

  if (campaign.status === "running") {
    return ["pause", "cancel"];
  }

  if (campaign.status === "paused") {
    return ["resume", "cancel"];
  }

  return [];
}

export function SurveysManager() {
  const [campaigns, setCampaigns] = useState<SurveyCampaignDto[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState("");
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
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaignDetail, setCampaignDetail] = useState<CampaignDetailPayload["data"] | null>(null);
  const [campaignDetailLoading, setCampaignDetailLoading] = useState(false);
  const [campaignActionLoading, setCampaignActionLoading] = useState(false);
  const [settings, setSettings] = useState<SurveySettingsDto | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [whatsApp, setWhatsApp] = useState<WhatsAppConnectionDto | null>(null);
  const [whatsAppLoading, setWhatsAppLoading] = useState(true);
  const [whatsAppBusy, setWhatsAppBusy] = useState(false);

  const loadCampaigns = async () => {
    setCampaignsLoading(true);
    setCampaignsError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
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
      const payload = (await response.json()) as CampaignListPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar el listado");
      }

      setCampaigns(payload.data);
      setTotalPages(payload.pagination.totalPages);
      setTotals(
        JSON.parse(response.headers.get("x-surveys-totals") || JSON.stringify(emptyTotals)),
      );
      if (!selectedCampaignId && payload.data[0]) {
        setSelectedCampaignId(payload.data[0].id);
      }
    } catch (error) {
      setCampaignsError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setCampaignsLoading(false);
    }
  };

  const loadSettings = async () => {
    setSettingsLoading(true);
    setSettingsError("");

    try {
      const response = await fetch("/api/encuestas/settings", { cache: "no-store" });
      const payload = (await response.json()) as SettingsPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar la configuracion");
      }

      setSettings(payload.data);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSettingsLoading(false);
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

  const loadCampaignDetail = async (campaignId: string) => {
    if (!campaignId) {
      setCampaignDetail(null);
      return;
    }

    setCampaignDetailLoading(true);

    try {
      const response = await fetch(`/api/encuestas/campaigns/${campaignId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as CampaignDetailPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar el detalle de la campana");
      }

      setCampaignDetail(payload.data);
    } finally {
      setCampaignDetailLoading(false);
    }
  };

  const loadCampaignsFromEffect = useEffectEvent(async () => {
    await loadCampaigns();
  });

  const loadSettingsFromEffect = useEffectEvent(async () => {
    await loadSettings();
  });

  const loadWhatsAppFromEffect = useEffectEvent(async () => {
    await loadWhatsApp();
  });

  const loadCampaignDetailFromEffect = useEffectEvent(async () => {
    await loadCampaignDetail(selectedCampaignId);
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCampaignsFromEffect();
      void loadSettingsFromEffect();
      void loadWhatsAppFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCampaignsFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [page, search, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCampaignDetailFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [selectedCampaignId]);

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

      setPreview(null);
      setSelectedFile(null);
      await loadCampaigns();
      if (payload.data?.campaign?.id) {
        setSelectedCampaignId(payload.data.campaign.id);
      }
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setCreatingCampaign(false);
    }
  };

  const runCampaignAction = async (action: "start" | "pause" | "resume" | "cancel") => {
    if (!selectedCampaignId) {
      return;
    }

    setCampaignActionLoading(true);

    try {
      const response = await fetch(`/api/encuestas/campaigns/${selectedCampaignId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo ejecutar la accion");
      }

      setCampaignDetail(payload.data);
      await loadCampaigns();
    } finally {
      setCampaignActionLoading(false);
    }
  };

  const cancelSurvey = async (surveyId: string) => {
    setCampaignActionLoading(true);

    try {
      const response = await fetch(`/api/encuestas/surveys/${surveyId}/cancel`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cancelar la encuesta");
      }

      await loadCampaignDetail(selectedCampaignId);
      await loadCampaigns();
    } finally {
      setCampaignActionLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) {
      return;
    }

    setSettingsSaving(true);
    setSettingsError("");

    try {
      const response = await fetch("/api/encuestas/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo guardar la configuracion");
      }

      setSettings(payload.data);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSettingsSaving(false);
    }
  };

  const disconnectWhatsApp = async () => {
    setWhatsAppBusy(true);

    try {
      const response = await fetch("/api/encuestas/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo solicitar la desvinculacion");
      }

      setWhatsApp(payload.data);
    } finally {
      setWhatsAppBusy(false);
    }
  };

  const prepareWhatsAppQr = async () => {
    setWhatsAppBusy(true);

    try {
      const response = await fetch("/api/encuestas/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare-qr" }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo preparar un QR nuevo");
      }

      setWhatsApp(payload.data);
      window.setTimeout(() => {
        void loadWhatsApp();
      }, 2500);
    } finally {
      setWhatsAppBusy(false);
    }
  };

  const actionButtons = getCampaignActionButtons(campaignDetail?.campaign ?? null);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Encuestas"
        description="Importa atenciones desde Excel, administra campañas y controla la conexión de WhatsApp."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Pendientes</p>
          <p className="mt-2 text-2xl font-semibold">{totals.queued}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Esperando respuesta</p>
          <p className="mt-2 text-2xl font-semibold">{totals.waiting}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Finalizadas</p>
          <p className="mt-2 text-2xl font-semibold">{totals.completed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Sin respuesta</p>
          <p className="mt-2 text-2xl font-semibold">{totals.noResponse}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Fallidas</p>
          <p className="mt-2 text-2xl font-semibold">{totals.sendFailed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Delivery incierto</p>
          <p className="mt-2 text-2xl font-semibold">{totals.deliveryUnknown}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="space-y-6">
          <Card className="space-y-4 p-4">
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

                <div className="overflow-x-auto border border-border">
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
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setPreview(null);
                      setPreviewError("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void createCampaign()}
                    disabled={creatingCampaign}
                  >
                    {creatingCampaign ? "Creando..." : "Crear campaña"}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <Input
                placeholder="Buscar por archivo"
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
                <option value="">Todos los estados</option>
                <option value="ready">Lista</option>
                <option value="running">En curso</option>
                <option value="paused">Pausada</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
                <option value="error">Error</option>
              </Select>
            </div>

            {campaignsLoading ? <LoadingState label="Cargando campañas..." /> : null}
            {!campaignsLoading && campaignsError ? (
              <ErrorState label={campaignsError} retry={() => void loadCampaigns()} />
            ) : null}
            {!campaignsLoading && !campaignsError && campaigns.length === 0 ? (
              <EmptyState label="Todavia no hay campañas de encuestas." />
            ) : null}

            {!campaignsLoading && !campaignsError && campaigns.length > 0 ? (
              <div className="overflow-x-auto border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/70 text-left">
                    <tr>
                      <th className="px-3 py-2">Archivo</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Validas</th>
                      <th className="px-3 py-2">Esperando</th>
                      <th className="px-3 py-2">Finalizadas</th>
                      <th className="px-3 py-2">Creada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign) => (
                      <tr
                        key={campaign.id}
                        className={`cursor-pointer border-t border-border ${
                          selectedCampaignId === campaign.id ? "bg-primary/5" : ""
                        }`}
                        onClick={() => setSelectedCampaignId(campaign.id)}
                      >
                        <td className="px-3 py-2 font-medium">{campaign.fileName}</td>
                        <td className="px-3 py-2">
                          <Badge variant={campaign.status === "completed" ? "success" : "default"}>
                            {campaign.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">{campaign.validRows}</td>
                        <td className="px-3 py-2">{campaign.waitingCount}</td>
                        <td className="px-3 py-2">{campaign.completedCount}</td>
                        <td className="px-3 py-2">{formatDate(campaign.createdAt)}</td>
                      </tr>
                    ))}
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
        </div>

        <div className="space-y-6">
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">WhatsApp Encuestas</h2>
                <p className="text-sm text-muted-foreground">
                  Conexion persistente del worker de encuestas.
                </p>
              </div>
              {whatsAppLoading ? null : (
                <Badge variant={whatsApp?.status === "connected" ? "success" : "default"}>
                  {whatsApp?.status ?? "desconocido"}
                </Badge>
              )}
            </div>

            {whatsAppLoading ? <LoadingState label="Consultando WhatsApp..." /> : null}
            {!whatsAppLoading && whatsApp ? (
              <div className="space-y-3 text-sm">
                <p>Numero vinculado: {whatsApp.phoneNumber ?? "Sin vincular"}</p>
                <p>Ultima conexion: {whatsApp.lastConnectedAt ? formatDate(whatsApp.lastConnectedAt) : "-"}</p>
                <p>Ultima desconexion: {whatsApp.lastDisconnectedAt ? formatDate(whatsApp.lastDisconnectedAt) : "-"}</p>
                {whatsApp.lastError ? (
                  <Card className="border-destructive/30 bg-destructive/5 p-3 text-destructive">
                    {whatsApp.lastError}
                  </Card>
                ) : null}
                {whatsApp.qrDataUrl ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">QR disponible</p>
                    <Image
                      src={whatsApp.qrDataUrl}
                      alt="QR de WhatsApp"
                      width={320}
                      height={320}
                      className="w-full max-w-xs border border-border bg-white p-2"
                      unoptimized
                    />
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button type="button" onClick={openWhatsAppLinkTab}>
                    Vincular numero
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void prepareWhatsAppQr()}
                    disabled={whatsAppBusy}
                  >
                    Preparar QR
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void loadWhatsApp()}>
                    Actualizar estado
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void disconnectWhatsApp()}
                    disabled={whatsAppBusy}
                  >
                    {whatsAppBusy ? "Solicitando..." : "Desvincular"}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Detalle de campaña</h2>
                <p className="text-sm text-muted-foreground">
                  Encuestas creadas desde la importacion seleccionada.
                </p>
              </div>
              {campaignDetail?.campaign ? (
                <Badge variant={campaignDetail.campaign.status === "completed" ? "success" : "default"}>
                  {campaignDetail.campaign.status}
                </Badge>
              ) : null}
            </div>

            {campaignDetailLoading ? <LoadingState label="Cargando detalle..." /> : null}
            {!campaignDetailLoading && !campaignDetail ? (
              <EmptyState label="Selecciona una campaña para ver sus encuestas." />
            ) : null}

            {!campaignDetailLoading && campaignDetail ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Archivo</p>
                    <p className="mt-1 font-medium">{campaignDetail.campaign.fileName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Importada por</p>
                    <p className="mt-1 font-medium">{campaignDetail.campaign.importedByUserName}</p>
                  </div>
                </div>

                {actionButtons.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {actionButtons.includes("start") ? (
                      <Button
                        type="button"
                        onClick={() => void runCampaignAction("start")}
                        disabled={campaignActionLoading}
                      >
                        Iniciar envios
                      </Button>
                    ) : null}
                    {actionButtons.includes("pause") ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void runCampaignAction("pause")}
                        disabled={campaignActionLoading}
                      >
                        Pausar envios
                      </Button>
                    ) : null}
                    {actionButtons.includes("resume") ? (
                      <Button
                        type="button"
                        onClick={() => void runCampaignAction("resume")}
                        disabled={campaignActionLoading}
                      >
                        Reanudar envios
                      </Button>
                    ) : null}
                    {actionButtons.includes("cancel") ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => void runCampaignAction("cancel")}
                        disabled={campaignActionLoading}
                      >
                        Cancelar campaña
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <div className="max-h-[360px] overflow-auto border border-border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/70 text-left">
                      <tr>
                        <th className="px-3 py-2">Paciente</th>
                        <th className="px-3 py-2">Atencion</th>
                        <th className="px-3 py-2">Estado</th>
                        <th className="px-3 py-2">Rating</th>
                        <th className="px-3 py-2 text-right">Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignDetail.surveys.map((survey) => (
                        <tr key={survey.id} className="border-t border-border">
                          <td className="px-3 py-2">
                            <div className="font-medium">{survey.patientNameSnapshot}</div>
                            <div className="text-xs text-muted-foreground">{survey.phoneMasked}</div>
                          </td>
                          <td className="px-3 py-2">{formatDate(survey.attendanceAt)}</td>
                          <td className="px-3 py-2">
                            <Badge variant={survey.status === "completed" ? "success" : "default"}>
                              {survey.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">{survey.rating ?? "-"}</td>
                          <td className="px-3 py-2 text-right">
                            {["queued", "leased_for_send", "waiting_rating", "waiting_comment_opt_in", "waiting_comment_text"].includes(
                              survey.status,
                            ) ? (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => void cancelSurvey(survey.id)}
                                disabled={campaignActionLoading}
                              >
                                Cancelar
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-4 p-4">
            <div>
              <h2 className="text-lg font-semibold">Configuracion operativa</h2>
              <p className="text-sm text-muted-foreground">
                Parametros editables desde UI para el envio y los textos del modulo.
              </p>
            </div>

            {settingsLoading ? <LoadingState label="Cargando configuracion..." /> : null}
            {!settingsLoading && settingsError ? (
              <ErrorState label={settingsError} retry={() => void loadSettings()} />
            ) : null}

            {!settingsLoading && settings ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.surveysEnabled}
                      onChange={(event) =>
                        setSettings((current) =>
                          current ? { ...current, surveysEnabled: event.target.checked } : current,
                        )
                      }
                    />
                    Encuestas habilitadas
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.globalPause}
                      onChange={(event) =>
                        setSettings((current) =>
                          current ? { ...current, globalPause: event.target.checked } : current,
                        )
                      }
                    />
                    Pausa global
                  </label>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Numero de turnos</label>
                    <Input
                      value={settings.phoneForAppointments}
                      onChange={(event) =>
                        setSettings((current) =>
                          current
                            ? { ...current, phoneForAppointments: event.target.value }
                            : current,
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Intervalo de envio (seg)</label>
                    <Input
                      type="number"
                      value={settings.sendIntervalSeconds}
                      onChange={(event) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                sendIntervalSeconds: Number(event.target.value || current.sendIntervalSeconds),
                              }
                            : current,
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Horario inicio</label>
                    <Input
                      value={settings.sendWindowStart}
                      onChange={(event) =>
                        setSettings((current) =>
                          current ? { ...current, sendWindowStart: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Horario fin</label>
                    <Input
                      value={settings.sendWindowEnd}
                      onChange={(event) =>
                        setSettings((current) =>
                          current ? { ...current, sendWindowEnd: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Timeout sin respuesta (hs)</label>
                    <Input
                      type="number"
                      value={settings.noResponseTimeoutHours}
                      onChange={(event) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                noResponseTimeoutHours: Number(
                                  event.target.value || current.noResponseTimeoutHours,
                                ),
                              }
                            : current,
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Reintentos tecnicos</label>
                    <Input
                      type="number"
                      value={settings.technicalRetryLimit}
                      onChange={(event) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                technicalRetryLimit: Number(
                                  event.target.value || current.technicalRetryLimit,
                                ),
                              }
                            : current,
                        )
                      }
                    />
                  </div>
                </div>

                {[
                  ["surveyIntroTemplate", "Mensaje inicial"],
                  ["commentOptInTemplate", "Pregunta comentario"],
                  ["commentRequestTemplate", "Pedido de comentario"],
                  ["thankYouTemplate", "Agradecimiento"],
                  ["invalidRatingTemplate", "Recordatorio rating"],
                  ["invalidCommentOptInTemplate", "Recordatorio 1/2"],
                  ["unsupportedCommentTemplate", "Mensaje multimedia no soportada"],
                  ["spontaneousMessageTemplate", "Mensaje espontaneo"],
                ].map(([field, label]) => (
                  <div key={field}>
                    <label className="mb-2 block text-sm font-medium">{label}</label>
                    <textarea
                      className="min-h-24 w-full border border-input bg-white px-3 py-2 text-sm"
                      value={settings[field as keyof SurveySettingsDto] as string}
                      onChange={(event) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                [field]: event.target.value,
                              }
                            : current,
                        )
                      }
                    />
                  </div>
                ))}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => void loadSettings()}>
                    Restaurar
                  </Button>
                  <Button type="button" onClick={() => void saveSettings()} disabled={settingsSaving}>
                    {settingsSaving ? "Guardando..." : "Guardar configuracion"}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
