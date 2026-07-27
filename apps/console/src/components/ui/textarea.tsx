import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-ij-arc border border-ij-control-border bg-ij-editor px-2.5 py-2 text-sm text-ij-ink outline-none placeholder:text-ij-ink-info focus-visible:border-ij-accent focus-visible:ring-2 focus-visible:ring-ij-accent disabled:cursor-not-allowed disabled:bg-ij-hover-surface disabled:opacity-50 aria-invalid:border-ij-error aria-invalid:ring-2 aria-invalid:ring-ij-error",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
