/** @type {import('tailwindcss').Config} */
// Colors resolve through the porcelain custom properties declared in
// src/global.css so NativeWind carries the same tokens as src/theme/tokens.ts.
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        'cp-deep': 'var(--cp-deep)',
        'cp-bg': 'var(--cp-bg)',
        'cp-surface': 'var(--cp-surface)',
        'cp-raised': 'var(--cp-raised)',
        'cp-secondary': 'var(--cp-secondary)',
        'cp-muted': 'var(--cp-muted)',
        'cp-border': 'var(--cp-border)',
        'cp-input': 'var(--cp-input)',
        'cp-text': 'var(--cp-text)',
        'cp-text-muted': 'var(--cp-text-muted)',
        'cp-text-faint': 'var(--cp-text-faint)',
        'cp-oxblood': 'var(--cp-oxblood)',
        'cp-oxblood-pressed': 'var(--cp-oxblood-pressed)',
        'cp-oxblood-wash': 'var(--cp-oxblood-wash)',
        'cp-teal': 'var(--cp-teal)',
        'cp-gold': 'var(--cp-gold)',
        'cp-gold-light': 'var(--cp-gold-light)',
        'cp-machine': 'var(--cp-machine)',
        'cp-machine-raise': 'var(--cp-machine-raise)',
        'cp-machine-line': 'var(--cp-machine-line)',
        'cp-machine-text': 'var(--cp-machine-text)',
      },
      spacing: {
        // 4px base grid (web --cp-space-* parity)
        '4.5': '18px',
      },
    },
  },
  plugins: [],
};
