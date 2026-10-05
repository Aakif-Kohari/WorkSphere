import {
  sanitizeDisplayName,
  validateDisplayName,
} from "../../lib/profileSanitizer";

describe("profileSanitizer - Custom Display Name Whitespace Sanitization (#4370)", () => {
  describe("sanitizeDisplayName", () => {
    test("returns empty string for null, undefined, or empty string", () => {
      expect(sanitizeDisplayName(null)).toBe("");
      expect(sanitizeDisplayName(undefined)).toBe("");
      expect(sanitizeDisplayName("")).toBe("");
    });

    test("trims leading whitespace", () => {
      expect(sanitizeDisplayName("   John Doe")).toBe("John Doe");
      expect(sanitizeDisplayName("\t\tAlice Smith")).toBe("Alice Smith");
      expect(sanitizeDisplayName("\n\nBob")).toBe("Bob");
    });

    test("trims trailing whitespace", () => {
      expect(sanitizeDisplayName("John Doe   ")).toBe("John Doe");
      expect(sanitizeDisplayName("Alice Smith\t\t")).toBe("Alice Smith");
      expect(sanitizeDisplayName("Bob\n\n")).toBe("Bob");
    });

    test("trims both leading and trailing whitespace", () => {
      expect(sanitizeDisplayName("   Satyam Pandey   ")).toBe("Satyam Pandey");
      expect(sanitizeDisplayName(" \t  Jane Doe \n ")).toBe("Jane Doe");
    });

    test("collapses multiple consecutive internal spaces into a single space", () => {
      expect(sanitizeDisplayName("John    Middle    Doe")).toBe("John Middle Doe");
      expect(sanitizeDisplayName("Satyam    Pandey")).toBe("Satyam Pandey");
      expect(sanitizeDisplayName("First   Second   Third   Fourth")).toBe("First Second Third Fourth");
    });

    test("handles combination of leading, trailing, internal spaces and tabs", () => {
      expect(sanitizeDisplayName("  \t  Jane   \t  Doe  \n  ")).toBe("Jane Doe");
    });
  });

  describe("validateDisplayName - Client-side validation feedback", () => {
    test("returns error when display name is empty or only whitespace", () => {
      const res1 = validateDisplayName("");
      expect(res1.isValid).toBe(false);
      expect(res1.error).toBe("Display name cannot be empty or contain only whitespace.");

      const res2 = validateDisplayName("     ");
      expect(res2.isValid).toBe(false);
      expect(res2.error).toBe("Display name cannot be empty or contain only whitespace.");

      const res3 = validateDisplayName("\t\n ");
      expect(res3.isValid).toBe(false);
      expect(res3.error).toBe("Display name cannot be empty or contain only whitespace.");
    });

    test("returns error when display name is under minimum length limit", () => {
      const res = validateDisplayName("   A   ");
      expect(res.isValid).toBe(false);
      expect(res.sanitized).toBe("A");
      expect(res.error).toBe("Display name must be at least 2 characters long.");
    });

    test("returns error when display name exceeds maximum length limit", () => {
      const longName = "A".repeat(55);
      const res = validateDisplayName(longName);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("Display name cannot exceed 50 characters.");
    });

    test("returns valid result with sanitized string for valid input", () => {
      const res = validateDisplayName("   Satyam    Pandey   ");
      expect(res.isValid).toBe(true);
      expect(res.sanitized).toBe("Satyam Pandey");
      expect(res.error).toBeUndefined();
    });
  });
});
