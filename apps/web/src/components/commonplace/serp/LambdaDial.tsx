'use client';

// SOURCING: @base-ui/react/slider (the project's declared primitive layer, the
// same one src/components/ui/* binds to). Parts only, styled with --cp-* tokens.

/**
 * The convergence dial (SPEC F3).
 *
 * One control bound to B5's lambda. Left is divergence: aspects spread and the
 * scatter answers "what different things could this mean". Right is
 * convergence: aspects tighten and the scatter answers "what is the best
 * reading of this". The number is shown because a dial with no readout cannot
 * be reported or reproduced.
 *
 * The value is stored per person, not per session, so it survives an app
 * restart. Moving it does not re-run the query: the person resubmits, which is
 * what makes the change legible as a change.
 */

import { Slider } from '@base-ui/react/slider';
import styles from './serp.module.css';

export const LAMBDA_STEP = 0.05;

export function LambdaDial({
  lambda,
  onChange,
  disabled,
}: {
  lambda: number;
  onChange: (lambda: number) => void;
  disabled?: boolean;
}) {
  return (
    <Slider.Root
      className={styles.dial}
      value={lambda}
      min={0}
      max={1}
      step={LAMBDA_STEP}
      disabled={disabled}
      onValueChange={(value) => onChange(Array.isArray(value) ? value[0] : value)}
    >
      <Slider.Label className={styles.dialLabel}>Spread</Slider.Label>
      <Slider.Control className={styles.dialControl}>
        <Slider.Track className={styles.dialTrack}>
          <Slider.Indicator className={styles.dialIndicator} />
          <Slider.Thumb
            className={styles.dialThumb}
            getAriaLabel={() => 'Aspect convergence, 0 diverges and 1 converges'}
          />
        </Slider.Track>
      </Slider.Control>
      <output className={styles.dialValue} data-testid="lambda-readout">
        {lambda.toFixed(2)}
      </output>
    </Slider.Root>
  );
}
