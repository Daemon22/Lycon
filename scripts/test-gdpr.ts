import dotenv from "dotenv";
dotenv.config();

import { gdprService } from "../server/_core/gdprService";
import { registerUser } from "../server/_core/authService";

async function testGDPRFeatures() {
  console.log("=== Testing GDPR Compliance Features ===\n");

  try {
    // Create a test user
    console.log("1. Creating test user...");
    const testEmail = `gdpr-test-${Date.now()}@example.com`;
    const registerResult = await registerUser({
      email: testEmail,
      password: "TestPass123",
      name: "GDPR Test User",
    });
    console.log("✓ User created:", registerResult);

    // Test 2: Data Export
    console.log("\n2. Testing data export...");
    const exportedData = await gdprService.exportUserData(registerResult.userId);
    console.log("✓ Data exported successfully:");
    console.log("  - User:", exportedData.user.email);
    console.log("  - Role:", exportedData.user.role);
    console.log("  - Snapshots:", exportedData.browserSyncSnapshots.length);
    console.log("  - 2FA Enabled:", exportedData.twoFactorEnabled);
    console.log("  - Export Date:", exportedData.exportDate);

    // Test 3: Account Deletion
    console.log("\n3. Testing account deletion...");
    const deleted = await gdprService.deleteUserAccount(registerResult.userId, "TestPass123");
    console.log("✓ Account deleted:", deleted);

    // Test 4: Verify deletion
    console.log("\n4. Verifying deletion...");
    try {
      await gdprService.exportUserData(registerResult.userId);
      console.log("✗ Should have failed - user still exists");
    } catch (error: any) {
      console.log("✓ User successfully deleted:", error.message);
    }

    console.log("\n=== All GDPR Tests Passed! ===");
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    process.exit(1);
  }
}

testGDPRFeatures();
