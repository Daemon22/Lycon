import dotenv from "dotenv";
dotenv.config();

import { emailService } from "../server/_core/emailService";

async function testEmailService() {
  console.log("=== Testing Email Service ===\n");

  try {
    // Test 1: Check if email service is configured
    console.log("1. Checking email service configuration...");
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.log("⚠ Email service not configured (this is expected in development)");
      console.log("  To enable email, set SMTP_HOST, SMTP_USER, SMTP_PASS in .env");
      console.log("\n✓ Email service test skipped (not configured)");
      return;
    }

    // Test 2: Send verification email
    console.log("\n2. Testing verification email...");
    const verificationSent = await emailService.sendVerificationEmail(
      "test@example.com",
      "test-token-123"
    );
    console.log("✓ Verification email sent:", verificationSent);

    // Test 3: Send password reset email
    console.log("\n3. Testing password reset email...");
    const resetSent = await emailService.sendPasswordResetEmail(
      "test@example.com",
      "reset-token-456"
    );
    console.log("✓ Password reset email sent:", resetSent);

    // Test 4: Send 2FA setup email
    console.log("\n4. Testing 2FA setup email...");
    const twoFactorSent = await emailService.sendTwoFactorSetupEmail(
      "test@example.com",
      ["code1", "code2", "code3"]
    );
    console.log("✓ 2FA setup email sent:", twoFactorSent);

    console.log("\n=== All Email Tests Passed! ===");
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    process.exit(1);
  }
}

testEmailService();
