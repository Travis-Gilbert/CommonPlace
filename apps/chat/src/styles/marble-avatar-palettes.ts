// SOURCING: boring-avatars marble palettes, carried over from
// different-ai/openwork @ 2f2dde65796428109a665f3b733843fe3896b933.
//
// OW3 / named choice 5: hex lives in the register lane, never in a component,
// matching the console's own precedent for an adopted third-party palette
// table (apps/console/src/styles/jalco-file-tree-colors.ts).
//
// These cannot become custom properties: boring-avatars computes SVG gradient
// stops from the values and emits them as literal fill attributes, so a var()
// reference would render as an invalid colour. They stay literal on purpose.
// They are decorative generative fill for extension tiles, not object identity
// — identity is the workspace marker, which does read the ramp
// (identity-register.css).

export const MARBLE_DEFAULT_PALETTE = ["#0a0310", "#49007e", "#ff005b", "#ff7d10", "#ffb238"];

export const MARBLE_PALETTES: readonly (readonly string[])[] = [
  MARBLE_DEFAULT_PALETTE,
  ["#1c2130", "#028f76", "#b3e099", "#ffeaad", "#d14334"],
  ["#bfe0c0", "#160921", "#f06e75", "#f2af60", "#d0d26f"],
  ["#1f0441", "#fc1068", "#fcab10", "#f9ce07", "#0ce3e8"],
  ["#4aedd7", "#705647", "#ed6d4a", "#ffca64", "#3fd97f"],
  ["#ff5252", "#ff7752", "#ff9a52", "#ffb752", "#5e405b"],
  ["#37193b", "#e75a7a", "#f59275", "#f5c273", "#aeb395"],
  ["#913f33", "#ff705f", "#ffaa67", "#ffdfab", "#9fb9c2"],
  ["#13141a", "#a90448", "#fb3640", "#fda543", "#17c69b"],
];
