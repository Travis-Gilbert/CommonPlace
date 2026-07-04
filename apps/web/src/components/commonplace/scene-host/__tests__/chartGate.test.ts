import { describe, expect, it } from 'vitest';
import { validateVegaLiteChartSpec } from '../chartGate';

describe('validateVegaLiteChartSpec', () => {
  it('accepts inline-data whitelisted marks', () => {
    expect(
      validateVegaLiteChartSpec({
        mark: 'bar',
        data: { values: [{ label: 'A', value: 2 }] },
        encoding: {
          x: { field: 'label', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
        },
      }),
    ).toEqual({ ok: true });
  });

  it('rejects external data URLs', () => {
    expect(
      validateVegaLiteChartSpec({
        mark: 'bar',
        data: { url: 'https://example.com/data.json' },
      }),
    ).toEqual({ ok: false, reason: 'external data URLs are not allowed' });
  });

  it('rejects non-whitelisted marks', () => {
    expect(
      validateVegaLiteChartSpec({
        mark: 'text',
        data: { values: [{ label: 'A', value: 2 }] },
      }),
    ).toEqual({ ok: false, reason: 'mark text is not allowed' });
  });
});
