import { cn } from "@/lib/utils";

export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-1 text-xs font-medium",
        variant === "success" && "border-primary bg-primary/10 text-primary",
        variant === "muted" && "border-border bg-muted text-muted-foreground",
        variant === "default" && "border-border bg-card text-foreground",
      )}
    >
      {children}
    </span>
  );
}
