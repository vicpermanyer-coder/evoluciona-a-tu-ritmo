import { describe, expect, it } from "vitest";
import { isOwnOutfitPath, normalizeOutfitResult, outfitPath, sniffImageMime, validateOutfitFile } from "./outfit";

const U = "11111111-1111-1111-1111-111111111111";
const O = "22222222-2222-2222-2222-222222222222";
const ID = "33333333-3333-3333-3333-333333333333";

describe("outfit upload rules", () => {
  it("accepts JPG, PNG and WEBP up to 10 MB", () => {
    expect(validateOutfitFile("image/jpeg", 10 * 1024 * 1024)).toBeNull();
    expect(validateOutfitFile("image/png", 1000)).toBeNull();
    expect(validateOutfitFile("image/webp", 1000)).toBeNull();
  });
  it("rejects other formats and files over 10 MB", () => {
    expect(validateOutfitFile("image/gif", 1000)).not.toBeNull();
    expect(validateOutfitFile("image/heic", 1000)).not.toBeNull();
    expect(validateOutfitFile("image/jpeg", 10 * 1024 * 1024 + 1)).not.toBeNull();
  });
  it("only treats a photo as yours when it is inside your own folder", () => {
    expect(isOwnOutfitPath(outfitPath(U, ID, "image/png"), U)).toBe(true);
    expect(isOwnOutfitPath(outfitPath(O, ID, "image/png"), U)).toBe(false);
    expect(isOwnOutfitPath(`${U}/../${O}/outfit-${ID}.png`, U)).toBe(false);
  });
  it("detects the real image type from file bytes", () => {
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("image/png");
    expect(sniffImageMime(new TextEncoder().encode("RIFF0000WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageMime(new TextEncoder().encode("<svg></svg>"))).toBeNull();
  });
});

describe("outfit analysis result", () => {
  const base = { summary: "Buen look", works: ["Colores"], improve: ["Calzado"] };
  it("requires exactly 3 recommendations", () => {
    expect(normalizeOutfitResult({ ...base, recommendations: ["a", "b"] })).toBeNull();
    expect(normalizeOutfitResult({ ...base, recommendations: ["a", "b", "c"] })?.recommendations).toHaveLength(3);
    expect(normalizeOutfitResult({ ...base, recommendations: ["a", "b", "c", "d"] })?.recommendations).toEqual(["a", "b", "c"]);
  });
  it("rejects an answer without what works or what to improve", () => {
    expect(normalizeOutfitResult({ ...base, works: [], recommendations: ["a", "b", "c"] })).toBeNull();
    expect(normalizeOutfitResult({ ...base, improve: [], recommendations: ["a", "b", "c"] })).toBeNull();
  });
});
