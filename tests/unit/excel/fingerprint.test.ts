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
import { generateColumnFingerprintSync } from "@/lib/excel/fingerprint";

describe("generateColumnFingerprintSync", () => {
  it("produces deterministic output for same input", () => {
    const fp1 = generateColumnFingerprintSync(["Fatura No", "Tutar", "Tarih"]);
    const fp2 = generateColumnFingerprintSync(["Fatura No", "Tutar", "Tarih"]);
    expect(fp1).toBe(fp2);
  });

  it("is order-independent (sorted before hashing)", () => {
    const fp1 = generateColumnFingerprintSync(["Tutar", "Fatura No", "Tarih"]);
    const fp2 = generateColumnFingerprintSync(["Tarih", "Tutar", "Fatura No"]);
    expect(fp1).toBe(fp2);
  });

  it("is case-insensitive", () => {
    const fp1 = generateColumnFingerprintSync(["Fatura No", "TUTAR"]);
    const fp2 = generateColumnFingerprintSync(["fatura no", "tutar"]);
    expect(fp1).toBe(fp2);
  });

  it("trims whitespace", () => {
    const fp1 = generateColumnFingerprintSync(["  Fatura No  ", "Tutar"]);
    const fp2 = generateColumnFingerprintSync(["Fatura No", "Tutar"]);
    expect(fp1).toBe(fp2);
  });

  it("returns 'empty' for empty array", () => {
    expect(generateColumnFingerprintSync([])).toBe("empty");
  });

  it("produces different hashes for different columns", () => {
    const fp1 = generateColumnFingerprintSync(["A", "B", "C"]);
    const fp2 = generateColumnFingerprintSync(["X", "Y", "Z"]);
    expect(fp1).not.toBe(fp2);
  });

  it("produces different hashes for subset vs full set", () => {
    const fp1 = generateColumnFingerprintSync(["A", "B"]);
    const fp2 = generateColumnFingerprintSync(["A", "B", "C"]);
    expect(fp1).not.toBe(fp2);
  });

  it("returns a hex string of 64 characters (SHA-256)", () => {
    const fp = generateColumnFingerprintSync(["Test"]);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });
});
