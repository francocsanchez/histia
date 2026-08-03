import { notFound, redirect } from "next/navigation";

import { AttentionForm } from "@/components/shared/attention-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireSessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/api";
import { can } from "@/lib/permissions";
import { getAttentionById } from "@/services/atenciones";

export default async function EditarAtencionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();

  if (!can(user, "atenciones", "write")) {
    redirect("/inicio");
  }

  const { id } = await params;
  let attention;

  try {
    attention = await getAttentionById(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }

    throw error;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar atencion"
        description="Actualiza fecha, paciente y lineas de la atencion registrada."
      />
      <AttentionForm mode="edit" initialAttention={attention} />
    </div>
  );
}
