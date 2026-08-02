/** @jsxImportSource react */
import Avatar from "boring-avatars";

// OW3: the palette table moved to the register lane; this file holds behavior.
import { MARBLE_DEFAULT_PALETTE, MARBLE_PALETTES } from "../../styles/marble-avatar-palettes";

export type MarbleAvatarProps = {
  seed: string;
  className?: string;
  square?: boolean;
};

export function MarbleAvatar({ seed, className, square }: MarbleAvatarProps) {
  const normalizedSeed = seed.trim() || "openwork";

  return (
    <Avatar
      variant="marble"
      name={normalizedSeed}
      colors={avatarColorsForSeed(normalizedSeed)}
      square={square}
      className={className}
      role="presentation"
      aria-hidden="true"
      focusable="false"
    />
  );
}

function avatarColorsForSeed(seed: string) {
  const palette = MARBLE_PALETTES[hashString(seed) % MARBLE_PALETTES.length] ?? MARBLE_DEFAULT_PALETTE;
  return [...palette];
}

function hashString(input: string) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
