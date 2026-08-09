import { notFound, redirect } from "next/navigation";

import { AttentionForm } from "@/components/shared/attention-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireSessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/api";
import { can, isAdmin } from "@/lib/permissions";
import { getAttentionById } from "@/services/atenciones";

export default async function EditarAtencionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    admin?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    obraSocialId?: string;
    userId?: string;
    attentionStatus?: string;
    page?: string;
  }>;
}) {
  const user = await requireSessionUser();

  if (!can(user, "atenciones", "write")) {
    redirect("/inicio");
  }

  const { id } = await params;
  const {
    admin,
    search,
    dateFrom,
    dateTo,
    obraSocialId,
    userId,
    attentionStatus,
    page,
  } = await searchParams;
  const isAdministrative = admin === "1" && isAdmin(user);
  let attention;

  try {
    attention = await getAttentionById(id, user);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }

    if (error instanceof AppError && error.code === "FORBIDDEN") {
      redirect("/atenciones");
    }

    throw error;
  }

  const returnParams = new URLSearchParams();

  if (search) returnParams.set("search", search);
  if (dateFrom) returnParams.set("dateFrom", dateFrom);
  if (dateTo) returnParams.set("dateTo", dateTo);
  if (obraSocialId) returnParams.set("obraSocialId", obraSocialId);
  if (userId) returnParams.set("userId", userId);
  if (attentionStatus) returnParams.set("attentionStatus", attentionStatus);
  if (page) returnParams.set("page", page);

  const returnPath = isAdministrative
    ? `/liquidaciones${returnParams.size > 0 ? `?${returnParams.toString()}` : ""}`
    : "/atenciones";

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAdministrative ? "Editar atencion administrativa" : "Editar atencion"}
        description={
          isAdministrative
            ? "Actualiza datos administrativos, importes y estados de la atencion."
            : "Actualiza fecha, paciente y lineas de la atencion registrada."
        }
      />
      <AttentionForm
        mode="edit"
        initialAttention={attention}
        isAdministrative={isAdministrative}
        returnPath={returnPath}
      />
    </div>
  );
}
