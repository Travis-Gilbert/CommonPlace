# NOTICE

## Clean-room provenance

This web application (`@commonplace/web`) is a clean-room recreation. No source,
styles, CSS, SVG assets, or copy from twentyhq/twenty are used; this is a
clean-room recreation from measured facts and behavior specs only.

Provenance is enforced mechanically, not just asserted. The gate lives at
`scripts/provenance-scan.mjs` and scans `src/` for any import from a
twenty / twentyhq package and for copied-source marker strings
(`twentyhq/twenty`, `@license Enterprise`). `scripts/provenance-scan.test.mjs`
proves the gate works by planting a violating file, confirming the scan catches
it, and confirming the real tree scans clean.

## Third-party visual asset dependencies

The licenses below were read from each package's own `package.json` in
`node_modules`. Versions are the ranges declared in `apps/web/package.json`.

| Asset | Where | License | Used in `src/` |
|-------|-------|---------|----------------|
| iconoir-react (`^7.11.0`) | Icon set (React components) | MIT | Yes (imported by 33 files) |
| lucide-react (`^1.8.0`) | Icon set (React components) | ISC | Yes (imported by 42 files) |
| @hugeicons/react (`^1.1.9`) + @hugeicons/core-free-icons (`^4.2.2`) | Icon set (free tier, React components) | MIT | Yes (imported by `src/components/ui/file-system.tsx`) |
| Noun Project icons | Individual marks inlined as SVG React components | Per-icon license (attribution or royalty-free under the account plan) | Yes |

### Noun Project icons

Selected Noun Project marks are inlined directly as `currentColor` SVG React
components rather than imported from a package. They are used by
`src/components/v2/brand-icons.tsx`, the island glyphs
(`src/components/island/AiGlyph.tsx` noun-project 8401748,
`UploadGlyph.tsx` 8375073, `NetworkGlyph.tsx` 6472628, `WebGlyph.tsx` 8223194),
and `src/lib/commonplace/node-icons.tsx`. `scripts/fetch-noun-icons.mjs` is the
associated fetch pipeline (OAuth against the Noun Project API v2). Noun Project
licensing is per icon: each mark is either Creative Commons attribution or
royalty-free under the account's plan. Attribution obligations, where they
apply, are the responsibility of the account holder.

## Fonts

Fonts are loaded through `next/font` in `src/app/fonts.ts`. The Google Fonts
families in use (Vollkorn, Vollkorn SC, IBM Plex Sans, IBM Plex Mono,
Courier Prime, JetBrains Mono, Caveat, Caudex, Lora) are published under the
SIL Open Font License 1.1. Local display faces under `public/fonts/`
(for example Amarna, apple-gothic-subset, BertholdBlock) are loaded via
`next/font/local` and carry their own respective licenses.

Inter is not a bundled or redistributed dependency here. It appears only once,
as a bare CSS `font-family` fallback keyword in `src/styles/theseus.css`
(`var(--font-ibm-plex), 'IBM Plex Sans', Inter, system-ui, sans-serif`). No
Inter font file is shipped and no `next/font` Inter face is loaded, so it is
not listed above as a used asset. If a future change loads Inter, note it as
SIL Open Font License 1.1.

## Declared but not used in `src/`

For transparency: `react-native-vector-icons` (`^10.3.0`) and the
`@blocksuite/icons` override (`2.1.75`) appear in `apps/web/package.json` but
are not imported by any file under `src/`, so no icon or font asset from them
ships in the web application surface.
