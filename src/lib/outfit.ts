// Client-safe rules for the outfit analysis feature (shared by the upload screen and server).

export const OUTFIT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type OutfitMime = (typeof OUTFIT_MIME_TYPES)[number];
export const OUTFIT_MAX_BYTES = 10 * 1024 * 1024;
export const OCCASION_MAX = 300;

const EXT: Record<OutfitMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function isOutfitMime(t: string): t is OutfitMime {
  return (OUTFIT_MIME_TYPES as readonly string[]).includes(t);
}

/** Returns a Spanish error for an unacceptable file, or null when it can be uploaded. */
export function validateOutfitFile(type: string, size: number): string | null {
  if (!isOutfitMime(type)) return "Formato no admitido. Usa una foto JPG, PNG o WEBP.";
  if (size <= 0) return "La imagen está vacía.";
  if (size > OUTFIT_MAX_BYTES) return "La imagen supera los 10 MB.";
  return null;
}

/** Outfit photos live flat in the user's own private folder: `<userId>/outfit-<uuid>.<ext>`. */
export function outfitPath(userId: string, id: string, mime: OutfitMime) {
  return `${userId}/outfit-${id}.${EXT[mime]}`;
}

export function isOwnOutfitPath(path: string, userId: string) {
  const m = /^([0-9a-f-]{36})\/outfit-[0-9a-f-]{36}\.(jpg|png|webp)$/i.exec(path);
  return !!m && m[1] === userId;
}

/** Detects the real image type from the file's first bytes (never trust the declared type). */
export function sniffImageMime(b: Uint8Array): OutfitMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (
    b.length >= 12 &&
    String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" &&
    String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP"
  )
    return "image/webp";
  return null;
}

export type OutfitResult = {
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
};

const clean = (xs: unknown, max: number) =>
  (Array.isArray(xs) ? xs : [])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);

/** Normalizes the model's answer; returns null when it is not a usable analysis. */
export function normalizeOutfitResult(raw: {
  summary?: unknown;
  works?: unknown;
  improve?: unknown;
  recommendations?: unknown;
}): OutfitResult | null {
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const strengths = clean(raw.works, 5);
  const improvements = clean(raw.improve, 5);
  const recommendations = clean(raw.recommendations, 3);
  if (!summary || !strengths.length || !improvements.length || recommendations.length !== 3) return null;
  return { summary, strengths, improvements, recommendations };
}
