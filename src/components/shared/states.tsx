import { Card } from "@/components/ui/card";

export function LoadingState({ label = "Cargando..." }: { label?: string }) {
  return <Card className="p-6 text-sm text-muted-foreground">{label}</Card>;
}

export function EmptyState({ label }: { label: string }) {
  return <Card className="p-6 text-sm text-muted-foreground">{label}</Card>;
}

export function ErrorState({
  label,
  retry,
}: {
  label: string;
  retry?: () => void;
}) {
  return (
    <Card className="p-6 text-sm text-destructive">
      <div className="flex items-center justify-between gap-4">
        <span>{label}</span>
        {retry ? (
          <button className="text-foreground underline" onClick={retry}>
            Reintentar
          </button>
        ) : null}
      </div>
    </Card>
  );
}
