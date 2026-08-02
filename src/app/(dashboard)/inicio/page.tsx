import { Card } from "@/components/ui/card";
import { DashboardStats } from "@/components/shared/dashboard-stats";
import { PageHeader } from "@/components/shared/page-header";

export default function InicioPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inicio"
        description="Resumen administrativo de la base maestra de Histia."
      />

      <DashboardStats />

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Alcance actual</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Esta version administra usuarios, obras sociales, codigos y pacientes.
          No incluye turnos, agendas ni calendarios, y deja preparada la base para
          incorporar atenciones y liquidaciones en etapas posteriores.
        </p>
      </Card>
    </div>
  );
}
