# Lycon Browser Web App

- [x] Use the existing Lycon repository codebase and preserve its React/Express architecture rather than introducing a new starter.
- [ ] Make the web-facing application build successfully, run, and be accessible as a live deployment.
- [x] Preserve the existing Lycon Browser visual identity and browser-style interface.
- [x] Retain the product's existing privacy-focused messaging and direction.
- [ ] Keep current interactive browser functionality and server-backed behavior working in the deployed environment.
- [x] Configure production-facing client/server integration, routes, environment settings, and static asset delivery as required by the repository.
- [ ] Leave the deployed codebase in a maintainable state so the owner can continue working from the existing implementation.

## Capability Expansion — Desktop/Mobile and Browser Actions
- [x] Keep the normal browser-style responsive desktop and mobile layouts, and add an Appearance control for Auto, Desktop, or Mobile presentation while retaining zoom controls for display size.
- [x] Add a working Download page action for locally rendered Lycon pages and a clear cross-origin limitation message when an online destination blocks direct fetching.
- [x] Keep Screenshot available as a downloadable PNG of the visible Lycon browser shell.
- [x] Add browser-consented screen recording using the standard display-capture flow and download the recording when stopped.
- [x] Add Share page and Share to AI actions using the standard Web Share API with clipboard fallback when Web Share is unavailable.
- [x] Brighten the dark browser chrome and reduce image overlay opacity so existing online/offline artwork remains visible without changing the image files.
- [x] Validate the capability menu, Auto/Desktop/Mobile presentation modes, screenshot/download/share fallbacks, recording state, desktop/mobile layout, type-check, production build, checkpoint, and live publication.

### Capability validation evidence

The Preview menu visibly exposes Screenshot, Download page, Share page, Share to AI, and Record screen. Appearance exposes Automatic responsive, Desktop layout, and Mobile layout. Desktop (1440×900) and mobile (390×844) captures show readable artwork and responsive chrome. Health and route-manifest checks return HTTP 200; TypeScript, production build, and `git diff --check` pass. Native display capture and Web Share still require the user’s browser permission or target-device support when invoked.
