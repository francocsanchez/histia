import { redirect } from "next/navigation";

import { AttentionForm } from "@/components/shared/attention-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

type NuevaAtencionPageProps = {
  searchParams?: Promise<{
    dni?: string | string[];
  }>;
};

export default async function NuevaAtencionPage({
  searchParams,
}: NuevaAtencionPageProps) {
  const user = await requireSessionUser();
  const { dni } = (await searchParams) ?? {};
  const initialLookupDni = typeof dni === "string" ? dni : "";

  if (!can(user, "atenciones", "write")) {
    redirect("/inicio");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva atencion"
        description="Carga una atencion odontologica realizada y sus codigos asociados."
      />
      <AttentionForm mode="create" initialLookupDni={initialLookupDni} />
    </div>
  );
}
