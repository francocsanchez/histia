import { AppError, fromUnknownError, ok } from "@/lib/api";
import { requireApiSessionUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { can } from "@/lib/permissions";
import {
  appendWhatsAppConnectionEvent,
  claimSurveyForManualSend,
  releaseManualSurveyLease,
} from "@/services/surveys";

function getWorkerUrl() {
  const env = getServerEnv();
  return (
    env.WHATSAPP_WORKER_URL ??
    `http://127.0.0.1:${env.WHATSAPP_WORKER_PORT ?? 3010}`
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let lease: Awaited<ReturnType<typeof claimSurveyForManualSend>> | null = null;

  try {
    const user = await requireApiSessionUser(request.headers);

    if (!can(user, "encuestas", "write")) {
      throw new AppError("FORBIDDEN", "No tenes permisos para enviar encuestas", 403);
    }

    const { id } = await context.params;
    lease = await claimSurveyForManualSend(id);

    const response = await fetch(new URL("/send-survey", getWorkerUrl()), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surveyId: String(lease._id) }),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      releaseLease?: boolean;
      error?: string;
      data?: { providerMessageId?: string };
    } | null;

    if (!response.ok || !payload?.ok) {
      if (payload?.releaseLease === false) {
        lease = null;
      }

      throw new AppError(
        "INTERNAL_ERROR",
        payload?.error || "El worker de WhatsApp no pudo enviar la encuesta",
        503,
      );
    }

    return ok({
      surveyId: String(lease._id),
      providerMessageId: payload.data?.providerMessageId ?? null,
    });
  } catch (error) {
    if (lease) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await releaseManualSurveyLease({
        surveyId: String(lease._id),
        previousStatus: lease.status === "send_failed" ? "send_failed" : "queued",
        errorMessage,
      });
      await appendWhatsAppConnectionEvent({
        source: "api",
        eventType: "manual_survey_dispatch_unavailable",
        message: `No se pudo entregar al worker la encuesta ${String(lease._id)}.`,
        details: {
          trigger: "manual",
          surveyId: String(lease._id),
          error: errorMessage,
        },
      });
    }

    return fromUnknownError(error);
  }
}
