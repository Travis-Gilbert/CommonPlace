'use client';

// SOURCING: @commonplace/block-view capture data. The source artifact and the
// CommonPlace annotation strip are separate DOM layers by design. A held
// snapshot wins; typed source reconstructions are honest fallbacks only.

import type { CSSProperties } from 'react';
import type { SurveyCapture } from './surveyContract';

interface SourceCardStyle extends CSSProperties {
  '--survey-source-aspect': string;
}

function artifactLines(capture: SurveyCapture): readonly string[] {
  if (capture.sourceLines.length > 0) return capture.sourceLines;
  return capture.contentMarkdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function SourceHeader({ capture }: { capture: SurveyCapture }) {
  return (
    <div className="survey-source-header flex min-h-7 items-center gap-2 px-2 text-xs">
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ij-accent" />
      <span className="min-w-0 flex-1 truncate">{capture.domain}</span>
      <span className="truncate font-ij-mono text-ij-ink">{capture.sourceKind}</span>
    </div>
  );
}

function CodeArtifact({ capture }: { capture: SurveyCapture }) {
  return (
    <div className="survey-source-code flex h-full min-h-0 flex-col bg-ij-editor text-ij-ink">
      <SourceHeader capture={capture} />
      <div className="border-b border-ij-seam px-3 py-2 text-xs text-ij-ink">
        {capture.title}
      </div>
      <ol className="min-h-0 flex-1 overflow-hidden px-3 py-3 font-ij-mono text-xs" aria-label="Captured source lines">
        {artifactLines(capture).map((line, index) => (
          <li key={`${capture.id}-line-${index}`} className="survey-source-code-line grid gap-3 leading-relaxed">
            <span aria-hidden="true" className="select-none text-ij-ink-disabled">{index + 1}</span>
            <code className="truncate text-ij-ink">{line}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DocumentArtifact({ capture }: { capture: SurveyCapture }) {
  const [heading, ...body] = artifactLines(capture);
  return (
    <div className="survey-source-document h-full overflow-hidden bg-ij-raised text-ij-ink">
      <SourceHeader capture={capture} />
      <article className="survey-source-document-sheet mx-auto my-3 rounded-ij-arc-underline bg-ij-chrome px-4 py-5">
        <p className="font-ij-mono text-xs text-ij-ink">{capture.domain}</p>
        <h3 className="mt-3 text-lg leading-tight" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          {heading ?? capture.title}
        </h3>
        {body.map((line, index) => (
          <p key={`${capture.id}-paragraph-${index}`} className="mt-3 text-xs leading-relaxed text-ij-ink">
            {line}
          </p>
        ))}
      </article>
    </div>
  );
}

function ReceiptArtifact({ capture }: { capture: SurveyCapture }) {
  return (
    <div className="survey-source-receipt flex h-full flex-col bg-ij-chrome text-ij-ink">
      <SourceHeader capture={capture} />
      <div className="border-b border-ij-seam px-3 py-3">
        <p className="font-ij-mono text-xs uppercase tracking-wider text-ij-gold">Data Wave receipt</p>
        <h3 className="mt-1 text-sm" style={{ fontWeight: 'var(--rec-weight-cap)' }}>{capture.title}</h3>
      </div>
      <dl className="survey-source-receipt-grid grid flex-1 content-start gap-x-3 gap-y-2 px-3 py-3 font-ij-mono text-xs">
        {artifactLines(capture).map((line, index) => {
          const separator = line.indexOf(':');
          const key = separator >= 0 ? line.slice(0, separator) : `field_${index + 1}`;
          const value = separator >= 0 ? line.slice(separator + 1).trim() : line;
          return (
            <div key={`${capture.id}-fact-${index}`} className="survey-source-fact border-b border-ij-seam pb-2">
              <dt className="text-ij-ink">{key}</dt>
              <dd className="truncate text-ij-ink">{value}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function VisualizationArtifact({ capture }: { capture: SurveyCapture }) {
  return (
    <div className="survey-source-visualization flex h-full flex-col bg-ij-raised text-ij-ink">
      <SourceHeader capture={capture} />
      <div className="flex flex-1 items-center gap-4 px-4 py-4">
        <div className="survey-source-dot-field grid shrink-0 grid-cols-4 gap-2" aria-hidden="true">
          {Array.from({ length: 16 }, (_, index) => (
            <span
              key={`${capture.id}-dot-${index}`}
              className={index % 3 === 0 ? 'h-2 w-2 rounded-full bg-ij-gold' : 'h-2 w-2 rounded-full bg-ij-graph'}
            />
          ))}
        </div>
        <div className="min-w-0">
          <p className="font-ij-mono text-xs text-ij-gold">Observable Plot</p>
          <h3 className="mt-2 text-base" style={{ fontWeight: 'var(--rec-weight-cap)' }}>{capture.title}</h3>
          <ul className="mt-3 space-y-1 text-xs text-ij-ink">
            {artifactLines(capture).slice(1).map((line, index) => (
              <li key={`${capture.id}-visual-label-${index}`}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ArticleArtifact({ capture }: { capture: SurveyCapture }) {
  const lines = artifactLines(capture);
  return (
    <article className="survey-source-article flex h-full flex-col bg-ij-chrome p-4 text-ij-ink">
      <p className="font-ij-mono text-xs uppercase tracking-wider text-ij-ink">{capture.domain}</p>
      <h3 className="mt-4 text-xl leading-tight" style={{ fontWeight: 'var(--rec-weight-cap)' }}>{capture.title}</h3>
      <div className="my-4 h-px bg-ij-divider" />
      {lines.map((line, index) => (
        <p key={`${capture.id}-article-${index}`} className="mt-2 text-xs leading-relaxed text-ij-ink">{line}</p>
      ))}
    </article>
  );
}

export function SurveySourceArtifact({ capture }: { readonly capture: SurveyCapture }) {
  if (capture.sourceSnapshotUrl) {
    return (
      // Snapshot URLs are restricted to held root-relative or blob media by
      // surveyContract before reaching this renderer.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={capture.sourceSnapshotUrl}
        alt={capture.sourceSnapshotAlt ?? `Captured source: ${capture.title}`}
        data-source-preview-kind={capture.sourcePreviewKind ?? 'screenshot'}
        className="h-full w-full bg-ij-editor object-contain"
      />
    );
  }
  if (capture.sourceKind === 'code') return <CodeArtifact capture={capture} />;
  if (capture.sourceKind === 'document') return <DocumentArtifact capture={capture} />;
  if (capture.sourceKind === 'receipt') return <ReceiptArtifact capture={capture} />;
  if (capture.sourceKind === 'visualization') return <VisualizationArtifact capture={capture} />;
  return <ArticleArtifact capture={capture} />;
}

export function SurveySourceCard({
  capture,
  topicTitle,
  spatial = false,
  hovered = false,
  focus = 'idle',
  onOpen,
}: {
  readonly capture: SurveyCapture;
  readonly topicTitle: string;
  readonly spatial?: boolean;
  readonly hovered?: boolean;
  readonly focus?: 'idle' | 'focused' | 'related' | 'dimmed';
  readonly onOpen: () => void;
}) {
  const style: SourceCardStyle = { '--survey-source-aspect': String(4 / 3) };
  const org = capture.entities.find((entity) => !entity.startsWith('@')) ?? capture.entities[0];
  const person = capture.mentions[0];
  const contents = (
    <>
      <span className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <SurveySourceArtifact capture={capture} />
      </span>
      <span className="survey-source-annotations flex min-h-9 w-full shrink-0 flex-col justify-center gap-1 border-t border-ij-seam bg-ij-chrome px-2 py-1 text-xs">
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-ij-mono uppercase tracking-wider text-ij-gold">{capture.kind}</span>
          <span className="truncate text-ij-ink">{capture.domain}</span>
          <span className="ml-auto font-ij-mono uppercase tracking-wider text-ij-ink">{capture.sourceKind}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1">
          {capture.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="block max-w-28 truncate rounded-ij-arc-underline bg-ij-gold-tint px-1.5 py-0.5 text-ij-gold"
            >
              {tag}
            </span>
          ))}
          {org ? (
            <span className="block max-w-28 truncate rounded-ij-arc-underline bg-ij-selection px-1.5 py-0.5 text-ij-ink">
              {org}
            </span>
          ) : null}
          {person ? (
            <span className="block max-w-28 truncate rounded-ij-arc-underline bg-ij-selection px-1.5 py-0.5 text-ij-ink">
              {person}
            </span>
          ) : null}
          {!capture.sourceSnapshotUrl ? (
            <span className="ml-auto font-ij-mono text-ij-ink">reconstructed</span>
          ) : null}
          <span className="sr-only">Topic: {topicTitle}</span>
        </span>
      </span>
    </>
  );

  if (spatial) {
    const focusOpacity = focus === 'focused' ? 1 : focus === 'related' ? 0.92 : focus === 'dimmed' ? 0.18 : 0.48;
    return (
      <article
        data-capture-id={capture.id}
        data-source-kind={capture.sourceKind}
        data-spatial="true"
        data-hovered={hovered ? 'true' : 'false'}
        data-focus={focus}
        className="survey-source-card flex flex-col overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-editor text-left"
        style={{ ...style, opacity: focusOpacity }}
        aria-hidden="true"
      >
        {contents}
      </article>
    );
  }

  return (
    <button
      type="button"
      data-capture-id={capture.id}
      data-source-kind={capture.sourceKind}
      data-spatial="false"
      onClick={onOpen}
      className="survey-source-card survey-focusable flex flex-col overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-editor text-left"
      style={style}
      aria-label={`Open captured source: ${capture.title}`}
    >
      {contents}
    </button>
  );
}
