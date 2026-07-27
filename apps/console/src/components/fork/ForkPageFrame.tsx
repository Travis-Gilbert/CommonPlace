// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// paths=frontend/src/pages/{Login,Invite,OnboardingFlow,WorkspaceSettings,Admin}.
// Structure adapted under MIT and retokened to the CommonPlace register.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { MaterialLayer } from '@/components/ground/MaterialLayer';

export function ForkPageFrame({
  eyebrow,
  title,
  description,
  children,
  aside,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly aside?: ReactNode;
}) {
  return (
    <main className="relative min-h-dvh overflow-hidden text-ij-ink">
      <MaterialLayer />
      <div className="relative z-10 mx-auto grid min-h-dvh max-w-6xl content-center gap-6 p-6">
        <header className="flex items-center justify-between gap-4">
          <Link href="/chat" className="text-lg text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            CommonPlace
          </Link>
          <Link href="/settings" className="text-ij-link hover:underline">
            Settings
          </Link>
        </header>
        <div className="grid overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-chrome shadow-ij-popover lg:grid-cols-3">
          <section className="grid content-start gap-5 p-6 lg:col-span-2">
            <header className="grid gap-2">
              <p className="text-xs uppercase tracking-wide text-ij-ink-info">{eyebrow}</p>
              <h1 className="text-2xl" style={{ fontWeight: 'var(--rec-weight-cap)' }}>{title}</h1>
              <p className="max-w-3xl text-ij-ink-info">{description}</p>
            </header>
            {children}
          </section>
          <aside className="border-t border-ij-seam bg-ij-editor p-6 lg:border-l lg:border-t-0">
            {aside ?? (
              <div className="grid gap-3 text-ij-ink-info">
                <p style={{ fontWeight: 'var(--rec-weight-cap)' }} className="text-ij-ink">
                  Two storage tiers
                </p>
                <p>PostgreSQL holds identity, membership, API keys, and billing.</p>
                <p>RustyRed holds documents, chat, memory, graph, plans, and receipts.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

export function ForkPanel({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-ij-arc border border-ij-seam bg-ij-editor p-4">
      <header className="grid gap-1">
        <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>{title}</h2>
        {description ? <p className="text-ij-ink-info">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function ForkField({
  label,
  hint,
  ...input
}: {
  readonly label: string;
  readonly hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1">
      <span style={{ fontWeight: 'var(--rec-weight-cap)' }}>{label}</span>
      <input
        className="h-ij-control rounded-ij-arc border border-ij-control-border bg-ij-editor px-2.5 text-ij-ink outline-none placeholder:text-ij-ink-info focus-visible:border-ij-accent focus-visible:ring-2 focus-visible:ring-ij-accent disabled:opacity-50"
        {...input}
      />
      {hint ? <span className="text-xs text-ij-ink-info">{hint}</span> : null}
    </label>
  );
}

export function ForkNotice({
  tone = 'info',
  children,
}: {
  readonly tone?: 'info' | 'error' | 'success';
  readonly children: ReactNode;
}) {
  const className = tone === 'error'
    ? 'border-ij-error text-ij-error'
    : tone === 'success'
      ? 'border-ij-success text-ij-success'
      : 'border-ij-control-border text-ij-ink-info';
  return (
    <p role="status" className={`rounded-ij-arc border bg-ij-raised p-3 ${className}`}>
      {children}
    </p>
  );
}
