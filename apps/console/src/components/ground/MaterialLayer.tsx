'use client';

// SOURCING: hand-roll (MaterialLayer). Spec 34 + amendment 35, refined for
// JetBrains Islands: quieter ground pools, island surfaces carry a hint of
// terracotta, header bands read slightly richer than flatter island bodies.
// Owns frame, island fill, and the window-inactive wash (inactiveAlpha).
// DOM keeps text, focus, and hit-testing only. Paper MCP designs the anatomy;
// this canvas is the console ground shader (not @paper-design/shaders-react).
//
// Zed-flat pass (2026-07-29): the rim, sheen, and vignette constants below are
// deliberately faint. Depth is tone + hairline in the register; the shader
// confirms a boundary the tokens already made, it does not paint elevation of
// its own. Raising these constants re-creates the double-papering regression.

import { useEffect, useRef } from 'react';

const MAX_ISLANDS = 12;

const VERTEX = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

const FRAGMENT = `
precision highp float;
uniform vec2 res;
uniform vec4 isl[${MAX_ISLANDS}];
uniform float rad[${MAX_ISLANDS}];
uniform float cls[${MAX_ISLANDS}];
uniform float band[${MAX_ISLANDS}];
uniform int n;
uniform vec3 cFrame; uniform vec3 cTerra; uniform float glow;
uniform vec3 cTool; uniform vec3 cEditor; uniform vec3 cHeaderTool; uniform vec3 cHeaderEditor; uniform vec3 cHiMix;
uniform float grain; uniform float dark; uniform float islandTint;
uniform float inactiveAlpha;
uniform float gutterPx;

float sdRound(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return length(max(q,0.)) + min(max(q.x,q.y),0.) - r;
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

void main(){
  vec2 uv = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 nuv = uv / res;

  /* Quieter layered pools: still strongest top-left, never a hot wash. */
  float g1 = 1. - smoothstep(0., 1.35, length(nuv - vec2(0.10, 0.04)));
  float g2 = (1. - smoothstep(0., 1.05, length(nuv - vec2(0.96, 0.92)))) * 0.38;
  float g3 = (1. - smoothstep(0., 1.4, length(nuv - vec2(0.55, 0.55)))) * 0.12;
  float t = clamp(g1 + g2 + g3, 0., 1.) * glow;
  vec3 col = mix(cFrame, cTerra, t);
  col += (hash(uv * 0.9) - .5) * grain * 0.72;

  float gut = max(gutterPx, 4.);

  for(int i=0;i<${MAX_ISLANDS};i++){
    if(i>=n) break;
    vec2 c = isl[i].xy + isl[i].zw*0.5;
    float minSide = min(isl[i].z, isl[i].w);
    /* Falloff keyed to gutter and island scale so full-bleed blocks keep a
       readable rim instead of clipping a fixed ~20px shadow. */
    float shadowReach = mix(gut * 1.35, gut * 2.4, clamp(minSide / 900., 0., 1.));
    float shadowK = 2.2 / max(shadowReach, 1.);
    float d = sdRound(uv - c - vec2(0., shadowReach * 0.35), isl[i].zw*0.5, rad[i]);
    /* Zed-flat: the rim is a confirmation, not a painted drop shadow. The
       editor plane is exempt: it is the sunk centre, and a cast rim is the
       one thing that makes a recess read as a card sitting on the ground.
       Tool windows keep theirs, which is what carries sidebar-lifted. */
    if(d > 0. && cls[i] < 0.5) col *= 1. - exp(-d * shadowK) * (0.10 + 0.04*(1.-dark));
  }

  for(int i=0;i<${MAX_ISLANDS};i++){
    if(i>=n) break;
    vec2 c = isl[i].xy + isl[i].zw*0.5;
    float d = sdRound(uv - c, isl[i].zw*0.5, rad[i]);
    float cov = 1. - smoothstep(-0.75, 0.75, d);
    if(cov > 0.){
      vec3 base = mix(cTool, cEditor, cls[i]);
      vec3 headerBase = mix(cHeaderTool, cHeaderEditor, cls[i]);
      float by = uv.y - isl[i].y;
      float ih = max(isl[i].w, 1.);
      float minSide = min(isl[i].z, ih);
      /* Coverage scale: short cards keep a soft full-height wash; tall blocks
         concentrate gradient near the top so sheen stays visible. */
      float cover = clamp(minSide / 720., 0., 1.);
      float gradEnd = mix(0.85, 0.22, cover);
      float hiBoost = mix(1., 2.4, cover);
      /* Header band vs body: header token over island base. */
      float headerMix = band[i] > 0.5
        ? (1. - smoothstep(band[i] - 1.0, band[i] + 1.0, by))
        : 0.;
      base = mix(base, headerBase, headerMix);
      float ty = clamp(by / ih, 0., 1.);
      vec3 surf = mix(base + cHiMix * hiBoost, base, smoothstep(0., gradEnd, ty));
      /* Body reads flatter / more planar; header keeps a soft lit edge. */
      surf = mix(surf, base, (1. - headerMix) * 0.22);
      float sheenH = mix(6., 18., cover);
      float sheen = (1. - smoothstep(0., sheenH, by)) * (dark>.5 ? .03 : .04);
      surf += sheen * mix(0.45, 1.2, headerMix);
      float innerReach = mix(14., 36., cover);
      float inner = clamp(-d, 0., innerReach);
      surf *= mix(1. - (dark>.5 ? .03 : .015), 1., smoothstep(0., innerReach * 0.75, inner));
      /* Header takes a touch more terracotta; body stays quieter. */
      surf = mix(surf, cTerra, islandTint * (0.35 + 0.65 * t) * mix(0.7, 1.35, headerMix));
      surf += (hash(uv + float(i)*7.13) - .5) * grain * mix(0.35, 1.55, headerMix);
      col = mix(col, surf, cov);
      /* Window blur: frame wash over islands only (owns --ij-inactive-alpha). */
      col = mix(col, cFrame, cov * inactiveAlpha);
    }
  }
  gl_FragColor = vec4(col, 1.);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/* Display P3 to sRGB, both gamma encoded, because the shader is fed encoded
   values (a hex channel over 255) and has to keep being fed them. */
const P3_TO_SRGB_LINEAR = [
  [1.2249401762, -0.2249401762, 0],
  [-0.0420569547, 1.0420569547, 0],
  [-0.0196375546, -0.0786360454, 1.0982736],
];
const decode = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const encode = (c: number) => {
  const clamped = Math.min(1, Math.max(0, c));
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
};

function p3ToSrgb(rgb: number[]): [number, number, number] {
  const linear = rgb.map(decode);
  return P3_TO_SRGB_LINEAR.map((row) =>
    encode(row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2]),
  ) as [number, number, number];
}

/* The probe lets the browser do the parsing, which is right, but the readback
   has to respect the colour space it hands back. Computed colour preserves the
   space rather than normalising to an sRGB triple, so once the register started
   resolving to Twenty's `color(display-p3 r g b)` a bare digit scan read the
   "3" of "display-p3" as the red channel: every surface came back near black,
   every caller fell through to its dark fallback, and the light ground rendered
   as a dark wash. Nothing threw, because the fallbacks are `??`. */
function cssToRgb(css: string): [number, number, number] | null {
  const probe = document.createElement('div');
  probe.style.color = css.length > 0 ? css : 'transparent';
  document.body.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();

  const spaced = computed.match(
    /^color\(\s*(display-p3|srgb)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/i,
  );
  if (spaced) {
    const channels = [Number(spaced[2]), Number(spaced[3]), Number(spaced[4])];
    if (channels.some((n) => !Number.isFinite(n))) return null;
    return spaced[1].toLowerCase() === 'srgb'
      ? (channels.map((c) => Math.min(1, Math.max(0, c))) as [number, number, number])
      : p3ToSrgb(channels);
  }

  const parts = computed.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return null;
  return [Number(parts[0]) / 255, Number(parts[1]) / 255, Number(parts[2]) / 255];
}

function cssNumber(raw: string, fallback: number): number {
  const value = Number.parseFloat(raw.trim());
  return Number.isFinite(value) ? value : fallback;
}

function isDarkTheme(): boolean {
  const root = document.documentElement;
  const theme = root.getAttribute('data-theme');
  if (theme === 'light') return false;
  if (theme === 'dark') return true;
  return !window.matchMedia('(prefers-color-scheme: light)').matches;
}

function islandClass(kind: string | undefined): number {
  if (kind === 'editor') return 1;
  return 0;
}

export function MaterialLayer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = (name: string) => gl.getUniformLocation(program, name);

    let rafId = 0;
    let running = true;
    let dirty = true;

    const markDirty = () => {
      dirty = true;
    };

    const paint = () => {
      if (!running) return;
      rafId = requestAnimationFrame(paint);
      if (!dirty || document.hidden) return;
      dirty = false;

      const host = canvas.parentElement;
      const cssW = Math.min(host?.clientWidth ?? canvas.clientWidth, 8192);
      const cssH = Math.min(host?.clientHeight ?? canvas.clientHeight, 8192);
      if (cssW < 1 || cssH < 1) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(cssW * dpr);
      const height = Math.floor(cssH * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);

      const hostRect = (host ?? canvas).getBoundingClientRect();
      /* An island inside an island is not a second island. The editor region
         declares one (tab strip plus well) and the BlockShell it hosts
         declares another, so the shader was drawing a rim inside a rim about
         40px apart and the centre read as a card floating on a card. CS2's
         concentric rule already says a child never repeats its parent's
         radius; this is the same rule for the material. The parent owns the
         plane. */
      const islands = [...document.querySelectorAll<HTMLElement>('[data-island]')]
        .filter((node) => node.parentElement?.closest('[data-island]') == null);
      const rects: number[] = [];
      const radii: number[] = [];
      const classes: number[] = [];
      const bands: number[] = [];
      const rootStyle = getComputedStyle(document.documentElement);
      const fallbackRadius = cssNumber(rootStyle.getPropertyValue('--ij-island-radius'), 12);
      const radiusBySize: Readonly<Record<string, number>> = {
        s: cssNumber(rootStyle.getPropertyValue('--ij-radius-xs'), fallbackRadius),
        m: cssNumber(rootStyle.getPropertyValue('--ij-radius-sm'), fallbackRadius),
        v: cssNumber(rootStyle.getPropertyValue('--ij-radius-md'), fallbackRadius),
        sq: cssNumber(rootStyle.getPropertyValue('--ij-radius-md'), fallbackRadius),
        w: cssNumber(rootStyle.getPropertyValue('--ij-radius-lg'), fallbackRadius),
        full: cssNumber(rootStyle.getPropertyValue('--ij-radius-xl'), fallbackRadius),
      };
      const gutterCss = cssNumber(rootStyle.getPropertyValue('--ij-island-gutter'), 6) * dpr;

      for (const node of islands.slice(0, MAX_ISLANDS)) {
        const box = node.getBoundingClientRect();
        if (box.width < 1 || box.height < 1) continue;
        const x = (box.left - hostRect.left) * dpr;
        const y = (box.top - hostRect.top) * dpr;
        const w = box.width * dpr;
        const h = box.height * dpr;
        const kind = node.dataset.island;
        let bandPx = Number.parseFloat(node.dataset.islandBand ?? '0');
        if (!Number.isFinite(bandPx) || bandPx <= 0) {
          const header = node.querySelector<HTMLElement>(
            '[data-island-header], [data-editor-tab-strip], [data-tool-window-header]',
          );
          bandPx = header?.getBoundingClientRect().height ?? 0;
        }
        if ((!Number.isFinite(bandPx) || bandPx <= 0) && kind === 'tool') {
          bandPx = cssNumber(rootStyle.getPropertyValue('--ij-toolwindow-header-h'), 36);
        }
        const nodeRadius = radiusBySize[node.dataset.blockSize ?? ''] ?? fallbackRadius;
        rects.push(x, y, w, h);
        radii.push(nodeRadius * dpr);
        classes.push(islandClass(kind));
        bands.push(bandPx > 0 ? bandPx * dpr : 0);
      }
      const count = radii.length;
      while (rects.length < MAX_ISLANDS * 4) {
        rects.push(0, 0, 0, 0);
        radii.push(0);
        classes.push(0);
        bands.push(0);
      }

      const dark = isDarkTheme() ? 1 : 0;
      const frame = cssToRgb(rootStyle.getPropertyValue('--ij-frame').trim()) ?? [0.063, 0.063, 0.067];
      const terra = cssToRgb(rootStyle.getPropertyValue('--ij-ground-terra').trim()) ?? frame;
      const tool = cssToRgb(rootStyle.getPropertyValue('--ij-chrome').trim()) ?? [0.094, 0.098, 0.108];
      const editor = cssToRgb(rootStyle.getPropertyValue('--ij-editor').trim()) ?? [0.118, 0.122, 0.133];
      const headerTool = cssToRgb(rootStyle.getPropertyValue('--ij-island-header-tool').trim()) ?? tool;
      const headerEditor = cssToRgb(rootStyle.getPropertyValue('--ij-island-header-editor').trim()) ?? editor;
      const hi = dark > 0.5 ? [0.014, 0.014, 0.016] : [0, 0, 0];
      const glow = cssNumber(rootStyle.getPropertyValue('--ij-material-glow'), dark > 0.5 ? 0.32 : 0.22);
      const grain = cssNumber(rootStyle.getPropertyValue('--ij-material-grain'), 0.012) * (dark > 0.5 ? 1 : 1.3);
      const tint = cssNumber(rootStyle.getPropertyValue('--ij-island-terra-tint'), 0);
      const inactive =
        document.documentElement.getAttribute('data-window-inactive') === 'true'
          ? cssNumber(rootStyle.getPropertyValue('--ij-inactive-alpha'), 0.44)
          : 0;

      gl.uniform2f(U('res'), width, height);
      gl.uniform4fv(U('isl'), new Float32Array(rects));
      gl.uniform1fv(U('rad'), new Float32Array(radii));
      gl.uniform1fv(U('cls'), new Float32Array(classes));
      gl.uniform1fv(U('band'), new Float32Array(bands));
      gl.uniform1i(U('n'), count);
      gl.uniform3fv(U('cFrame'), new Float32Array(frame));
      gl.uniform3fv(U('cTerra'), new Float32Array(terra));
      gl.uniform3fv(U('cTool'), new Float32Array(tool));
      gl.uniform3fv(U('cEditor'), new Float32Array(editor));
      gl.uniform3fv(U('cHeaderTool'), new Float32Array(headerTool));
      gl.uniform3fv(U('cHeaderEditor'), new Float32Array(headerEditor));
      gl.uniform3fv(U('cHiMix'), new Float32Array(hi));
      gl.uniform1f(U('glow'), glow);
      gl.uniform1f(U('grain'), grain);
      gl.uniform1f(U('dark'), dark);
      gl.uniform1f(U('islandTint'), tint);
      gl.uniform1f(U('inactiveAlpha'), inactive);
      gl.uniform1f(U('gutterPx'), gutterCss);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const resizeObserver = new ResizeObserver(markDirty);
    resizeObserver.observe(canvas.parentElement ?? canvas);
    for (const node of document.querySelectorAll('[data-island]')) {
      resizeObserver.observe(node);
    }

    const mutation = new MutationObserver(() => {
      for (const node of document.querySelectorAll('[data-island]')) {
        resizeObserver.observe(node);
      }
      markDirty();
    });
    mutation.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-island', 'data-island-band', 'style', 'class', 'data-theme', 'data-density'],
    });

    window.addEventListener('resize', markDirty);
    const themeObserver = new MutationObserver(markDirty);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        'data-theme',
        'data-register',
        'data-density',
        'data-window-inactive',
        'style',
        'class',
      ],
    });

    rafId = requestAnimationFrame(paint);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      mutation.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('resize', markDirty);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-material-layer
      data-ground-canvas
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
