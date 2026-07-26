// SOURCING: none. Pure logic, no upstream component applies.
// SPEC-COMMONPLACE-CONSOLE-SHELL-1.1 CS17: mono type audit.
// Walks a block subtree and warns when mono appears on human prose.

export interface MonoUsageSample {
  readonly el: Element;
  readonly text: string;
  readonly fontFamily: string;
  readonly source: 'class' | 'computed';
}

export interface TypeAuditResult {
  readonly samples: readonly MonoUsageSample[];
  readonly ok: boolean;
  readonly warnings: readonly string[];
}

const MONO_CLASS = 'font-ij-mono';
const MONO_FAMILY = /\b(mono|monospace|jetbrains|ibm plex mono|sfmono|source code pro|fira code|menlo|consolas|roboto mono)\b/i;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*(?:(?:[.:/@-]|::)[A-Za-z0-9_$-]+)*$/;
const MACHINE_VALUE = /^(?:true|false|null|undefined|nan|g?\d+(?:\.\d+)?%?|[a-f0-9]{7,}|[a-z]+_[a-z0-9_]+)$/i;
const PATH_VALUE = /^(?:~?\/|\.{1,2}\/|[A-Za-z]:\\|[A-Za-z0-9_.-]+\/)[^\s]*$/;

function textOf(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function hasMonoClass(el: Element): boolean {
  const classes = (el.getAttribute('class') ?? '').split(/\s+/);
  return classes.includes(MONO_CLASS);
}

function monoSource(el: Element): MonoUsageSample['source'] | null {
  if (hasMonoClass(el)) return 'class';
  const fontFamily = getComputedStyle(el).fontFamily;
  return MONO_FAMILY.test(fontFamily) ? 'computed' : null;
}

function isMarkedOk(el: Element): boolean {
  return Boolean(el.closest('[data-mono-ok]'));
}

function looksLikeMachineText(text: string): boolean {
  if (!text) return true;
  if (PATH_VALUE.test(text)) return true;
  if (IDENTIFIER.test(text)) return true;
  if (MACHINE_VALUE.test(text)) return true;
  if (/^[A-Za-z0-9_.:/@-]+$/.test(text) && /[_.:/@-]/.test(text)) return true;
  return false;
}

export function auditMonoUsage(root: Element): TypeAuditResult {
  const samples: MonoUsageSample[] = [];
  const nodes = [root, ...Array.from(root.querySelectorAll('*'))];

  for (const el of nodes) {
    if (isMarkedOk(el)) continue;
    const source = monoSource(el);
    if (!source) continue;
    const text = textOf(el);
    if (looksLikeMachineText(text)) continue;
    samples.push({
      el,
      text,
      fontFamily: getComputedStyle(el).fontFamily,
      source,
    });
  }

  const warnings = samples.map((sample) => (
    `Mono type on prose "${sample.text.slice(0, 80)}". Mark identifiers and paths with data-mono-ok, or use the human face.`
  ));

  return {
    samples,
    ok: samples.length === 0,
    warnings,
  };
}

export function runDevTypeAudit(root: Element | null): void {
  if (process.env.NODE_ENV === 'production' || !root) return;
  const result = auditMonoUsage(root);
  for (const warning of result.warnings) {
    console.warn('[type-audit]', warning);
  }
}
