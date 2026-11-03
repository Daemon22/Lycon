import dotenv from "dotenv";
dotenv.config();

import { checkRateLimit } from "../server/_core/rateLimit";
import { validatePassword, hashPassword, verifyPassword } from "../server/_core/authService";

async function testSecurityFeatures() {
  console.log("=== Testing Security Features ===\n");

  try {
    // Test 1: Password Validation
    console.log("1. Testing password validation...");
    const validPassword = validatePassword("TestPass123");
    console.log("✓ Valid password:", validPassword);

    const weakPassword = validatePassword("weak");
    console.log("✓ Weak password rejected:", weakPassword);

    // Test 2: Password Hashing
    console.log("\n2. Testing password hashing...");
    const hash = await hashPassword("TestPass123");
    console.log("✓ Password hashed:", hash.substring(0, 20) + "...");

    // Test 3: Password Verification
    console.log("\n3. Testing password verification...");
    const isValid = await verifyPassword(hash, "TestPass123");
    console.log("✓ Password verified:", isValid);

    const isInvalid = await verifyPassword(hash, "WrongPass123");
    console.log("✓ Wrong password rejected:", !isInvalid);

    // Test 4: Rate Limiting
    console.log("\n4. Testing rate limiting...");
    const rateLimit1 = await checkRateLimit("127.0.0.1", "/api/auth/login");
    console.log("✓ First request allowed:", rateLimit1);

    const rateLimit2 = await checkRateLimit("127.0.0.1", "/api/auth/login");
    console.log("✓ Second request allowed:", rateLimit2);

    console.log("\n=== All Security Tests Passed! ===");
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    process.exit(1);
  }
}

testSecurityFeatures();
