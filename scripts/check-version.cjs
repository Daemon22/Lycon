/**
 * verify-version.cjs — checks that all platform configs share the same version
 * as the canonical VERSION file at the project root.
 *
 * Run:  pnpm run version:check
 * CI:   fails the build if any version diverges.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function readVersionFile() {
  const raw = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
  if (!/^\d+\.\d+\.\d+/.test(raw)) {
    console.error(`ERROR: VERSION file contains an invalid version: "${raw}"`);
    process.exit(1);
  }
  return raw;
}

const canonical = readVersionFile();
const mismatches = [];

// --- package.json ---
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.version !== canonical) {
  mismatches.push(`package.json: "${pkg.version}" ≠ "${canonical}"`);
}

// --- tauri.conf.json ---
const tauriConf = JSON.parse(
  fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8")
);
if (tauriConf.version !== canonical) {
  mismatches.push(`src-tauri/tauri.conf.json: "${tauriConf.version}" ≠ "${canonical}"`);
}

// --- android/app/build.gradle.kts ---
// Android reads the version dynamically from the VERSION file, so we just
// verify the Gradle config references ../../VERSION rather than hardcoding
// a stale string.
const gradle = fs.readFileSync(
  path.join(root, "android", "app", "build.gradle.kts"),
  "utf8"
);
if (!gradle.includes("../../VERSION") && !gradle.includes("VERSION")) {
  mismatches.push(
    `android/app/build.gradle.kts: does not reference the VERSION file (hardcoded version found)`
  );
}
// If a hardcoded versionName string still exists (shouldn't), flag it.
const hardcodedVersion = gradle.match(/versionName\s*=\s*"(\d+\.\d+\.\d+)"/);
if (hardcodedVersion && hardcodedVersion[1] !== canonical) {
  mismatches.push(
    `android/app/build.gradle.kts: hardcoded versionName "${hardcodedVersion[1]}" ≠ "${canonical}"`
  );
}

if (mismatches.length > 0) {
  console.error(`\n❌ VERSION drift detected (canonical: ${canonical}):\n`);
  for (const m of mismatches) {
    console.error(`   • ${m}`);
  }
  console.error(
    `\nAll version strings must match the VERSION file. Update them and re-run.`
  );
  process.exit(1);
}

console.log(`✅ All platform versions match: ${canonical}`);
