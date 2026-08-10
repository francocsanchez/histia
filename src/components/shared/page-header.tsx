import Link from "next/link";
import { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  actions,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {actionLabel && actionHref ? (
          <Link href={actionHref}>
            <Button type="button">{actionLabel}</Button>
          </Link>
        ) : null}
        {actionLabel && onAction && !actionHref ? (
          <Button type="button" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
