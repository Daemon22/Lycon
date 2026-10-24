# Lycon Browser Capability Expansion

## Implementation approach

Extend the existing React/Express Lycon browser shell rather than introducing a second application. Keep the current local-first model and existing image assets. Add browser-standard actions to the existing overflow menu: responsive display mode, page download, screenshot, screen recording, share, and AI handoff. Use progressive enhancement: Web Share, Clipboard, Display Media, MediaRecorder, and Fetch are used when available; unsupported or cross-origin cases receive a clear in-app message instead of opening uncontrolled windows.

The application keeps automatic CSS responsiveness as the default. A persisted Appearance setting adds explicit Auto, Desktop, and Mobile presentation modes for users who want to control how the web app lays itself out. Existing zoom remains available for fine-grained sizing.

Download behavior saves locally rendered Lycon surfaces as HTML and attempts to fetch an online page for a real HTML download; if the destination blocks cross-origin fetch, Lycon explains that the site must be saved from its own controls. Screenshot continues to capture the browser shell as a PNG. Screen recording uses the browser’s consented display-capture flow and downloads a WebM recording when stopped. Share uses the Web Share API where available and Clipboard fallback otherwise; AI handoff shares a concise analysis prompt plus the viewed URL/title.

Brighten the dark theme through slightly lighter chrome/surface tokens and less opaque image overlays, while preserving the existing forest and wolf-den images unchanged.

## Project structure

- `client/src/pages/Home.tsx`: persisted display mode, action handlers, overflow menu actions, settings controls, native capability fallbacks.
- `client/src/index.css`: brighter dark-theme tokens, display-mode overrides, and responsive desktop/mobile layout rules.
- `TODO.md`: acceptance outcomes and validation evidence.
- `Dockerfile`: unchanged production serving contract.

## Design decisions

- **Design movement:** Brighter Quiet Field Instrument — a low-light browser console with clearer surfaces and warmer image visibility (0.06).
- **Alternative:** Native browser utility chrome with restrained woodland imagery (0.08).
- **Alternative:** Mobile-first utility panel with desktop expansion (0.04).

### Chosen direction

- **Design Movement:** Brighter Quiet Field Instrument.
- **Core Principles:** native-feeling controls; visible state; local-first privacy; progressive enhancement.
- **Color Philosophy:** lift the plum surfaces and reduce image-black overlays so the existing artwork reads as atmosphere rather than a hidden texture.
- **Layout Paradigm:** persistent browser chrome above a single content viewport, with Auto/ Desktop/ Mobile modes controlling the shell posture.
- **Signature Elements:** amber action states, compact signal badges, and the unchanged woodland state imagery.
- **Interaction Philosophy:** every capability is deliberate, reversible, and explained when the browser or destination imposes a boundary.
- **Animation:** preserve restrained transitions; use a clear recording state without decorative motion.
- **Typography System:** retain Space Grotesk display, Manrope body, and DM Mono status labels.
- **Brand Essence:** a privacy-forward browser workspace for people who want local control before online handoff; quiet, capable, deliberate.
- **Brand Voice:** concise and explicit. Examples: “Share this page” and “This site blocks a direct download; use its own save control.”
- **Signature Brand Color:** warm amber remains the action color.
