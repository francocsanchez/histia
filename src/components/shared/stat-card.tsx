import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Card className={`surface-grid ${compact ? "p-4" : "p-5"}`}>
      <p className={compact ? "text-xs leading-4 text-muted-foreground" : "text-sm text-muted-foreground"}>{label}</p>
      <p className={`${compact ? "mt-3 text-3xl" : "mt-4 text-4xl"} whitespace-nowrap font-semibold tracking-tight`}>{value}</p>
    </Card>
  );
}
