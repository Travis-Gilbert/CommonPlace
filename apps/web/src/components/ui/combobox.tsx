"use client"

/**
 * Combobox: a searchable single-select option picker, composed from the existing
 * Command (cmdk), Popover (Base UI), and Button primitives. This is the
 * shadcn-linear-combobox pattern adopted onto our primitives (SPEC-UI-COMPONENT
 * -SOURCING addendum), not a hand-rolled equivalent: the reference component's
 * priority list becomes a controlled `{options, value, onChange}` contract so it
 * drives real property state instead of local demo state.
 *
 * Colored option dots read the `--tag-*` tokens so a status/tag picker stays
 * visually continuous with the chips those same options render as elsewhere.
 */

import * as React from "react"
import { CheckIcon } from '@/lib/icons'

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  /** stable identity written back through onChange. */
  readonly value: string
  /** human label shown in the list and on the trigger. */
  readonly label: string
  /** optional `--tag-*` hue name (grey/blue/green/...) for the leading dot. */
  readonly color?: string
}

export interface ComboboxProps {
  readonly options: readonly ComboboxOption[]
  /** currently selected value, or null when unset. */
  readonly value: string | null
  /** fired with the chosen value, or null when the selected option is cleared. */
  readonly onChange: (value: string | null) => void
  /** trigger label when nothing is selected. */
  readonly placeholder?: string
  /** search input placeholder. */
  readonly searchPlaceholder?: string
  /** empty-result text. */
  readonly emptyText?: string
  /** allow re-selecting the active option to clear it. Default true. */
  readonly clearable?: boolean
  readonly disabled?: boolean
  readonly className?: string
  /** trigger button width; defaults to fit-content. */
  readonly triggerClassName?: string
}

function OptionDot({ color }: { color?: string }) {
  if (!color) return null
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full"
      style={{ background: `var(--tag-${color})` }}
    />
  )
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  clearable = true,
  disabled,
  className,
  triggerClassName,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const selected = value != null ? options.find((o) => o.value === value) ?? null : null

  const pick = (next: string) => {
    if (clearable && next === value) onChange(null)
    else onChange(next)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={selected ? `${placeholder}: ${selected.label}` : placeholder}
            className={cn("w-fit justify-start font-medium", triggerClassName)}
          />
        }
      >
        {selected ? (
          <>
            <OptionDot color={selected.color} />
            {selected.label}
          </>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn("w-56 p-0", className)}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => pick(option.value)}
                  className="justify-between"
                >
                  <span className="flex items-center gap-2">
                    <OptionDot color={option.color} />
                    {option.label}
                  </span>
                  {option.value === value && <CheckIcon className="size-4 opacity-70" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
