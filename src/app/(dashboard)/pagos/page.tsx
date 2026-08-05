import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function PagosPage() {
  const user = await requireSessionUser();

  if (!can(user, "pagos", "read")) {
    redirect("/inicio");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagos"
        description="Espacio reservado para el modulo de pagos."
      />
      <Card className="p-6 text-sm text-muted-foreground">
        aca se contruye la pagina de pagos
      </Card>
    </div>
  );
}
