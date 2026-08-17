// SOURCING: hand-roll — PET Dialogue sentinel chip. Domain chrome on the
// pixel-pet overlay (title, one-line diff, receipt link, dismiss). Not a
// toast/sonner surface; chips ride the existing pet composer Dialogue.

import type { SentinelChipView } from "./sentinelChip";

export function SentinelChipCard({
  chip,
  onDismiss,
}: {
  chip: SentinelChipView;
  onDismiss: (chip: SentinelChipView) => void;
}) {
  return (
    <aside
      className={`pet-sentinel-chip${chip.digest ? " is-digest" : ""}`}
      data-sentinel-chip
      data-sentinel-digest={chip.digest ? "true" : "false"}
      aria-label={
        chip.digest ? "Batched monitor alerts" : "Monitor alert"
      }
    >
      <p className="pet-sentinel-title">{chip.programTitle}</p>
      <p className="pet-sentinel-diff">{chip.diffSummary}</p>
      <a
        className="pet-sentinel-receipt"
        href={chip.receiptLink}
        data-sentinel-receipt
      >
        Receipt
      </a>
      <button
        type="button"
        className="pet-sentinel-dismiss"
        data-sentinel-dismiss
        aria-label="Dismiss monitor alert"
        onClick={() => onDismiss(chip)}
      >
        Dismiss
      </button>
    </aside>
  );
}
