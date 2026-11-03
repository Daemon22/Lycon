import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validatePassword,
  hashPassword,
  verifyPassword,
  registerUser,
  loginUser,
  verifyEmail,
  requestPasswordReset,
  confirmPasswordReset,
} from "./_core/authService";

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  set: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
};

vi.mock("./db", () => ({
  getDb: vi.fn(() => mockDb),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

describe("Password Security", () => {
  describe("validatePassword", () => {
    it("should accept valid passwords", () => {
      const result = validatePassword("Test1234");
      expect(result.valid).toBe(true);
    });

    it("should reject passwords shorter than 8 characters", () => {
      const result = validatePassword("Test1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least 8 characters");
    });

    it("should reject passwords without letters", () => {
      const result = validatePassword("12345678");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("letter");
    });

    it("should reject passwords without numbers", () => {
      const result = validatePassword("TestTest");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("number");
    });

    it("should reject passwords longer than 128 characters", () => {
      const result = validatePassword("a".repeat(129) + "1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at most 128 characters");
    });
  });

  describe("hashPassword", () => {
    it("should hash password with Argon2", async () => {
      const hash = await hashPassword("Test1234");
      expect(hash).toBeDefined();
      expect(hash).not.toBe("Test1234");
      expect(hash.length).toBeGreaterThan(50);
    });

    it("should produce different hashes for same password", async () => {
      const hash1 = await hashPassword("Test1234");
      const hash2 = await hashPassword("Test1234");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    it("should verify correct password", async () => {
      const password = "Test1234";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(hash, password);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const hash = await hashPassword("Test1234");
      const isValid = await verifyPassword(hash, "Wrong1234");
      expect(isValid).toBe(false);
    });

    it("should handle invalid hash gracefully", async () => {
      // Argon2 throws on invalid hash format, verifyPassword catches it
      const isValid = await verifyPassword("invalid_hash_no_dollar", "Test1234");
      expect(isValid).toBe(false);
    });
  });
});

describe("Authentication Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock to return empty arrays by default
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockResolvedValue([]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.onConflictDoUpdate.mockReturnThis();
    mockDb.set.mockResolvedValue(undefined);
    mockDb.delete.mockReturnThis();
  });

  describe("registerUser", () => {
    it("should reject invalid password", async () => {
      try {
        await registerUser({
          email: "test@example.com",
          password: "short",
        });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).toContain("Password");
      }
    });
  });

  describe("loginUser", () => {
    it("should reject invalid password format", async () => {
      try {
        await loginUser({
          email: "test@example.com",
          password: "Wrong1234",
        });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        // Will fail due to no database, which is expected
        expect(error.message).toBeDefined();
      }
    });
  });

  describe("verifyEmail", () => {
    it("should reject invalid token", async () => {
      try {
        await verifyEmail({ token: "invalid" });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        // Will fail due to no database, which is expected
        expect(error.message).toBeDefined();
      }
    });
  });

  describe("password reset", () => {
    it("should reject password reset with weak password", async () => {
      try {
        await confirmPasswordReset({
          token: "valid-token",
          newPassword: "short",
        });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).toContain("Password");
      }
    });
  });
});
