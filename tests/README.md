# Legacy test archive

This directory intentionally holds the legacy browser/Electron test suite that predates the current app stack.

The active project test command is `vitest run` from the repository root. The archived tests under `legacy/` are retained only for historical reference and are not part of the current development workflow.

They are obsolete because the app no longer uses the old Electron/browser runner and the current codebase is validated through the active TypeScript/Vitest pipeline.
