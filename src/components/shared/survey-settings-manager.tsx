"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SurveySettingsDto } from "@/types/domain";

type SettingsPayload = {
  success: boolean;
  data: SurveySettingsDto;
  error?: { message?: string };
};

export function SurveySettingsManager() {
  const [settings, setSettings] = useState<SurveySettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadSettings = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/encuestas/settings", { cache: "no-store" });
      const payload = (await response.json()) as SettingsPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar la configuracion");
      }

      setSettings(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const loadSettingsFromEffect = useEffectEvent(async () => {
    await loadSettings();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSettingsFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const saveSettings = async () => {
    if (!settings) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/encuestas/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = (await response.json()) as SettingsPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo guardar la configuracion");
      }

      setSettings(payload.data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mensajes encuestas"
        description="Edita los parametros operativos y los textos que usa WhatsApp para las encuestas."
      />

      {loading ? <LoadingState label="Cargando configuracion..." /> : null}
      {!loading && error ? <ErrorState label={error} retry={() => void loadSettings()} /> : null}

      {!loading && settings ? (
        <Card className="space-y-4 p-4">
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
                    current ? { ...current, phoneForAppointments: event.target.value } : current,
                  )
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Delay entre envios (seg)</label>
              <Input
                type="number"
                min={15}
                max={3600}
                value={settings.sendIntervalSeconds}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? { ...current, sendIntervalSeconds: Number(event.target.value || 0) }
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
              <label className="mb-2 block text-sm font-medium">No respuesta (horas)</label>
              <Input
                type="number"
                min={1}
                max={168}
                value={settings.noResponseTimeoutHours}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? { ...current, noResponseTimeoutHours: Number(event.target.value || 0) }
                      : current,
                  )
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Reintentos tecnicos</label>
              <Input
                type="number"
                min={0}
                max={10}
                value={settings.technicalRetryLimit}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? { ...current, technicalRetryLimit: Number(event.target.value || 0) }
                      : current,
                  )
                }
              />
            </div>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Mensaje inicial encuesta</label>
              <textarea
                className="min-h-32 w-full border border-border bg-background px-3 py-2 text-sm"
                value={settings.surveyIntroTemplate}
                onChange={(event) =>
                  setSettings((current) =>
                    current ? { ...current, surveyIntroTemplate: event.target.value } : current,
                  )
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Mensaje oferta de comentario</label>
              <textarea
                className="min-h-24 w-full border border-border bg-background px-3 py-2 text-sm"
                value={settings.commentOptInTemplate}
                onChange={(event) =>
                  setSettings((current) =>
                    current ? { ...current, commentOptInTemplate: event.target.value } : current,
                  )
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Mensaje pedir comentario</label>
              <textarea
                className="min-h-24 w-full border border-border bg-background px-3 py-2 text-sm"
                value={settings.commentRequestTemplate}
                onChange={(event) =>
                  setSettings((current) =>
                    current ? { ...current, commentRequestTemplate: event.target.value } : current,
                  )
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Mensaje agradecimiento</label>
              <textarea
                className="min-h-24 w-full border border-border bg-background px-3 py-2 text-sm"
                value={settings.thankYouTemplate}
                onChange={(event) =>
                  setSettings((current) =>
                    current ? { ...current, thankYouTemplate: event.target.value } : current,
                  )
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Mensaje rating invalido</label>
              <textarea
                className="min-h-24 w-full border border-border bg-background px-3 py-2 text-sm"
                value={settings.invalidRatingTemplate}
                onChange={(event) =>
                  setSettings((current) =>
                    current ? { ...current, invalidRatingTemplate: event.target.value } : current,
                  )
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Mensaje comentario invalido</label>
              <textarea
                className="min-h-24 w-full border border-border bg-background px-3 py-2 text-sm"
                value={settings.invalidCommentOptInTemplate}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? { ...current, invalidCommentOptInTemplate: event.target.value }
                      : current,
                  )
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Mensaje multimedia no soportado</label>
              <textarea
                className="min-h-24 w-full border border-border bg-background px-3 py-2 text-sm"
                value={settings.unsupportedCommentTemplate}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? { ...current, unsupportedCommentTemplate: event.target.value }
                      : current,
                  )
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Mensaje espontaneo</label>
              <textarea
                className="min-h-24 w-full border border-border bg-background px-3 py-2 text-sm"
                value={settings.spontaneousMessageTemplate}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? { ...current, spontaneousMessageTemplate: event.target.value }
                      : current,
                  )
                }
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={() => void saveSettings()} disabled={saving}>
              {saving ? "Guardando..." : "Guardar configuracion"}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
