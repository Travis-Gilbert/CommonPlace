'use client';

export const LAMBDA_STEP = 0.05;

export function LambdaDial({
  lambda,
  onChange,
  disabled,
}: {
  readonly lambda: number;
  readonly onChange: (lambda: number) => void;
  readonly disabled?: boolean;
}) {
  return (
    <label className="flex min-w-44 items-center gap-2 text-ij-ink-info">
      <span className="font-ij-mono text-ij-island-meta uppercase">Spread</span>
      <input
        type="range"
        min={0}
        max={1}
        step={LAMBDA_STEP}
        value={lambda}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        aria-label="Aspect convergence, 0 diverges and 1 converges"
        className="min-w-24 flex-1"
        style={{ accentColor: 'var(--ij-accent)' }}
      />
      <output
        className="w-9 font-ij-mono text-ij-ink tabular-nums"
        data-testid="lambda-readout"
      >
        {lambda.toFixed(2)}
      </output>
    </label>
  );
}
