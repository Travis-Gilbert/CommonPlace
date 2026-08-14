# Design Language: Free Shadcn UI Components, Blocks, Icons, Templates & MCP - ReUI

> Extracted from `https://reui.io` on August 6, 2026
> 3578 elements analyzed

This document describes the complete design language of the website. It is structured for AI/LLM consumption — use it to faithfully recreate the visual design in any framework.

## Color Palette

### Primary Colors

| Role | Hex | RGB | HSL | Usage Count |
|------|-----|-----|-----|-------------|
| Primary | `#008134` | rgb(0, 129, 52) | hsl(144, 100%, 25%) | 2 |

### Neutral Colors

| Hex | HSL | Usage Count |
|-----|-----|-------------|
| `#000000` | hsl(0, 0%, 0%) | 1835 |
| `#c8c8c8` | hsl(0, 0%, 78%) | 263 |
| `#ffffff` | hsl(0, 0%, 100%) | 102 |
| `#e9e9e9` | hsl(0, 0%, 91%) | 84 |
| `#242424` | hsl(0, 0%, 14%) | 29 |
| `#f4f4f4` | hsl(0, 0%, 96%) | 1 |

### Background Colors

Used on large-area elements: `#ffffff`, `#e9e9e9`

### Text Colors

Text color palette: `#000000`, `#020202`, `#242424`, `#f4f4f4`, `#ffffff`, `#010101`

### Gradients

```css
background-image: linear-gradient(to right, lab(90.952 0 -0.0000119209) 1px, rgba(0, 0, 0, 0) 1px), linear-gradient(lab(90.952 0 -0.0000119209) 1px, rgba(0, 0, 0, 0) 1px);
```

```css
background-image: linear-gradient(lab(100 0 0) 0%, lab(96.52 -0.0000298023 0.0000119209) 100%);
```

```css
background-image: linear-gradient(oklab(0.999994 0.0000455677 0.0000200868 / 0.6) 0%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0) 100%);
```

### Full Color Inventory

| Hex | Contexts | Count |
|-----|----------|-------|
| `#000000` | text, border, background | 1835 |
| `#c8c8c8` | background, border | 263 |
| `#ffffff` | background, text | 102 |
| `#e9e9e9` | background | 84 |
| `#242424` | text | 29 |
| `#008134` | background, border | 2 |
| `#f4f4f4` | text | 1 |

## Typography

### Font Families

- **Inter** — used for all (3569 elements)
- **ui-monospace** — used for body (9 elements)

### Type Scale

| Size (px) | Size (rem) | Weight | Line Height | Letter Spacing | Used On |
|-----------|------------|--------|-------------|----------------|---------|
| 48px | 3rem | 600 | 52.8px | -1.2px | h1, span, img |
| 36px | 2.25rem | 700 | 40px | -0.9px | h2, span, svg, defs |
| 24px | 1.5rem | 600 | 32px | -0.6px | h3, span |
| 20px | 1.25rem | 500 | 27.5px | -0.5px | p |
| 18px | 1.125rem | 400 | 29.25px | normal | p |
| 16px | 1rem | 400 | 24px | normal | html, head, meta, link |
| 14px | 0.875rem | 500 | 20px | normal | a, button, svg, path |
| 13px | 0.8125rem | 700 | 19.5px | 1.82px | span |
| 12px | 0.75rem | 500 | 16px | normal | span, button, svg, path |
| 11px | 0.6875rem | 400 | 16px | 1.1px | p |
| 10px | 0.625rem | 500 | 12.5px | normal | span |

### Heading Scale

```css
h1 { font-size: 48px; font-weight: 600; line-height: 52.8px; }
h2 { font-size: 36px; font-weight: 700; line-height: 40px; }
h3 { font-size: 24px; font-weight: 600; line-height: 32px; }
h2 { font-size: 16px; font-weight: 400; line-height: 24px; }
h3 { font-size: 14px; font-weight: 500; line-height: 20px; }
```

### Body Text

```css
body { font-size: 14px; font-weight: 500; line-height: 20px; }
```

### Font Weights in Use

`400` (2887x), `500` (566x), `600` (105x), `700` (20x)

## Spacing

**Base unit:** 2px

| Token | Value | Rem |
|-------|-------|-----|
| spacing-1 | 1px | 0.0625rem |
| spacing-64 | 64px | 4rem |
| spacing-96 | 96px | 6rem |
| spacing-144 | 144px | 9rem |
| spacing-208 | 208px | 13rem |
| spacing-231 | 231px | 14.4375rem |
| spacing-256 | 256px | 16rem |
| spacing-292 | 292px | 18.25rem |
| spacing-314 | 314px | 19.625rem |
| spacing-342 | 342px | 21.375rem |
| spacing-366 | 366px | 22.875rem |
| spacing-451 | 451px | 28.1875rem |

## Border Radii

| Label | Value | Count |
|-------|-------|-------|
| sm | 4px | 81 |
| md | 8px | 12 |
| lg | 14px | 154 |
| full | 9999px | 240 |

## Box Shadows

**sm** — blur: 0px
```css
box-shadow: rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, lab(2.75381 0 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px;
```

**sm** — blur: 0px
```css
box-shadow: rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px;
```

**sm** — blur: 0px
```css
box-shadow: rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0 0 0 / 0.05) 0px 1px 2px 0px;
```

**sm** — blur: 0px
```css
box-shadow: rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 1px 3px 0px, rgba(0, 0, 0, 0.1) 0px 1px 2px -1px;
```

**sm** — blur: 0px
```css
box-shadow: rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px;
```

**sm** — blur: 0px
```css
box-shadow: rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px;
```

**sm** — blur: 0px
```css
box-shadow: rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgb(0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px;
```

**sm** — blur: 0px
```css
box-shadow: rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.14) 0px 1px 3px 0px;
```

**sm** — blur: 0px
```css
box-shadow: rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px, rgba(0, 0, 0, 0.18) 0px 10px 22px -6px;
```

## CSS Custom Properties

### Colors

```css
--site-foreground: #0a0a0a;
--site-card: #fff;
--site-card-foreground: #0a0a0a;
--site-popover: #fff;
--site-popover-foreground: #0a0a0a;
--site-primary: #171717;
--site-primary-foreground: #fafafa;
--site-secondary: #f5f5f5;
--site-secondary-foreground: #171717;
--site-muted: #f5f5f5;
--site-muted-foreground: #696969;
--site-accent: #f5f5f5;
--site-accent-foreground: #171717;
--site-destructive: #e40014;
--site-border: #e5e5e5;
--site-ring: #a1a1a1;
--site-chart-1: #f05100;
--site-chart-2: #009588;
--site-chart-3: #104e64;
--site-chart-4: #fcbb00;
--site-chart-5: #f99c00;
--site-sidebar-foreground: #0a0a0a;
--site-sidebar-primary: #171717;
--site-sidebar-primary-foreground: #fafafa;
--site-sidebar-accent: #f5f5f5;
--site-sidebar-accent-foreground: #171717;
--site-sidebar-border: #e5e5e5;
--site-sidebar-ring: #a1a1a1;
--site-destructive-foreground: var(--color-red-800);
--site-success-foreground: var(--color-emerald-900);
--site-info-foreground: var(--color-violet-900);
--site-warning-foreground: var(--color-yellow-900);
--site-invert-foreground: var(--color-zinc-50);
--site-surface-foreground: var(--site-foreground);
--site-code-foreground: var(--site-surface-foreground);
--site-selection-foreground: #fff;
--foreground: #0a0a0a;
--card: #fff;
--card-foreground: #0a0a0a;
--popover: #fff;
--popover-foreground: #0a0a0a;
--primary: #171717;
--primary-foreground: #fafafa;
--secondary: #f5f5f5;
--secondary-foreground: #171717;
--muted: #f5f5f5;
--muted-foreground: #737373;
--accent: #f5f5f5;
--accent-foreground: #171717;
--destructive: #e40014;
--border: #e5e5e5;
--ring: #a1a1a1;
--chart-1: #f05100;
--chart-2: #009588;
--chart-3: #104e64;
--chart-4: #fcbb00;
--chart-5: #f99c00;
--sidebar-foreground: #0a0a0a;
--sidebar-primary: #171717;
--sidebar-primary-foreground: #fafafa;
--sidebar-accent: #f5f5f5;
--sidebar-accent-foreground: #171717;
--sidebar-border: #e5e5e5;
--sidebar-ring: #a1a1a1;
--destructive-foreground: var(--color-red-800);
--success-foreground: var(--color-emerald-900);
--info-foreground: var(--color-violet-900);
--warning-foreground: var(--color-yellow-900);
--invert-foreground: var(--color-zinc-50);
--surface-foreground: var(--foreground);
--code-foreground: var(--surface-foreground);
--selection-foreground: #fff;
--color-zinc-100: lab(96.1634% .0993311 -.364041);
--color-purple-300: lab(78.3298% 26.2195 -34.9499);
--color-zinc-200: lab(90.6853% .399232 -1.45452);
--color-rose-200: lab(86.806% 19.1909 4.07754);
--color-slate-200: lab(91.7353% -.998765 -4.76968);
--tw-mask-bottom-to-color: transparent;
--color-sky-500: lab(63.3038% -18.433 -51.0407);
--color-pink-500: lab(56.9303% 76.8162 -8.07021);
--color-orange-600: lab(57.1026% 64.2584 89.8886);
--color-violet-600: lab(41.088% 68.9966 -91.995);
--color-red-900: lab(28.5139% 44.5539 29.0463);
--color-orange-800: lab(37.1566% 46.6433 50.5562);
--tw-mask-bottom-from-color: black;
--color-pink-950: lab(15.6116% 35.2166 3.53979);
--color-blue-700: lab(36.9089% 35.0961 -85.6872);
--color-neutral-300: lab(84.92% 0 -.0000119209);
--color-slate-500: lab(48.0876% -2.03595 -16.5814);
--color-purple-800: lab(30.6017% 56.7637 -64.4751);
--color-teal-400: lab(76.0109% -53.3483 -2.27906);
--tw-inset-ring-shadow: 0 0 #0000;
--color-site-card: lab(100% 0 0);
--color-orange-50: lab(97.7008% 1.53735 5.90649);
--color-blue-300: lab(77.5052% -6.4629 -36.42);
--color-cyan-700: lab(44.7267% -21.5987 -26.118);
--color-gray-300: lab(85.1236% -.612259 -3.7138);
--color-warning-foreground: lab(32.3865% 21.1273 38.5959);
--color-yellow-400: lab(83.2664% 8.65132 106.895);
--color-slate-300: lab(84.7652% -1.94535 -7.93337);
--color-cyan-200: lab(91.0821% -24.0435 -12.8306);
--color-amber-300: lab(86.4156% 6.13147 78.3961);
--color-gray-500: lab(47.7841% -.393182 -10.0268);
--color-zinc-50: lab(98.26% 0 0);
--color-sidebar: lab(98.26% 0 0);
--color-green-500: lab(70.5521% -66.5147 45.8073);
--color-white: #fff;
--color-sky-600: lab(51.7754% -11.4712 -49.8349);
--color-gray-400: lab(65.9269% -.832707 -8.17473);
--color-accent: lab(96.52% -.0000298023 .0000119209);
--color-slate-400: lab(65.5349% -2.25151 -14.5072);
--color-stone-900: lab(9.03835% 1.15298 1.92955);
--color-popover: lab(100% 0 0);
--color-blue-400: lab(65.0361% -1.42065 -56.9802);
--color-yellow-300: lab(89.7033% -.480294 84.4917);
--color-zinc-950: lab(2.51107% .242703 -.886115);
--color-teal-950: lab(16.6371% -15.3183 -3.81732);
--color-emerald-200: lab(90.2247% -31.039 9.47084);
--color-purple-600: lab(43.0295% 75.21 -86.5669);
--tw-mask-left-from-color: black;
--color-violet-800: lab(29.3188% 57.7986 -76.1493);
--color-zinc-700: lab(26.8019% 1.35387 -4.68303);
--color-neutral-700: lab(27.036% 0 0);
--color-fuchsia-600: lab(47.5131% 83.4271 -63.0363);
--color-violet-500: lab(49.9355% 55.1776 -81.8963);
--color-sky-50: lab(97.3623% -2.33802 -4.13098);
--color-lime-200: lab(94.0718% -22.5338 42.5238);
--color-fuchsia-200: lab(87.7108% 19.9958 -18.2054);
--color-green-900: lab(30.797% -29.6927 17.382);
--color-info: lab(49.9355% 55.1776 -81.8963);
--color-rose-950: lab(14.2323% 34.0086 9.80922);
--color-blue-800: lab(30.2514% 27.7853 -70.2699);
--color-pink-100: lab(93.5864% 9.01193 -3.15079);
--color-neutral-900: lab(7.78201% -.0000149012 0);
--color-cyan-50: lab(98.3304% -5.97432 -2.62108);
--color-neutral-100: lab(96.52% -.0000298023 .0000119209);
--color-blue-100: lab(92.0301% -2.24757 -11.6453);
--color-green-600: lab(59.0978% -58.6621 41.2579);
--color-green-950: lab(15.6845% -20.4225 11.7249);
--color-yellow-950: lab(16.8146% 15.7422 23.1133);
--color-violet-950: lab(14.0706% 33.3353 -46.7553);
--color-violet-300: lab(76.7419% 18.3911 -37.0706);
--color-zinc-900: lab(8.30603% .618205 -2.16572);
--color-invert-foreground: lab(98.26% 0 0);
--color-red-300: lab(76.5514% 36.422 15.5335);
--color-cyan-500: lab(67.805% -35.3952 -30.2018);
--color-code-highlight: lab(95.36% 0 0);
--color-sky-300: lab(80.3307% -20.2945 -31.385);
--color-slate-800: lab(16.132% -.318035 -14.6672);
--color-lime-800: lab(37.7655% -25.1694 43.0683);
--color-emerald-900: lab(28.8637% -26.9249 5.45986);
--color-sky-400: lab(70.687% -23.6078 -45.9483);
--color-orange-500: lab(64.272% 57.1788 90.3583);
--tw-mask-right-from-color: black;
--color-slate-600: lab(35.5623% -1.74978 -15.4316);
--color-pink-600: lab(49.5493% 79.8381 2.31768);
--color-rose-900: lab(29.7104% 51.514 12.6253);
--color-green-400: lab(78.503% -64.9265 39.7492);
--color-emerald-500: lab(66.9756% -58.27 19.5419);
--color-accent-foreground: lab(7.78201% -.0000149012 0);
--color-yellow-50: lab(98.6846% -1.79055 9.7766);
--color-gray-950: lab(1.90334% .278696 -5.48866);
--color-rose-700: lab(41.1651% 71.6251 30.3087);
--color-amber-900: lab(31.2288% 30.2627 40.0378);
--color-emerald-50: lab(97.8462% -6.94966 1.85487);
--color-amber-700: lab(47.2709% 42.9082 69.2966);
--color-zinc-600: lab(35.1166% 1.78212 -6.1173);
--color-indigo-500: lab(48.295% 38.3129 -81.9673);
--color-gray-600: lab(35.6337% -1.58697 -10.8425);
--color-orange-100: lab(94.7127% 3.58394 14.3151);
--color-violet-200: lab(87.0888% 8.53688 -19.4189);
--tw-mask-top-to-color: transparent;
--color-blue-600: lab(44.0605% 29.0279 -86.0352);
--color-green-200: lab(92.4222% -26.4702 12.9427);
--color-ring: lab(66.128% -.0000298023 .0000119209);
--tw-border-style: solid;
--color-cyan-900: lab(30.372% -13.1853 -18.7887);
--color-red-600: lab(48.4493% 77.4328 61.5452);
--color-site-muted: lab(96.52% -.0000298023 .0000119209);
--color-border: lab(90.952% 0 -.0000119209);
--color-blue-50: lab(96.492% -1.14644 -5.11479);
--color-stone-700: lab(27.3812% 1.32917 3.57789);
--color-indigo-700: lab(32.4486% 49.2217 -84.6695);
--color-site-border: lab(90.952% 0 -.0000119209);
--color-neutral-950: lab(2.75381% 0 0);
--color-black: #000;
--color-foreground: lab(2.75381% 0 0);
--color-neutral-400: lab(66.128% -.0000298023 .0000119209);
--tw-mask-right-to-color: transparent;
--tw-border-spacing-y: 0px;
--color-amber-100: lab(95.916% -1.21653 23.111);
--color-stone-800: lab(15.0353% 1.96067 1.53427);
--color-indigo-100: lab(91.6577% 1.04591 -12.7199);
--color-emerald-800: lab(35.3675% -33.1188 8.04002);
--color-info-foreground: lab(24.3783% 45.7525 -61.4902);
--color-violet-50: lab(96.2416% 2.28849 -5.51657);
--color-muted-foreground: lab(48.496% 0 0);
--color-teal-100: lab(95.1845% -17.4212 -.425422);
--color-cyan-400: lab(76.6045% -40.9406 -29.6231);
--color-cyan-300: lab(85.3886% -36.7636 -21.5716);
--color-amber-400: lab(80.1641% 16.6016 99.2089);
--tw-ring-shadow: 0 0 #0000;
--color-indigo-400: lab(59.866% 22.4834 -64.4485);
--color-purple-500: lab(52.0183% 66.11 -78.2316);
--color-indigo-300: lab(74.0235% 8.54138 -41.6075);
--color-emerald-300: lab(83.9203% -48.7124 13.8849);
--color-yellow-600: lab(62.7799% 22.4197 86.1544);
--color-lime-950: lab(16.5113% -15.1841 22.0145);
--color-slate-700: lab(26.9569% -1.47016 -15.6993);
--color-pink-300: lab(77.8308% 38.525 -10.5394);
--color-neutral-500: lab(48.496% 0 0);
--color-amber-600: lab(60.3514% 40.5624 87.1228);
--color-yellow-800: lab(38.7484% 23.5833 51.4916);
--color-site-foreground: lab(2.75381% 0 0);
--color-slate-900: lab(7.78673% 1.82345 -15.0537);
--color-stone-400: lab(66.2166% 1.88044 3.20326);
--color-green-100: lab(96.1861% -13.8464 6.52365);
--color-emerald-700: lab(44.4871% -41.0396 11.0361);
--tw-border-spacing-x: 0px;
--color-teal-50: lab(98.3189% -4.74921 -.111711);
--color-red-200: lab(86.017% 19.8815 7.75869);
--color-indigo-800: lab(26.6645% 37.9804 -68.6402);
--color-code-foreground: lab(2.75381% 0 0);
--color-violet-900: lab(24.3783% 45.7525 -61.4902);
--color-sky-800: lab(35.164% -9.57692 -34.4068);
--color-pink-800: lab(34.9559% 60.2885 5.99639);
--color-teal-800: lab(35.5975% -26.6648 -4.34487);
--color-emerald-600: lab(55.0481% -49.9246 15.93);
--color-invert: lab(8.30603% .618205 -2.16572);
--color-violet-400: lab(62.8239% 34.9159 -60.0512);
--color-lime-600: lab(61.1055% -41.0235 73.1483);
--color-purple-100: lab(93.3333% 6.97437 -9.83434);
--tw-ring-offset-color: #fff;
--color-red-400: lab(63.7053% 60.745 31.3109);
--color-fuchsia-50: lab(97.1083% 4.46233 -4.09334);
--color-indigo-50: lab(95.4818% .411302 -6.78529);
--color-lime-300: lab(89.9218% -35.6546 68.5254);
--color-teal-600: lab(55.0223% -41.0774 -3.90277);
--color-rose-100: lab(92.8221% 9.86832 2.60075);
--color-emerald-100: lab(94.9004% -17.0769 5.63836);
--color-red-800: lab(33.7174% 55.8993 41.0293);
--color-background: lab(100% 0 0);
--color-red-500: lab(55.4814% 75.0732 48.8528);
--color-rose-400: lab(64.4125% 63.0291 19.2068);
--tw-ring-offset-width: 0px;
--color-zinc-300: lab(84.9837% .601262 -2.17986);
--color-purple-950: lab(14.8253% 38.9005 -44.5861);
--color-rose-800: lab(34.6481% 60.802 20.1957);
--color-indigo-600: lab(38.4009% 52.6132 -92.3857);
--color-amber-800: lab(37.8822% 37.1699 52.2718);
--color-fuchsia-500: lab(56.4256% 83.132 -64.639);
--color-neutral-50: lab(98.26% 0 0);
--color-lime-500: lab(75.3197% -46.6547 86.1778);
--color-sky-700: lab(41.6013% -9.10804 -42.5647);
--tw-mask-top-from-color: black;
--color-cyan-800: lab(36.5114% -17.1989 -21.6292);
--color-slate-50: lab(98.1434% -.369519 -1.05966);
--color-orange-300: lab(80.8059% 21.7313 50.4455);
--color-yellow-100: lab(97.3564% -4.51407 27.344);
--color-violet-700: lab(35.2783% 67.9912 -88.793);
--tw-ring-offset-shadow: 0 0 #0000;
--color-gray-800: lab(16.1051% -1.18239 -11.7533);
--color-destructive-foreground: lab(33.7174% 55.8993 41.0293);
--color-stone-100: lab(96.5286% -.0991821 .364268);
--color-zinc-500: lab(47.8878% 1.65477 -5.77283);
--color-destructive: lab(48.4493% 77.4328 61.5452);
--color-site-background: lab(100% 0 0);
--color-orange-700: lab(46.4615% 57.7275 70.8507);
--color-green-50: lab(98.1563% -5.60117 2.75915);
--color-indigo-950: lab(12.4853% 14.9672 -31.3418);
--color-zinc-800: lab(15.7305% .613764 -2.16959);
--color-lime-900: lab(31.9931% -20.7654 33.7379);
--color-orange-950: lab(14.1747% 23.4515 19.4461);
--color-sky-100: lab(94.3709% -4.56053 -8.23453);
--color-rose-50: lab(96.2369% 4.94155 1.28011);
--color-emerald-950: lab(15.0582% -17.9507 2.38369);
--color-amber-500: lab(72.7183% 31.8672 97.9407);
--color-orange-400: lab(70.0429% 42.5156 75.8207);
--color-warning: lab(76.3898% 14.5258 98.4589);
--color-sky-900: lab(29.1959% -8.34689 -28.2453);
--color-cyan-100: lab(95.3146% -13.8285 -6.84732);
--color-yellow-700: lab(47.8202% 25.2426 66.5015);
--color-violet-100: lab(93.0838% 4.35197 -9.88284);
--color-rose-300: lab(76.6339% 38.3549 9.68835);
--color-slate-950: lab(1.76974% 1.32743 -9.28855);
--color-success: lab(66.9756% -58.27 19.5419);
--color-success-foreground: lab(28.8637% -26.9249 5.45986);
--color-green-800: lab(37.4616% -36.7971 22.9692);
--color-rose-500: lab(56.101% 79.4328 31.4532);
--color-red-700: lab(40.4273% 67.2623 53.7441);
--color-slate-100: lab(96.286% -.852436 -2.46847);
--color-fuchsia-950: lab(15.7348% 39.0235 -27.4073);
--color-indigo-200: lab(84.4329% 3.18977 -23.9688);
--color-rose-600: lab(49.1882% 81.577 36.0311);
--color-blue-500: lab(54.1736% 13.3369 -74.6839);
--color-sky-950: lab(17.8299% -5.31271 -21.1584);
--color-zinc-400: lab(65.6464% 1.53497 -5.42429);
--color-muted: lab(96.52% -.0000298023 .0000119209);
--color-blue-900: lab(26.1542% 15.7545 -51.5504);
--tw-mask-left-to-color: transparent;
--color-lime-100: lab(96.8662% -11.7133 22.0854);
--color-yellow-900: lab(32.3865% 21.1273 38.5959);
--color-gray-700: lab(27.1134% -.956401 -12.3224);
--color-cyan-600: lab(55.1767% -26.7496 -30.5139);
--color-teal-300: lab(84.8977% -48.1516 -1.3321);
--color-code: lab(97.68% -.0000298023 .0000119209);
--color-code-number: lab(48.96% 0 0);
--color-red-100: lab(92.243% 10.2865 3.83865);
--color-amber-950: lab(15.8111% 20.9107 23.3752);
--color-stone-200: lab(91.055% .663072 .865579);
--color-blue-200: lab(86.15% -4.04379 -21.0797);
--color-primary: lab(7.78201% -.0000149012 0);
--color-lime-400: lab(83.7876% -45.0447 88.4738);
--color-red-50: lab(96.5005% 4.18508 1.52328);
--color-emerald-400: lab(75.0771% -60.7313 19.4147);
--color-teal-200: lab(90.7612% -33.1343 -.542295);
--color-red-950: lab(13.003% 29.04 16.7519);
--color-fuchsia-900: lab(27.755% 48.6174 -34.3553);
--color-fuchsia-400: lab(66.1178% 66.0652 -52.4733);
--color-purple-700: lab(36.1758% 69.8525 -80.0381);
--color-green-700: lab(47.0329% -47.0239 31.4788);
--color-neutral-800: lab(15.204% 0 -.00000596046);
--color-card: lab(100% 0 0);
--color-teal-500: lab(67.3859% -49.0983 -2.63511);
--color-cyan-950: lab(19.1528% -9.68757 -15.5267);
--color-yellow-500: lab(76.3898% 14.5258 98.4589);
--color-sky-200: lab(88.6983% -11.3978 -16.8488);
--color-blue-950: lab(15.6723% 8.86232 -32.2945);
--color-amber-50: lab(98.6252% -.635922 8.42309);
--color-stone-300: lab(84.7909% .928015 1.59738);
--color-amber-200: lab(91.7203% -.505269 49.9084);
--color-fuchsia-700: lab(39.787% 72.2653 -53.1244);
```

### Spacing

```css
--tw-space-x-reverse: 0;
--spacing: .25rem;
--tw-space-y-reverse: 0;
```

### Typography

```css
--site-font-sans: var(--font-inter);
--site-font-heading: var(--font-inter);
--site-font-mono: var(--font-mono);
--font-sans: var(--font-inter);
--font-heading: var(--font-inter);
--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
--text-base--line-height: calc(1.5 / 1);
--tracking-wider: .05em;
--font-weight-bold: 700;
--text-xs--line-height: calc(1 / .75);
--text-xl: 1.25rem;
--leading-relaxed: 1.625;
--leading-snug: 1.375;
--text-2xl--line-height: calc(2 / 1.5);
--text-8xl: 6rem;
--text-xl--line-height: calc(1.75 / 1.25);
--text-sm: .875rem;
--leading-tight: 1.25;
--text-4xl--line-height: calc(2.5 / 2.25);
--tracking-tight: -.025em;
--text-2xl: 1.5rem;
--text-7xl: 4.5rem;
--text-lg: 1.125rem;
--text-8xl--line-height: 1;
--text-5xl--line-height: 1;
--leading-normal: 1.5;
--text-lg--line-height: calc(1.75 / 1.125);
--text-6xl: 3.75rem;
--default-font-family: "Inter", "Inter Fallback";
--font-weight-light: 300;
--font-inter: "Inter", "Inter Fallback";
--text-7xl--line-height: 1;
--tracking-tighter: -.05em;
--tracking-wide: .025em;
--font-weight-semibold: 600;
--text-4xl: 2.25rem;
--tracking-normal: 0em;
--text-sm--line-height: calc(1.25 / .875);
--text-3xl--line-height: calc(2.25 / 1.875);
--text-5xl: 3rem;
--text-3xl: 1.875rem;
--text-xs: .75rem;
--tracking-widest: .1em;
--font-weight-medium: 500;
--font-weight-normal: 400;
--font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
--text-6xl--line-height: 1;
--text-base: 1rem;
--default-mono-font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
```

### Shadows

```css
--tw-inset-shadow-alpha: 100%;
--tw-inset-shadow: 0 0 #0000;
--tw-shadow-alpha: 100%;
--tw-drop-shadow-alpha: 100%;
--tw-shadow: 0 0 #0000;
```

### Radii

```css
--site-radius-xs: 2px;
--site-radius-sm: 4px;
--site-radius-md: 6px;
--site-radius-lg: 8px;
--site-radius-xl: 12px;
--site-radius-2xl: 16px;
--site-radius-3xl: 24px;
--site-radius-full: 9999px;
--radius: .625rem;
--radius-4xl: 2rem;
--radius-sm: calc(.625rem - 4px);
--radius-2xl: 1rem;
--radius-md: calc(.625rem - 2px);
--radius-lg: .625rem;
--radius-3xl: 1.5rem;
--radius-xs: .125rem;
--radius-xl: calc(.625rem + 4px);
```

### Other

```css
--site-background: #fff;
--site-input: #e5e5e5;
--site-sidebar: #fafafa;
--site-success: var(--color-emerald-500);
--site-info: var(--color-violet-500);
--site-warning: var(--color-yellow-500);
--site-invert: var(--color-zinc-900);
--site-surface: #f8f8f8;
--site-code: var(--site-surface);
--site-code-highlight: #f2f2f2;
--site-code-number: #747474;
--site-selection: #0a0a0a;
--background: #fff;
--input: #e5e5e5;
--sidebar: #fafafa;
--success: var(--color-emerald-500);
--info: var(--color-violet-500);
--warning: var(--color-yellow-500);
--invert: var(--color-zinc-900);
--surface: #f8f8f8;
--code: var(--surface);
--code-highlight: #f2f2f2;
--code-number: #747474;
--selection: #0a0a0a;
--container-md: 28rem;
--tw-mask-left-to-position: 100%;
--aspect-video: 16 / 9;
--tw-animation-delay: 0s;
--tw-mask-conic: linear-gradient(#fff, #fff);
--tw-outline-style: solid;
--ease-in: cubic-bezier(.4, 0, 1, 1);
--tw-enter-scale: 1;
--tw-mask-top-to-position: 100%;
--tw-gradient-from: rgba(0, 0, 0, 0);
--tw-gradient-to: rgba(0, 0, 0, 0);
--blur-2xl: 40px;
--tw-exit-translate-y: 0;
--tw-gradient-via-position: 50%;
--tw-mask-right: linear-gradient(#fff, #fff);
--tw-gradient-to-position: 100%;
--default-transition-duration: .15s;
--animate-pulse: pulse 2s cubic-bezier(.4, 0, .6, 1) infinite;
--container-xs: 20rem;
--default-transition-timing-function: cubic-bezier(.4, 0, .2, 1);
--tw-animation-iteration-count: 1;
--tw-exit-opacity: 1;
--tw-translate-z: 0;
--tw-gradient-via: rgba(0, 0, 0, 0);
--tw-scale-y: 1;
--tw-mask-radial: linear-gradient(#fff, #fff);
--container-6xl: 72rem;
--tw-exit-translate-x: 0;
--container-3xl: 48rem;
--tw-translate-y: 0;
--blur-xs: 4px;
--ease-out: cubic-bezier(0, 0, .2, 1);
--tw-content: "";
--tw-mask-top: linear-gradient(#fff, #fff);
--tw-translate-x: 0;
--tw-enter-rotate: 0;
--tw-enter-blur: 0;
--tw-mask-right-from-position: 0%;
--animate-bounce: bounce 1s infinite;
--container-xl: 36rem;
--tw-mask-linear: linear-gradient(#fff, #fff);
--tw-scrollbar-track: rgba(0, 0, 0, 0);
--tw-animation-direction: normal;
--animate-ping: ping 1s cubic-bezier(0, 0, .2, 1) infinite;
--tw-mask-left-from-position: 0%;
--tw-divide-x-reverse: 0;
--breakpoint-2xl: 96rem;
--tw-mask-bottom-to-position: 100%;
--tw-exit-rotate: 0;
--tw-scale-z: 1;
--container-sm: 24rem;
--tw-scroll-snap-strictness: proximity;
--container-lg: 32rem;
--tw-gradient-from-position: 0%;
--ease-in-out: cubic-bezier(.4, 0, .2, 1);
--tw-animation-fill-mode: none;
--tw-mask-right-to-position: 100%;
--container-5xl: 64rem;
--tw-exit-blur: 0;
--container-2xs: 18rem;
--blur-md: 12px;
--animate-spin: spin 1s linear infinite;
--tw-enter-translate-x: 0;
--container-4xl: 56rem;
--tw-mask-left: linear-gradient(#fff, #fff);
--tw-mask-bottom-from-position: 0%;
--tw-divide-y-reverse: 0;
--container-2xl: 42rem;
--tw-exit-scale: 1;
--tw-mask-top-from-position: 0%;
--tw-scrollbar-thumb: rgba(0, 0, 0, 0);
--tw-scale-x: 1;
--tw-enter-translate-y: 0;
--tw-mask-bottom: linear-gradient(#fff, #fff);
--tw-enter-opacity: 1;
--container-7xl: 80rem;
--blur-sm: 8px;
```

### Dependencies

```css
--site-font-sans: --font-inter;
--site-font-heading: --font-inter;
--site-font-mono: --font-mono;
--site-destructive-foreground: --color-red-800;
--site-success: --color-emerald-500;
--site-success-foreground: --color-emerald-900;
--site-info: --color-violet-500;
--site-info-foreground: --color-violet-900;
--site-warning: --color-yellow-500;
--site-warning-foreground: --color-yellow-900;
--site-invert: --color-zinc-900;
--site-invert-foreground: --color-zinc-50;
--site-surface-foreground: --site-foreground;
--site-code: --site-surface;
--site-code-foreground: --site-surface-foreground;
--font-sans: --font-inter;
--font-heading: --font-inter;
--destructive-foreground: --color-red-800;
--success: --color-emerald-500;
--success-foreground: --color-emerald-900;
--info: --color-violet-500;
--info-foreground: --color-violet-900;
--warning: --color-yellow-500;
--warning-foreground: --color-yellow-900;
--invert: --color-zinc-900;
--invert-foreground: --color-zinc-50;
--surface-foreground: --foreground;
--code: --surface;
--code-foreground: --surface-foreground;
```

### Semantic

```css
success: [object Object];
warning: [object Object];
error: [object Object];
info: [object Object];
```

## Breakpoints

| Name | Value | Type |
|------|-------|------|
| sm | 600px | max-width |

## Transitions & Animations

**Easing functions:** `[object Object]`, `[object Object]`, `[object Object]`

**Durations:** `0.15s`, `0.2s`, `1.1s`, `0.3s`

### Common Transitions

```css
transition: all;
transition: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), outline-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-from 0.15s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-via 0.15s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-to 0.15s cubic-bezier(0.4, 0, 0.2, 1);
transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), translate 0.2s cubic-bezier(0.4, 0, 0.2, 1), scale 0.2s cubic-bezier(0.4, 0, 0.2, 1), rotate 0.2s cubic-bezier(0.4, 0, 0.2, 1);
transition: color 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), outline-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), fill 0.2s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.2s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-from 0.2s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-via 0.2s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-to 0.2s cubic-bezier(0.4, 0, 0.2, 1);
transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1);
transition: stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1);
transition: transform 0.3s cubic-bezier(0, 0, 0.2, 1), translate 0.3s cubic-bezier(0, 0, 0.2, 1), scale 0.3s cubic-bezier(0, 0, 0.2, 1), rotate 0.3s cubic-bezier(0, 0, 0.2, 1);
transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), outline-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), fill 0.3s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-from 0.3s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-via 0.3s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-to 0.3s cubic-bezier(0.4, 0, 0.2, 1);
transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

### Keyframe Animations

**collapsible-down**
```css
@keyframes collapsible-down {
  0% { height: 0px; }
  100% { height: var(--radix-collapsible-content-height,var(--bits-collapsible-content-height,var(--reka-collapsible-content-height,var(--kb-collapsible-content-height,auto)))); }
}
```

**collapsible-up**
```css
@keyframes collapsible-up {
  0% { height: var(--radix-collapsible-content-height,var(--bits-collapsible-content-height,var(--reka-collapsible-content-height,var(--kb-collapsible-content-height,auto)))); }
  100% { height: 0px; }
}
```

**marquee-left**
```css
@keyframes marquee-left {
  0% { transform: translate(0px); }
  100% { transform: translate(-50%); }
}
```

**marquee-right**
```css
@keyframes marquee-right {
  0% { transform: translate(-50%); }
  100% { transform: translate(0px); }
}
```

**marquee-up**
```css
@keyframes marquee-up {
  0% { transform: translateY(0px); }
  100% { transform: translateY(-50%); }
}
```

**aurora-drift**
```css
@keyframes aurora-drift {
  0% { background-position: 30% center, 18% 38%, 82% 30%, 40% 78%, 66% 60%, 52% 24%; }
  25% { background-position: 48% 64%, 46% 60%, 58% 54%, 70% 40%, 28% 66%, 72% 44%; }
  50% { background-position: 66% 40%, 72% 42%, 30% 70%, 36% 64%, 74% 34%, 40% 70%; }
  75% { background-position: 40% 66%, 40% 72%, 66% 36%, 60% 30%, 34% 58%, 64% 52%; }
  100% { background-position: 30% center, 18% 38%, 82% 30%, 40% 78%, 66% 60%, 52% 24%; }
}
```

**aurora-breathe**
```css
@keyframes aurora-breathe {
  0%, 100% { transform: scale(1.08) rotate(0deg); }
  33% { transform: scale(1.16) rotate(2.2deg); }
  66% { transform: scale(1.11) rotate(-2.4deg); }
}
```

**spin**
```css
@keyframes spin {
  100% { transform: rotate(360deg); }
}
```

**ping**
```css
@keyframes ping {
  75%, 100% { opacity: 0; transform: scale(2); }
}
```

**pulse**
```css
@keyframes pulse {
  50% { opacity: 0.5; }
}
```

## Component Patterns

Detected UI component patterns and their most common styles:

### Buttons (41 instances)

```css
.button {
  background-color: lab(7.78201 -0.0000149012 0);
  color: lab(44.32 0 0);
  font-size: 14px;
  font-weight: 500;
  padding-top: 8px;
  padding-right: 0px;
  border-radius: 6px;
}
```

### Cards (77 instances)

```css
.card {
  background-color: lab(100 0 0);
  border-radius: 14px;
  box-shadow: rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px;
  padding-top: 24px;
  padding-right: 24px;
}
```

### Links (296 instances)

```css
.link {
  color: rgb(0, 0, 0);
  font-size: 14px;
  font-weight: 400;
}
```

### Navigation (74 instances)

```css
.navigatio {
  background-color: oklab(0.999998 -0.00000980496 0.0000234246 / 0.6);
  color: rgb(0, 0, 0);
  padding-top: 2px;
  padding-bottom: 2px;
  padding-left: 2px;
  padding-right: 2px;
  position: relative;
}
```

### Footer (71 instances)

```css
.foote {
  background-color: oklab(0.999998 -0.00000980496 0.0000234246 / 0.6);
  color: rgb(0, 0, 0);
  padding-top: 2px;
  padding-bottom: 2px;
  font-size: 16px;
}
```

### Dropdowns (3 instances)

```css
.dropdown {
  border-radius: 0px;
  border-color: lab(90.952 0 -0.0000119209);
  padding-top: 0px;
}
```

### Badges (3 instances)

```css
.badge {
  color: lab(44.32 0 0);
  font-size: 16px;
  font-weight: 400;
  padding-top: 0px;
  padding-right: 0px;
  border-radius: 0px;
}
```

### Tabs (14 instances)

```css
.tab {
  background-color: lab(7.78201 -0.0000149012 0);
  color: lab(44.32 0 0);
  font-size: 14px;
  font-weight: 500;
  padding-top: 8px;
  padding-right: 16px;
  border-color: lab(90.952 0 -0.0000119209);
  border-radius: 3.35544e+07px;
}
```

### Accordions (13 instances)

```css
.accordion {
  color: rgb(0, 0, 0);
  font-size: 14px;
  padding-top: 0px;
  padding-right: 0px;
  border-color: lab(90.952 0 -0.0000119209);
}
```

### Switches (3 instances)

```css
.switche {
  background-color: lab(90.952 0 -0.0000119209);
  border-radius: 0px;
  border-color: lab(90.952 0 -0.0000119209);
}
```

## Component Clusters

Reusable component instances grouped by DOM structure and style similarity:

### Button — 16 instances, 2 variants

**Variant 1** (3 instances)

```css
  background: lab(100 0 0);
  color: lab(2.75381 0 0);
  padding: 8px 12px 8px 12px;
  border-radius: 8px;
  border: 0px solid lab(90.952 0 -0.0000119209);
  font-size: 14px;
  font-weight: 500;
```

**Variant 2** (13 instances)

```css
  background: rgba(0, 0, 0, 0);
  color: rgb(0, 0, 0);
  padding: 16px 0px 16px 0px;
  border-radius: 6px;
  border: 0px solid lab(90.952 0 -0.0000119209);
  font-size: 16px;
  font-weight: 500;
```

### Button — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: rgba(0, 0, 0, 0);
  color: lab(2.75381 0 0);
  padding: 0px 0px 0px 0px;
  border-radius: 6px;
  border: 0px solid lab(90.952 0 -0.0000119209);
  font-size: 14px;
  font-weight: 500;
```

### Button — 6 instances, 1 variant

**Variant 1** (6 instances)

```css
  background: lab(7.78201 -0.0000149012 0);
  color: lab(98.26 0 0);
  padding: 8px 16px 8px 16px;
  border-radius: 9999px;
  border: 0px solid lab(90.952 0 -0.0000119209);
  font-size: 14px;
  font-weight: 500;
```

### Button — 16 instances, 1 variant

**Variant 1** (16 instances)

```css
  background: rgba(0, 0, 0, 0);
  color: lab(44.32 0 0);
  padding: 0px 0px 0px 0px;
  border-radius: 9999px;
  border: 0px solid lab(90.952 0 -0.0000119209);
  font-size: 12px;
  font-weight: 400;
```

### Button — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: lab(90.952 0 -0.0000119209);
  color: rgb(0, 0, 0);
  padding: 0px 0px 0px 0px;
  border-radius: 9999px;
  border: 1px solid rgba(0, 0, 0, 0);
  font-size: 16px;
  font-weight: 400;
```

### Card — 15 instances, 1 variant

**Variant 1** (15 instances)

```css
  background: lab(100 0 0);
  color: rgb(0, 0, 0);
  padding: 24px 24px 24px 24px;
  border-radius: 14px;
  border: 1px solid lab(90.952 0 -0.0000119209);
  font-size: 16px;
  font-weight: 400;
```

### Card — 4 instances, 1 variant

**Variant 1** (4 instances)

```css
  background: lab(100 0 0);
  color: rgb(0, 0, 0);
  padding: 24px 24px 24px 24px;
  border-radius: 14px;
  border: 1px solid lab(90.952 0 -0.0000119209);
  font-size: 16px;
  font-weight: 400;
```

### Card — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: lab(2.75381 0 0);
  color: lab(100 0 0);
  padding: 80px 0px 80px 0px;
  border-radius: 0px;
  border: 0px solid lab(90.952 0 -0.0000119209);
  font-size: 16px;
  font-weight: 400;
```

## Layout System

**8 grid containers** and **1100 flex containers** detected.

### Container Widths

| Max Width | Padding |
|-----------|---------|
| 1400px | 24px |
| 1152px | 64px |
| 896px | 48px |
| 1024px | 0px |
| 768px | 0px |

### Grid Column Patterns

| Columns | Usage Count |
|---------|-------------|
| 3-column | 3x |
| 5-column | 2x |
| 6-column | 1x |
| 10-column | 1x |
| 4-column | 1x |

### Grid Templates

```css
grid-template-columns: 256px 256px 256px 256px 256px;
grid-template-columns: 330.656px 330.672px 330.656px;
gap: 16px;
grid-template-columns: 211.188px 211.203px 211.203px 211.203px 211.188px;
gap: 40px 32px;
grid-template-columns: 118.188px 118.203px 118.203px 118.203px 118.188px 118.203px 118.203px 118.203px 118.203px 118.188px;
grid-template-columns: 444px 56px 444px;
gap: 24px 40px;
```

### Flex Patterns

| Direction/Wrap | Count |
|----------------|-------|
| column/nowrap | 251x |
| row/nowrap | 826x |
| row/wrap | 23x |

**Gap values:** `10px`, `12px`, `14px`, `16px`, `20px`, `24px`, `24px 40px`, `2px`, `32px`, `3px`, `40px 32px`, `4px`, `4px 8px`, `6px`, `6px 12px`, `6px 16px`, `8px`

## Accessibility (WCAG 2.1)

**Overall Score: 100%** — 0 passing, 0 failing color pairs

## Design System Score

**Overall: 92/100 (Grade: A)**

| Category | Score |
|----------|-------|
| Color Discipline | 100/100 |
| Typography Consistency | 90/100 |
| Spacing System | 85/100 |
| Shadow Consistency | 90/100 |
| Border Radius Consistency | 100/100 |
| Accessibility | 100/100 |
| CSS Tokenization | 100/100 |

**Strengths:** Tight, disciplined color palette, Consistent typography system, Well-defined spacing scale, Clean elevation system, Consistent border radii, Strong accessibility compliance, Good CSS variable tokenization

**Issues:**
- 642 !important rules — prefer specificity over overrides
- 39037 duplicate CSS declarations

## Gradients

**4 unique gradients** detected.

| Type | Direction | Stops | Classification |
|------|-----------|-------|----------------|
| linear | to right | 2 | brand |
| linear | — | 2 | brand |
| linear | — | 2 | brand |
| linear | — | 3 | bold |

```css
background: linear-gradient(to right, lab(90.952 0 -0.0000119209) 1px, rgba(0, 0, 0, 0) 1px);
background: linear-gradient(lab(90.952 0 -0.0000119209) 1px, rgba(0, 0, 0, 0) 1px);
background: linear-gradient(lab(100 0 0) 0%, lab(96.52 -0.0000298023 0.0000119209) 100%);
background: linear-gradient(oklab(0.999994 0.0000455677 0.0000200868 / 0.6) 0%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0) 100%);
```

## Z-Index Map

**4 unique z-index values** across 2 layers.

| Layer | Range | Elements |
|-------|-------|----------|
| sticky | 10,50 | div.r.e.l.a.t.i.v.e. .z.-.1.0. .f.l.e.x. .f.l.e.x.-.c.o.l. .i.t.e.m.s.-.c.e.n.t.e.r. .g.a.p.-.5. .t.e.x.t.-.c.e.n.t.e.r, div.c.o.n.t.a.i.n.e.r.-.w.r.a.p.p.e.r. .r.e.l.a.t.i.v.e. .z.-.1.0, div.b.o.r.d.e.r.-.s.i.t.e.-.b.o.r.d.e.r./.6.0. .r.e.l.a.t.i.v.e. .z.-.1.0. .g.r.i.d. .g.r.i.d.-.c.o.l.s.-.[.r.e.p.e.a.t.(.a.u.t.o.-.f.i.t.,.m.i.n.m.a.x.(.2.2.0.p.x.,.1.f.r.).).]. .o.v.e.r.f.l.o.w.-.h.i.d.d.e.n. .b.o.r.d.e.r.-.t. .b.o.r.d.e.r.-.b |
| base | -10,0 | canvas.p.o.i.n.t.e.r.-.e.v.e.n.t.s.-.n.o.n.e. .a.b.s.o.l.u.t.e. .i.n.s.e.t.-.0. .h.-.f.u.l.l. .w.-.f.u.l.l. .t.e.x.t.-.s.i.t.e.-.m.u.t.e.d.-.f.o.r.e.g.r.o.u.n.d. .-.z.-.1.0. .o.p.a.c.i.t.y.-.5.5. .[.m.a.s.k.-.c.o.m.p.o.s.i.t.e.:.i.n.t.e.r.s.e.c.t.]. .[.m.a.s.k.-.i.m.a.g.e.:.l.i.n.e.a.r.-.g.r.a.d.i.e.n.t.(.t.o._.r.i.g.h.t.,.t.r.a.n.s.p.a.r.e.n.t._.0.%.,.#.0.0.0._.2.8.%.,.#.0.0.0._.7.2.%.,.t.r.a.n.s.p.a.r.e.n.t._.1.0.0.%.).,.l.i.n.e.a.r.-.g.r.a.d.i.e.n.t.(.t.o._.b.o.t.t.o.m.,.t.r.a.n.s.p.a.r.e.n.t._.0.%.,.#.0.0.0._.3.4.%.,.#.0.0.0._.6.6.%.,.t.r.a.n.s.p.a.r.e.n.t._.1.0.0.%.).]. .[.-.w.e.b.k.i.t.-.m.a.s.k.-.c.o.m.p.o.s.i.t.e.:.s.o.u.r.c.e.-.i.n.], div.p.o.i.n.t.e.r.-.e.v.e.n.t.s.-.n.o.n.e. .a.b.s.o.l.u.t.e. .i.n.s.e.t.-.x.-.0. .t.o.p.-.0. .z.-.0. .b.g.-.[.l.i.n.e.a.r.-.g.r.a.d.i.e.n.t.(.t.o._.r.i.g.h.t.,.v.a.r.(.-.-.c.o.l.o.r.-.s.i.t.e.-.b.o.r.d.e.r.)._.1.p.x.,.t.r.a.n.s.p.a.r.e.n.t._.1.p.x.).,.l.i.n.e.a.r.-.g.r.a.d.i.e.n.t.(.t.o._.b.o.t.t.o.m.,.v.a.r.(.-.-.c.o.l.o.r.-.s.i.t.e.-.b.o.r.d.e.r.)._.1.p.x.,.t.r.a.n.s.p.a.r.e.n.t._.1.p.x.).]. .b.g.-.[.s.i.z.e.:.3.p.x._.3.p.x.]. .h.-.[.5.0.v.h.]. .o.p.a.c.i.t.y.-.4.5. .[.m.a.s.k.-.i.m.a.g.e.:.l.i.n.e.a.r.-.g.r.a.d.i.e.n.t.(.t.o._.b.o.t.t.o.m.,.#.0.0.0.,.t.r.a.n.s.p.a.r.e.n.t._.5.0.%.).], div.p.o.i.n.t.e.r.-.e.v.e.n.t.s.-.n.o.n.e. .a.b.s.o.l.u.t.e. .i.n.s.e.t.-.x.-.0. .t.o.p.-.0. .z.-.0. .b.g.-.[.l.i.n.e.a.r.-.g.r.a.d.i.e.n.t.(.t.o._.r.i.g.h.t.,.v.a.r.(.-.-.c.o.l.o.r.-.s.i.t.e.-.b.o.r.d.e.r.)._.1.p.x.,.t.r.a.n.s.p.a.r.e.n.t._.1.p.x.).,.l.i.n.e.a.r.-.g.r.a.d.i.e.n.t.(.t.o._.b.o.t.t.o.m.,.v.a.r.(.-.-.c.o.l.o.r.-.s.i.t.e.-.b.o.r.d.e.r.)._.1.p.x.,.t.r.a.n.s.p.a.r.e.n.t._.1.p.x.).]. .b.g.-.[.s.i.z.e.:.3.p.x._.3.p.x.]. .h.-.[.2.6.0.0.p.x.]. .o.p.a.c.i.t.y.-.5.0. .[.m.a.s.k.-.i.m.a.g.e.:.l.i.n.e.a.r.-.g.r.a.d.i.e.n.t.(.t.o._.b.o.t.t.o.m.,.#.0.0.0.,.t.r.a.n.s.p.a.r.e.n.t._.4.%.).] |

## SVG Icons

**138 unique SVG icons** detected. Dominant style: **outlined**.

| Size Class | Count |
|------------|-------|
| xs | 8 |
| sm | 13 |
| md | 74 |
| xl | 43 |

**Icon colors:** `currentColor`, `rgb(0, 0, 0)`, `url(#free-underline-gradient)`, `#D97757`, `#111`, `#282423`, `black`, `url(#a)`, `#4B73FF`, `#FF66F4`

## Font Files

| Family | Source | Weights | Styles |
|--------|--------|---------|--------|
| Inter | self-hosted | 100 900 | normal |
| Geist | self-hosted | 100 900 | normal |
| Noto Sans | self-hosted | 100 900 | normal |
| Nunito Sans | self-hosted | 200 1000 | normal |
| Figtree | self-hosted | 300 900 | normal |
| Roboto | self-hosted | 100 900 | normal |
| Raleway | self-hosted | 100 900 | normal |
| DM Sans | self-hosted | 100 1000 | normal |
| Public Sans | self-hosted | 100 900 | normal |
| Outfit | self-hosted | 100 900 | normal |
| Oxanium | self-hosted | 200 800 | normal |
| Manrope | self-hosted | 200 800 | normal |
| Space Grotesk | self-hosted | 300 700 | normal |
| Montserrat | self-hosted | 100 900 | normal |
| IBM Plex Sans | self-hosted | 100 700 | normal |
| Source Sans 3 | self-hosted | 200 900 | normal |
| Instrument Sans | self-hosted | 400 700 | normal |
| JetBrains Mono | self-hosted | 100 800 | normal |
| Geist Mono | self-hosted | 100 900 | normal |
| Noto Serif | self-hosted | 100 900 | normal |
| Roboto Slab | self-hosted | 100 900 | normal |
| Merriweather | self-hosted | 300 900 | normal |
| Lora | self-hosted | 400 700 | normal |
| Playfair Display | self-hosted | 400 900 | normal |

## Image Style Patterns

| Pattern | Count | Key Styles |
|---------|-------|------------|
| thumbnail | 39 | objectFit: fill, borderRadius: 0px, shape: square |
| general | 6 | objectFit: cover, borderRadius: 0px, shape: square |

**Aspect ratios:** 1:1 (39x), 3:2 (6x)

## Motion Language

**Feel:** mixed · **Scroll-linked:** yes

### Duration Tokens

| name | value | ms |
|---|---|---|
| `xs` | `150ms` | 150 |
| `sm` | `200ms` | 200 |
| `md` | `300ms` | 300 |
| `xl` | `1.1s` | 1100 |

### Easing Families

- **custom** (716 uses) — `cubic-bezier(0.4, 0, 0.2, 1)`
- **ease-out** (12 uses) — `cubic-bezier(0.22, 1, 0.36, 1)`, `cubic-bezier(0, 0, 0.2, 1)`

### Keyframes In Use

| name | kind | properties | uses |
|---|---|---|---|
| `spin` | rotate | transform | 1 |
| `ping` | reveal | opacity, transform | 2 |
| `accordion-up` | custom | height | 13 |

## Component Anatomy

### button — 40 instances

**Slots:** label, icon
**Variants:** outline · primary
**Sizes:** lg · md · sm · xs

| variant | count | sample label |
|---|---|---|
| outline | 38 | Products |
| primary | 2 |  |

### card — 20 instances

**Slots:** heading, media
**Sizes:** xs

## Brand Voice

**Tone:** neutral · **Pronoun:** you-only · **Headings:** Title Case (balanced)

### Top CTA Verbs

- **what** (3)
- **what's** (2)
- **are** (2)
- **does** (2)
- **products** (1)
- **resources** (1)
- **all** (1)
- **application** (1)

### Button Copy Patterns

- "+7" (2×)
- "products" (1×)
- "resources" (1×)
- "all
501" (1×)
- "application
291" (1×)
- "data grid
35" (1×)
- "solutions
64" (1×)
- "ecommerce
87" (1×)
- "marketing
24" (1×)
- "+4" (1×)

### Sample Headings

> Design-forward
shadcn/ui
platform with MCP fluency for agents
> Endorsed by the creator of shadcn/ui
> 1,052 Free
 Shadcn UI Components
> Whole apps, not just screens
> Verve - Next.js CRM Template
> Design-forward
shadcn/ui
platform with MCP fluency for agents
> Endorsed by the creator of shadcn/ui
> 1,052 Free
 Shadcn UI Components
> Whole apps, not just screens
> Verve - Next.js CRM Template

## Page Intent

**Type:** `landing` (confidence 0.31)
**Description:** Free Shadcn UI components and pro blocks for React and Tailwind CSS. Hand-crafted icons, templates, and a hosted MCP server so coding agents build with the shadcn CLI.

Alternates: blog-post (0.35)

## Section Roles

Reading order (top→bottom): nav → nav → faq → content → faq → nav → content → pricing → content → hero → comparison → comparison → content → faq → pricing → content → footer → content

| # | Role | Heading | Confidence |
|---|------|---------|------------|
| 0 | nav | — | 0.4 |
| 1 | nav | — | 0.9 |
| 2 | faq | Design-forward
shadcn/ui
platform with MCP fluency for agents | 0.85 |
| 3 | content | Design-forward
shadcn/ui
platform with MCP fluency for agents | 0.3 |
| 4 | faq | — | 0.85 |
| 5 | nav | — | 0.4 |
| 6 | content | Endorsed by the creator of shadcn/ui | 0.3 |
| 7 | pricing | 1,052 Free
 Shadcn UI Components | 0.4 |
| 8 | content | Whole apps, not just screens | 0.3 |
| 9 | hero | 638 Hand-crafted Premium Icons | 0.4 |
| 10 | comparison | Connect ReUI to your Coding Agent | 0.7 |
| 11 | comparison | ReUI or the Grind | 0.7 |
| 12 | content | — | 0.3 |
| 13 | faq | Frequently Asked Questions | 0.85 |
| 14 | pricing | Everything you need to ship with shadcn/ui | 0.4 |
| 15 | content | Start building with ReUI Pro today. | 0.3 |
| 16 | footer | Application | 0.95 |
| 17 | content | — | 0.3 |

## Material Language

**Label:** `flat` (confidence 0)

| Metric | Value |
|--------|-------|
| Avg saturation | 0.143 |
| Shadow profile | soft |
| Avg shadow blur | 0px |
| Max radius | 9999px |
| backdrop-filter in use | no |
| Gradients | 4 |

## Imagery Style

**Label:** `icon-only` (confidence 0.044)
**Counts:** total 45, svg 0, icon 39, screenshot-like 0, photo-like 0
**Dominant aspect:** square-ish
**Radius profile on images:** square

## Component Library

**Detected:** `tailwindcss` (confidence 0.608)

Evidence:
- tailwind-like class density 61%

Also considered: tailwind-ui (0.54)

## Component Screenshots

19 retina crops written to `screenshots/`. Index: `*-screenshots.json`.

| Cluster | Variant | Size (px) | File |
|---------|---------|-----------|------|
| button--outline--lg | 0 | 102 × 36 | `screenshots/button-outline-lg-0.png` |
| button--outline--lg | 1 | 113 × 36 | `screenshots/button-outline-lg-1.png` |
| button--outline--md | 0 | 32 × 32 | `screenshots/button-outline-md-0.png` |
| button--outline--md | 1 | 32 × 32 | `screenshots/button-outline-md-1.png` |
| button--outline--md | 2 | 28 × 28 | `screenshots/button-outline-md-2.png` |
| button--destructive--md | 0 | 83 × 28 | `screenshots/button-destructive-md-0.png` |
| button--destructive--md | 1 | 82 × 28 | `screenshots/button-destructive-md-1.png` |
| button--destructive--md | 2 | 108 × 28 | `screenshots/button-destructive-md-2.png` |
| button--default--md | 0 | 252 × 28 | `screenshots/button-default-md-0.png` |
| button--default--md | 1 | 84 × 28 | `screenshots/button-default-md-1.png` |
| button--default--md | 2 | 240 × 28 | `screenshots/button-default-md-2.png` |
| button--outline--sm | 0 | 80 × 36 | `screenshots/button-outline-sm-0.png` |
| button--outline--sm | 1 | 139 × 36 | `screenshots/button-outline-sm-1.png` |
| button--outline--sm | 2 | 118 × 36 | `screenshots/button-outline-sm-2.png` |
| button--primary--xs | 0 | 32 × 18 | `screenshots/button-primary-xs-0.png` |
| card--default--xs | 0 | 325 × 174 | `screenshots/card-default-xs-0.png` |
| card--default--xs | 1 | 325 × 174 | `screenshots/card-default-xs-1.png` |
| card--default--xs | 2 | 325 × 174 | `screenshots/card-default-xs-2.png` |
| card--default | 0 | 1280 × 340 | `screenshots/card-default-0.png` |

Full-page: `screenshots/full-page.png`

## Quick Start

To recreate this design in a new project:

1. **Install fonts:** Add `Inter` from Google Fonts or your font provider
2. **Import CSS variables:** Copy `variables.css` into your project
3. **Tailwind users:** Use the generated `tailwind.config.js` to extend your theme
4. **Design tokens:** Import `design-tokens.json` for tooling integration
