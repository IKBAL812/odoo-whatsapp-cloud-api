/**
 * Avatar Color Generation System
 *
 * Generates deterministic, theme-aware colors for avatar backgrounds
 * based on a numeric seed (partnerId or threadId).
 */

/**
 * Simple hash function to convert a numeric seed into a consistent hash value
 * @param seed - Numeric identifier (partnerId, threadId, etc.)
 * @returns Hash value between 0 and 1
 */
function hashSeed(seed: number): number {
  // Use a simple but effective hash algorithm
  let hash = seed;

  // Mix the bits around for better distribution
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = (hash >> 16) ^ hash;

  // Convert to 0-1 range
  return Math.abs(hash % 10000) / 10000;
}

/**
 * Generates a deterministic HSL color string based on seed and theme
 *
 * @param seed - Numeric identifier (partnerId or threadId)
 * @param theme - Current theme ('dark' or 'light')
 * @returns HSL color string (e.g., "hsl(240, 70%, 60%)")
 *
 * Color characteristics:
 * - Dark theme: Saturated, rich colors (60-80% saturation, 50-70% lightness)
 * - Light theme: Pale, pastel colors (40-60% saturation, 75-85% lightness)
 * - Hue: Full spectrum (0-360°) for maximum variety
 */
export function generateAvatarColor(
  seed: number,
  theme: "dark" | "light"
): string {
  // Generate a consistent hash from the seed
  const hash = hashSeed(seed);

  // Generate hue from full spectrum (0-360 degrees)
  const hue = Math.floor(hash * 360);

  // Theme-specific saturation and lightness
  let saturation: number;
  let lightness: number;

  if (theme === "dark") {
    // Dark theme: vibrant, saturated colors
    saturation = 60 + Math.floor((hash * 1000) % 20); // 60-80%
    lightness = 50 + Math.floor((hash * 2000) % 20); // 50-70%
  } else {
    // Light theme: pale, pastel colors
    saturation = 40 + Math.floor((hash * 1500) % 20); // 40-60%
    lightness = 75 + Math.floor((hash * 2500) % 10); // 75-85%
  }

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
