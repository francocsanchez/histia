import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <Card className="surface-grid p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-4 text-4xl font-semibold tracking-tight">{value}</p>
    </Card>
  );
}
