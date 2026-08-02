// SOURCING: none. Pure logic, no upstream component applies.
//
// SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW3. Reads a console register token as a
// resolved colour string.
//
// Most surfaces bind tokens through CSS and never need this. Three do not:
// WebGL uniforms (@paper-design/shaders-react), xterm's ITheme, and the
// generative avatar palettes all take literal colour strings and would render
// `var(--ij-ink)` as an invalid colour. Resolving through the cascade keeps
// those surfaces on the one token truth instead of forcing a hex literal back
// into a component, and re-reading on theme change keeps them correct across
// a light/dark switch, which a frozen literal never was.

import { useEffect, useState } from "react";

/** Resolve one register token against the document root. */
export function readRegisterToken(name: string, fallback = "transparent"): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function readAll(names: readonly string[], fallback: string): string[] {
  return names.map((name) => readRegisterToken(name, fallback));
}

/**
 * Resolved values for the given tokens, refreshed when the register changes.
 *
 * The register switches by mutating `data-theme`/`class` on <html>, so an
 * attribute observer on the root is the signal. `names` is joined into the
 * effect key rather than passed by reference so a caller can pass an inline
 * array without re-subscribing every render.
 */
export function useRegisterTokens(names: readonly string[], fallback = "transparent"): string[] {
  const key = names.join(",");
  const [values, setValues] = useState(() => readAll(names, fallback));

  useEffect(() => {
    const tokens = key.split(",");
    const refresh = () => setValues(readAll(tokens, fallback));
    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, [key, fallback]);

  return values;
}
