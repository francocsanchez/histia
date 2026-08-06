import { DashboardStats } from "@/components/shared/dashboard-stats";
import { PageHeader } from "@/components/shared/page-header";

export default function InicioPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inicio"
        description="Seguimiento mensual de atenciones y estados cargados por cada usuario."
      />

      <DashboardStats />
    </div>
  );
}
