/** @jsxImportSource react */
import type { ComponentProps } from "react";

export type TextInputProps = ComponentProps<"input"> & {
  label?: string;
  hint?: string;
};

export function TextInput({ label, hint, className, ref, ...rest }: TextInputProps) {
  return (
    <label className="block">
      {label ? (
        <div className="mb-1 text-xs font-medium text-dls-secondary">
          {label}
        </div>
      ) : null}
      <input
        ref={ref}
        className={`w-full rounded-lg bg-dls-surface px-3 py-2 text-sm text-dls-text placeholder:text-dls-secondary border border-dls-border shadow-sm focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--ij-accent)_20%,transparent)] ${
          className ?? ""
        }`.trim()}
        {...rest}
      />
      {hint ? (
        <div className="mt-1 text-xs text-dls-secondary">{hint}</div>
      ) : null}
    </label>
  );
}
