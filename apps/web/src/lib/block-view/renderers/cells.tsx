"use client";

/* Cell primitives shared by every Set view. The Anytype rendering convention,
   read straight from the export: status (single-select) → colored text;
   tag (multi-select) → filled chip; object → ref pill; file → thumbnail. */

import type { CSSProperties } from "react";
import type { Cell, DbObject, FileRef, OptionRef, RefChip } from "../database/model";
import styles from "../database.module.css";
import { IconCheck } from "./icons";

const tagStyle = (color: string): CSSProperties => ({
  background: `var(--tag-${color}-bg)`,
  color: `var(--tag-${color})`,
  borderColor: `var(--tag-${color}-line)`,
});

export function Chip({ option }: { option: OptionRef }) {
  return <span className={styles.chip} style={tagStyle(option.color)}>{option.name}</span>;
}

export function StatusText({ option }: { option: OptionRef }) {
  return <span className={styles.status} style={{ color: `var(--tag-${option.color})` }}>{option.name}</span>;
}

export function RefPill({ chip }: { chip: RefChip }) {
  return (
    <span className={styles.refChip}>
      <span className={styles.refAvatar}>{chip.icon ? chip.icon : chip.title.slice(0, 1).toUpperCase()}</span>
      {chip.title}
    </span>
  );
}

export function FileChip({ file }: { file: FileRef }) {
  return (
    <span className={styles.fileChip}>
      <img className={styles.fileThumb} src={file.url} alt={file.name} loading="lazy" />
      {file.name}
    </span>
  );
}

export function ObjectGlyph({ object, size = 17 }: { object: DbObject; size?: number }) {
  if (object.emoji) return <span style={{ fontSize: size }}>{object.emoji}</span>;
  if (object.icon) return <img className={styles.refAvatar} style={{ width: size, height: size }} src={object.icon} alt="" />;
  return (
    <span className={styles.refAvatar} style={{ width: size, height: size }}>
      {object.title.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function formatDate(ms?: number): string {
  if (ms == null) return "";
  try {
    return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/** Render one resolved cell by its relation format. */
export function RelationCell({ cell }: { cell?: Cell }) {
  if (!cell || cell.empty) return <span className={styles.empty}>—</span>;
  switch (cell.format) {
    case "status":
      return <span className={styles.chipRow}>{cell.options?.map((o) => <StatusText key={o.id} option={o} />)}</span>;
    case "tag":
      return <span className={styles.chipRow}>{cell.options?.map((o) => <Chip key={o.id} option={o} />)}</span>;
    case "object":
      return <span className={styles.chipRow}>{cell.refs?.map((r) => <RefPill key={r.id} chip={r} />)}</span>;
    case "file":
      return <span className={styles.chipRow}>{cell.files?.map((f) => <FileChip key={f.id} file={f} />)}</span>;
    case "date":
      return <span className={styles.mono}>{formatDate(cell.date)}</span>;
    case "number":
      return <span className={styles.mono}>{cell.number}</span>;
    case "checkbox":
      return (
        <span className={`${styles.check} ${cell.bool ? styles.checkOn : ""}`}>{cell.bool ? <IconCheck /> : null}</span>
      );
    case "url":
      return (
        <a className={styles.link} href={cell.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          {cell.url}
        </a>
      );
    default:
      return <span>{cell.text}</span>;
  }
}
