import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-ij-arc border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none focus-visible:border-ij-accent focus-visible:ring-2 focus-visible:ring-ij-accent disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-ij-error [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-ij-accent text-ij-ink-bright hover:bg-ij-accent-hover",
        outline:
          "border-ij-control-border bg-ij-editor text-ij-ink hover:bg-ij-hover-surface aria-expanded:bg-ij-hover-surface",
        secondary:
          "border-ij-seam bg-ij-chrome text-ij-ink hover:bg-ij-hover-surface aria-expanded:bg-ij-hover-surface",
        ghost:
          "text-ij-ink hover:bg-ij-hover-surface aria-expanded:bg-ij-hover-surface",
        destructive:
          "bg-ij-error-bg text-ij-error hover:bg-ij-hover-surface focus-visible:border-ij-error focus-visible:ring-ij-error",
        link: "text-ij-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-ij-control gap-1.5 px-2.5",
        xs: "h-6 gap-1 rounded-ij-arc px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-ij-arc px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-3",
        icon: "size-ij-control",
        "icon-xs": "size-6 rounded-ij-arc [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-ij-arc",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
