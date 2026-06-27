import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const ROOT = process.cwd()
const MIN_AA_NORMAL = 4.5
const COMMONPLACE_DIRS = ["src/components/commonplace", "src/app/(commonplace)"]
const COMMONPLACE_STYLE_FILES = [
  "src/styles/commonplace.css",
  "src/styles/commonplace-tokens.css",
  "src/styles/commonplace-tokens-neutral.css",
  "src/styles/object-cards.css",
]
const DARK_CONTEXT_FILES = [
  "src/components/commonplace/ask/AskBar.module.css",
  "src/components/commonplace/shell/CommonPlaceSidebar.tsx",
]
const TOKEN_FILE = "src/styles/commonplace-tokens.css"
const TEXT_TOKENS = [
  "--cp-text",
  "--cp-text-muted",
  "--cp-text-faint",
  "--cp-text-ghost",
]
const SURFACE_TOKENS = ["--cp-bg", "--cp-surface", "--cp-card"]
const EXTRA_SURFACES = {
  "agent-thread-control": "#F4F3F0",
  white: "#FFFFFF",
}

function hexToRgb(hex) {
  const value = hex.replace("#", "")
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16))
}

function linearize(channel) {
  const value = channel / 255
  if (value <= 0.03928) return value / 12.92
  return ((value + 0.055) / 1.055) ** 2.4
}

function luminance(rgb) {
  return (
    0.2126 * linearize(rgb[0]) +
    0.7152 * linearize(rgb[1]) +
    0.0722 * linearize(rgb[2])
  )
}

function contrastRatio(foreground, background) {
  const foregroundLum = luminance(foreground)
  const backgroundLum = luminance(background)
  const lighter = Math.max(foregroundLum, backgroundLum)
  const darker = Math.min(foregroundLum, backgroundLum)
  return (lighter + 0.05) / (darker + 0.05)
}

function compositeOver(foreground, alpha, background) {
  return foreground.map((channel, index) =>
    Math.round(channel * alpha + background[index] * (1 - alpha))
  )
}

function readTokens() {
  const contents = readFileSync(path.join(ROOT, TOKEN_FILE), "utf8")
  const tokens = new Map()
  const tokenPattern = /^\s*(--cp-[\w-]+):\s*([^;]+);/gm
  let match

  while ((match = tokenPattern.exec(contents)) !== null) {
    tokens.set(match[1], match[2].trim())
  }

  return tokens
}

function tokenHex(tokens, token) {
  const value = tokens.get(token)
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) return null
  return value
}

function walkFiles(dir) {
  const absoluteDir = path.join(ROOT, dir)
  const entries = readdirSync(absoluteDir)
  const files = []

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry)
    const stat = statSync(absolutePath)

    if (stat.isDirectory()) {
      files.push(...walkFiles(path.relative(ROOT, absolutePath)))
      continue
    }

    if (/\.(css|tsx)$/.test(entry)) files.push(absolutePath)
  }

  return files
}

function auditTokens(tokens) {
  const surfaces = new Map(
    SURFACE_TOKENS.map((token) => [token, tokenHex(tokens, token)]).filter(
      ([, value]) => value
    )
  )

  for (const [name, value] of Object.entries(EXTRA_SURFACES)) {
    surfaces.set(name, value)
  }

  const failures = []
  const rows = []

  for (const textToken of TEXT_TOKENS) {
    const textHex = tokenHex(tokens, textToken)
    if (!textHex) continue

    for (const [surfaceName, surfaceHex] of surfaces) {
      const ratio = contrastRatio(hexToRgb(textHex), hexToRgb(surfaceHex))
      const row = {
        foreground: textToken,
        foregroundHex: textHex,
        ratio,
        surface: surfaceName,
        surfaceHex,
      }
      rows.push(row)
      if (ratio < MIN_AA_NORMAL) failures.push(row)
    }
  }

  return { failures, rows }
}

function auditLiteralTextColors() {
  const files = [
    ...COMMONPLACE_STYLE_FILES.map((file) => path.join(ROOT, file)),
    ...COMMONPLACE_DIRS.flatMap(walkFiles),
  ]
  const background = hexToRgb("#F5E6D2")
  const warnings = []
  const colorPattern =
    /(?:^|[\s{,])color\s*:\s*['"]?rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)/i

  for (const absolutePath of files) {
    const relativePath = path.relative(ROOT, absolutePath)
    if (DARK_CONTEXT_FILES.includes(relativePath)) continue

    const lines = readFileSync(absolutePath, "utf8").split("\n")

    lines.forEach((line, index) => {
      const match = line.match(colorPattern)
      if (!match) return

      const foreground = [
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
      ]
      if (foreground.every((channel) => channel > 160)) return

      const alpha = Number(match[4])
      const composited = compositeOver(foreground, alpha, background)
      const ratio = contrastRatio(composited, background)

      if (ratio < MIN_AA_NORMAL) {
        warnings.push({
          line: index + 1,
          path: relativePath,
          ratio,
          source: line.trim(),
        })
      }
    })
  }

  return warnings
}

const tokens = readTokens()
const tokenAudit = auditTokens(tokens)
const literalWarnings = auditLiteralTextColors()

console.log("CommonPlace contrast audit")
console.log(`AA normal text target: ${MIN_AA_NORMAL}:1\n`)
for (const row of tokenAudit.rows) {
  const status = row.ratio >= MIN_AA_NORMAL ? "pass" : "fail"
  console.log(
    `${status.padEnd(4)} ${row.foreground} ${row.foregroundHex} on ${row.surface} ${row.surfaceHex}: ${row.ratio.toFixed(2)}`
  )
}

if (literalWarnings.length > 0) {
  console.log(
    `\nAdvisory: ${literalWarnings.length} literal translucent color declarations may be low contrast on parchment.`
  )
  for (const warning of literalWarnings.slice(0, 20)) {
    console.log(
      `warn ${warning.path}:${warning.line} ${warning.ratio.toFixed(2)} ${warning.source}`
    )
  }
  if (literalWarnings.length > 20) {
    console.log(`...and ${literalWarnings.length - 20} more.`)
  }
}

if (tokenAudit.failures.length > 0) {
  console.error("\nToken contrast audit failed.")
  process.exit(1)
}

console.log("\nToken contrast audit passed.")
