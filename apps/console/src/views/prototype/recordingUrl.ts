// SOURCING: none. Builds the gateway recording URL for prototype.stage.

/**
 * Resolve the `.rrd` URL the web-viewer should open.
 *
 * Prefer an absolute `recording_url` on the view-instance when present.
 * Otherwise compose from gateway base + recording_id per
 * `GET /v1/prototype/recordings/{recording_id}.rrd`.
 */
export function prototypeRecordingUrl(input: {
  readonly recordingId?: string | null;
  readonly recordingUrl?: string | null;
  readonly gatewayBase?: string | null;
}): string | null {
  const absolute = input.recordingUrl?.trim();
  if (absolute) return absolute;

  const recordingId = input.recordingId?.trim();
  if (!recordingId) return null;

  const base = (
    input.gatewayBase?.trim() ||
    process.env.NEXT_PUBLIC_THEOREM_GATEWAY_URL?.trim() ||
    ''
  ).replace(/\/$/, '');
  if (!base) return null;

  return `${base}/v1/prototype/recordings/${encodeURIComponent(recordingId)}.rrd`;
}
