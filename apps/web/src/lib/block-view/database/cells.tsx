/** Per-format relation cell rendering — the atom shared by every view.
 *  status/tag → colored chips, object → ref chips, file → thumbnails, the rest
 *  → typed text. Colors come from the porcelain --tag-* tokens via data-color. */
import type { Cell, OptionRef, RefChip as RefChipT } from "./model";
import styles from "./database.module.css";

export function TagChip({ option }: { option: OptionRef }) {
  return (
    <span className={styles.chip} data-color={option.color}>
      {option.name}
    </span>
  );
}

function RefChip({ chip }: { chip: RefChipT }) {
  return (
    <span className={styles.refChip}>
      {chip.icon ? <span className={styles.refIcon}>{chip.icon}</span> : <span className={styles.refDot} />}
      {chip.title}
    </span>
  );
}

const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

/** Density: "chip" (gallery — chips wrap), "inline" (grid/list — single line). */
export function RelationCell({ cell, density = "chip" }: { cell: Cell; density?: "chip" | "inline" }) {
  if (cell.empty) return <span className={styles.cellEmpty}>—</span>;

  switch (cell.format) {
    case "status":
    case "tag":
      return (
        <span className={styles.chipRow} data-density={density}>
          {cell.options?.map((o) => <TagChip key={o.id} option={o} />)}
        </span>
      );
    case "object":
      return (
        <span className={styles.chipRow} data-density={density}>
          {cell.refs?.map((r) => <RefChip key={r.id} chip={r} />)}
        </span>
      );
    case "file":
      return (
        <span className={styles.thumbRow}>
          {cell.files?.map((f) => <img key={f.id} className={styles.thumb} src={f.url} alt={f.name} loading="lazy" />)}
        </span>
      );
    case "date":
      return <span className={styles.cellNum}>{cell.date ? dateFmt.format(new Date(cell.date)) : "—"}</span>;
    case "number":
      return <span className={styles.cellNum}>{cell.number}</span>;
    case "checkbox":
      return <span className={styles.cellText}>{cell.bool ? "✓" : "—"}</span>;
    case "url":
      return (
        <a className={styles.cellLink} href={cell.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          {cell.url}
        </a>
      );
    default:
      return <span className={styles.cellText}>{cell.text}</span>;
  }
}
