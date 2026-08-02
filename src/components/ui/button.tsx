import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap border text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border-primary bg-primary px-4 py-2 text-primary-foreground hover:opacity-90",
        secondary:
          "border-border bg-card px-4 py-2 text-foreground hover:bg-accent",
        ghost: "border-transparent px-3 py-2 text-foreground hover:bg-accent",
        destructive:
          "border-destructive bg-destructive px-4 py-2 text-white hover:opacity-90",
      },
      size: {
        sm: "h-9",
        md: "h-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
