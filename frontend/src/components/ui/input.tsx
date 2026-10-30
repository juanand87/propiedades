import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground h-9 w-full min-w-0 rounded border bg-white px-3 py-1 text-base outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "border-[var(--dashboard-input-border)] focus:border-[var(--dashboard-input-focus)] focus:ring-1 focus:ring-[var(--dashboard-input-focus)]",
        "aria-invalid:border-red-500 aria-invalid:ring-1 aria-invalid:ring-red-500",
        className
      )}
      {...props}
    />
  )
}

export { Input }
