import dotenv from "dotenv";
dotenv.config();

import { registerUser, loginUser, verifyEmail, requestPasswordReset, confirmPasswordReset } from "../server/_core/authService";
import { generateTwoFactorSecret, verifyTwoFactorSetup, isTwoFactorEnabled } from "../server/_core/twoFactorAuth";
import { gdprService } from "../server/_core/gdprService";

async function testAuthFlows() {
  console.log("=== Testing Authentication Flows ===\n");

  try {
    // Test 1: User Registration
    console.log("1. Testing user registration...");
    const testEmail = `test-${Date.now()}@example.com`;
    const registerResult = await registerUser({
      email: testEmail,
      password: "TestPass123",
      name: "Test User",
    });
    console.log("✓ Registration successful:", registerResult);

    // Test 2: Login
    console.log("\n2. Testing login...");
    const loginResult = await loginUser({
      email: testEmail,
      password: "TestPass123",
    });
    console.log("✓ Login successful:", { userId: loginResult.userId, email: loginResult.email });

    // Test 3: Invalid Login
    console.log("\n3. Testing invalid login...");
    try {
      await loginUser({
        email: testEmail,
        password: "WrongPass123",
      });
      console.log("✗ Should have failed");
    } catch (error: any) {
      console.log("✓ Invalid login rejected:", error.message);
    }

    // Test 4: Password Reset Request
    console.log("\n4. Testing password reset request...");
    const resetRequest = await requestPasswordReset({ email: testEmail });
    console.log("✓ Password reset requested:", resetRequest);

    // Test 5: 2FA Setup
    console.log("\n5. Testing 2FA setup...");
    const twoFactorSecret = await generateTwoFactorSecret(loginResult.userId);
    console.log("✓ 2FA secret generated:", { secret: twoFactorSecret.secret.substring(0, 10) + "..." });

    // Test 6: Check 2FA Status
    console.log("\n6. Testing 2FA status check...");
    const twoFactorStatus = await isTwoFactorEnabled(loginResult.userId);
    console.log("✓ 2FA status:", twoFactorStatus);

    // Test 7: GDPR Data Export
    console.log("\n7. Testing GDPR data export...");
    const exportedData = await gdprService.exportUserData(loginResult.userId);
    console.log("✓ Data exported:", { user: exportedData.user.email, snapshotCount: exportedData.browserSyncSnapshots.length });

    console.log("\n=== All Authentication Tests Passed! ===");
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    process.exit(1);
  }
}

testAuthFlows();
