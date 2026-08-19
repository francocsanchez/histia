"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useState } from "react";

import { ErrorState, LoadingState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getVisibleWhatsAppPhoneNumber,
  getWhatsAppStatusPollingIntervalMs,
} from "@/lib/surveys";
import { formatDate } from "@/lib/utils";
import { WhatsAppConnectionDto } from "@/types/domain";

type WhatsAppPayload = {
  success: boolean;
  data: WhatsAppConnectionDto;
  error?: { message?: string };
};

export function WhatsAppLinkManager() {
  const [data, setData] = useState<WhatsAppConnectionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError("");

    try {
      const response = await fetch("/api/encuestas/whatsapp", {
        cache: "no-store",
      });
      const payload = (await response.json()) as WhatsAppPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar el estado de WhatsApp");
      }

      setData(payload.data);
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
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void load();
    }, getWhatsAppStatusPollingIntervalMs(data?.status));

    return () => window.clearInterval(interval);
  }, [data?.status]);

  const actionsLocked =
    busy ||
    data?.status === "disconnecting" ||
    (data?.desiredState === "stopped" && data?.status === "connecting");

  const visiblePhoneNumber = getVisibleWhatsAppPhoneNumber(data?.status, data?.phoneNumber);
  const canDisconnect = data?.desiredState !== "stopped";
  const canPrepareQr = data?.status !== "connecting" && data?.status !== "qr_required";

  const disconnectWhatsApp = async () => {
    setBusy(true);

    try {
      const response = await fetch("/api/encuestas/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const payload = (await response.json()) as WhatsAppPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo solicitar la desvinculacion");
      }

      setData(payload.data);
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error ? disconnectError.message : "Error inesperado",
      );
    } finally {
      setBusy(false);
    }
  };

  const prepareQr = async () => {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/encuestas/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare-qr" }),
      });
      const payload = (await response.json()) as WhatsAppPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo preparar un QR nuevo");
      }

      setData(payload.data);
      window.setTimeout(() => {
        void load();
      }, 2500);
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vincular WhatsApp"
        description="Usa esta pantalla dedicada para vincular o revisar el numero que se utilizara para las encuestas."
        actions={
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => void prepareQr()}
              disabled={actionsLocked || !canPrepareQr}
            >
              Preparar QR nuevo
            </Button>
            <Button type="button" variant="secondary" onClick={() => void load()}>
              Actualizar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void disconnectWhatsApp()}
              disabled={actionsLocked || !canDisconnect}
            >
              {busy ? "Solicitando..." : "Desvincular"}
            </Button>
          </div>
        }
      />

      {loading ? <LoadingState label="Consultando WhatsApp..." /> : null}
      {!loading && error ? <ErrorState label={error} retry={() => void load()} /> : null}

      {!loading && !error && data ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Estado de vinculacion</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  El worker mantiene esta sesion en segundo plano, sin depender del navegador.
                </p>
              </div>
              <Badge variant={data.status === "connected" ? "success" : "default"}>
                {data.status}
              </Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Numero vinculado</p>
                <p className="mt-2 text-lg font-semibold">
                  {visiblePhoneNumber ?? "Sin vincular"}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Ultima conexion</p>
                <p className="mt-2 text-lg font-semibold">
                  {data.lastConnectedAt ? formatDate(data.lastConnectedAt) : "-"}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Ultima desconexion</p>
                <p className="mt-2 text-lg font-semibold">
                  {data.lastDisconnectedAt ? formatDate(data.lastDisconnectedAt) : "-"}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">QR vigente hasta</p>
                <p className="mt-2 text-lg font-semibold">
                  {data.qrExpiresAt ? formatDate(data.qrExpiresAt) : "-"}
                </p>
              </Card>
            </div>

            {data.status === "error" && data.lastError ? (
              <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {data.lastError}
              </Card>
            ) : null}
          </Card>

          <Card className="flex flex-col items-center justify-center gap-4 p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">QR de vinculacion</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Si el estado requiere QR, escanealo desde WhatsApp en el telefono que usara encuestas.
              </p>
            </div>

            {data.status === "qr_required" && data.qrDataUrl ? (
              <Image
                src={data.qrDataUrl}
                alt="QR de vinculacion de WhatsApp"
                width={420}
                height={420}
                className="w-full max-w-[420px] border border-border bg-white p-4"
                unoptimized
              />
            ) : (
              <Card className="w-full max-w-[420px] p-8 text-center text-sm text-muted-foreground">
                {data.status === "connected"
                  ? "El numero ya esta vinculado. Si necesitas cambiar la sesion, usa `Preparar QR nuevo`."
                  : data.status === "disconnecting"
                    ? "Se esta limpiando la sesion actual. Espera unos segundos hasta que el worker termine de reiniciar la vinculacion."
                    : data.desiredState === "stopped"
                      ? "La integracion esta detenida. Usa `Preparar QR nuevo` para iniciar una vinculacion limpia."
                      : "No hay QR disponible en este momento. Usa `Preparar QR nuevo` y espera unos segundos para que el worker vuelva a iniciar la vinculacion."}
              </Card>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
