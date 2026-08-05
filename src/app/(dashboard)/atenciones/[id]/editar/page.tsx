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
  searchParams: Promise<{ admin?: string }>;
}) {
  const user = await requireSessionUser();

  if (!can(user, "atenciones", "write")) {
    redirect("/inicio");
  }

  const { id } = await params;
  const { admin } = await searchParams;
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
        returnPath={isAdministrative ? "/liquidaciones" : "/atenciones"}
      />
    </div>
  );
}
