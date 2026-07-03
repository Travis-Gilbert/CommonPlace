'use client';

import { getObjectTypeIdentity } from '@/lib/commonplace';
import type { CSSProperties, MouseEvent } from 'react';
import type { ObjectCardProps } from './ObjectRenderer';
import { extractDomain, formatDate, readString } from './shared';

type GrammarKind = 'file' | 'link' | 'claim';

const KIND_ICON: Record<GrammarKind, string> = {
  file: 'F',
  link: 'L',
  claim: 'C',
};

export function FileObjectCard(props: ObjectCardProps) {
  return <GrammarObjectCard {...props} kind="file" />;
}

export function LinkObjectCard(props: ObjectCardProps) {
  return <GrammarObjectCard {...props} kind="link" />;
}

export function ClaimObjectCard(props: ObjectCardProps) {
  return <GrammarObjectCard {...props} kind="claim" />;
}

function GrammarObjectCard({
  object,
  compact,
  variant = 'default',
  kind,
  onClick,
  onContextMenu,
}: ObjectCardProps & { kind: GrammarKind }) {
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const title = object.display_title ?? object.title;
  const summary = readString(object.body) ?? readString(object.explanation) ?? readString(object.og_description);
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const href = readString(object.url);
  const domain = href ? extractDomain(href) : readString(object.source_label);
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (event: MouseEvent) => onContextMenu(event, object) : undefined,
  };

  if (variant === 'chip' || variant === 'chain' || variant === 'module' || variant === 'timeline') {
    return (
      <button
        type="button"
        className={`cp-obj cp-obj--${variant === 'timeline' ? 'module' : variant} cp-obj-grammar`}
        data-type={kind}
        data-compact={compact || undefined}
        {...handler}
      >
        <span className="cp-obj-kind-well" style={{ '--kind-color': identity.color } as CSSProperties}>
          {KIND_ICON[kind]}
        </span>
        <span className="cp-obj-title">{title}</span>
        {domain && <span className="cp-obj-provenance">{domain}</span>}
        {score && <span className="cp-obj-edges">{score}</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="cp-object-card cp-object-grammar"
      data-type={kind}
      {...handler}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'var(--cp-card)',
        border: '1px solid var(--cp-border-faint)',
        borderRadius: 6,
        padding: compact ? '8px 10px' : '10px 12px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span className="cp-obj-kind-well" style={{ '--kind-color': identity.color } as CSSProperties}>
          {KIND_ICON[kind]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cp-obj-title">{title}</div>
          {!compact && summary && <div className="cp-obj-body">{summary}</div>}
          <div className="cp-obj-meta" style={{ marginTop: summary && !compact ? 8 : 4 }}>
            {domain && <span className="cp-obj-provenance">{domain}</span>}
            {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
            {score && <span className="cp-obj-edges" style={{ marginLeft: 'auto' }}>{score}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}
