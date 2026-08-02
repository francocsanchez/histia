import * as React from "react";

import { cn } from "@/lib/utils";

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full border border-input bg-white px-3 text-sm text-foreground",
        className,
      )}
      {...props}
    />
  );
}
