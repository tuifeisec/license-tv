import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Option = {
  label: string;
  value: string;
};

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Option[];
  placeholder?: string;
}

export function Select({ className, options, placeholder, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "ring-focus flex h-10 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
