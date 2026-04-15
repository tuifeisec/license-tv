import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 ring-focus disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-105",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        outline: "border border-border bg-card/70 text-foreground hover:bg-accent/70",
        ghost: "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-105",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-8 px-2.5 text-xs",
        sm: "h-9 px-3",
        default: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";
