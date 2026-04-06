/**
 * @vitest-environment node
 *
 * Fingerprint consistency tests for column name hashing.
 *
 * Verifies:
 *   - Same columns → same hash (deterministic)
 *   - Different order → same hash (order independent)
 *   - Different columns → different hash
 *   - Case insensitive
 *   - Empty columns → "empty"
 */
import { describe, it, expect } from "vitest";
import { generateColumnFingerprint } from "@/lib/excel/fingerprint";

describe("generateColumnFingerprint", () => {
  it("produces deterministic output for same input", async () => {
    const fp1 = await generateColumnFingerprint(["Fatura No", "Tutar", "Tarih"]);
    const fp2 = await generateColumnFingerprint(["Fatura No", "Tutar", "Tarih"]);
    expect(fp1).toBe(fp2);
  });

  it("is order-independent (sorted before hashing)", async () => {
    const fp1 = await generateColumnFingerprint(["Tutar", "Fatura No", "Tarih"]);
    const fp2 = await generateColumnFingerprint(["Tarih", "Tutar", "Fatura No"]);
    expect(fp1).toBe(fp2);
  });

  it("is case-insensitive", async () => {
    const fp1 = await generateColumnFingerprint(["Fatura No", "TUTAR"]);
    const fp2 = await generateColumnFingerprint(["fatura no", "tutar"]);
    expect(fp1).toBe(fp2);
  });

  it("trims whitespace", async () => {
    const fp1 = await generateColumnFingerprint(["  Fatura No  ", "Tutar"]);
    const fp2 = await generateColumnFingerprint(["Fatura No", "Tutar"]);
    expect(fp1).toBe(fp2);
  });

  it("returns 'empty' for empty array", async () => {
    expect(await generateColumnFingerprint([])).toBe("empty");
  });

  it("produces different hashes for different columns", async () => {
    const fp1 = await generateColumnFingerprint(["A", "B", "C"]);
    const fp2 = await generateColumnFingerprint(["X", "Y", "Z"]);
    expect(fp1).not.toBe(fp2);
  });

  it("produces different hashes for subset vs full set", async () => {
    const fp1 = await generateColumnFingerprint(["A", "B"]);
    const fp2 = await generateColumnFingerprint(["A", "B", "C"]);
    expect(fp1).not.toBe(fp2);
  });

  it("returns a hex string of 64 characters (SHA-256)", async () => {
    const fp = await generateColumnFingerprint(["Test"]);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });
});
