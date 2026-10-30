import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded border bg-transparent px-3 py-2 text-base shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "border-[var(--dashboard-input-border)] focus-visible:border-[var(--dashboard-input-focus)] focus-visible:ring-1 focus-visible:ring-[var(--dashboard-input-focus)]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
