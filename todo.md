
## Reference Background Upgrade

- [x] Generate a portrait forest hero background with warm amber light and a dark lower vignette.
- [x] Integrate the background into the Start view without weakening text contrast or hiding the browser shell.
- [x] Validate the reference-inspired composition on desktop and mobile, including the voice search field.
- [ ] Save a new publish-ready checkpoint after final validation.

### Validation note

The current Start hero uses the forest background as its sole large visual. The wolf mark appears only in the sidebar brand lockup, matching the supplied reference and removing repetition.


Desktop and mobile screenshots confirm the forest background resolves correctly, the hero text remains readable, the wolf badge remains identifiable, and the microphone control remains visible in the responsive search field. Secondary settings and library views remain distinct from the hero.

## Hero Mark De-duplication

- [x] Remove the wolf artwork from the Start hero while keeping the sidebar brand mark.
- [x] Rebalance the forest background and hero content after removing the artwork.
- [x] Validate desktop and mobile composition and save a new publish-ready checkpoint.

## Canonical Logo Replacement

- [x] Replace the generated crest reference with the user-supplied LYCON logo asset.
- [x] Update favicon and brand lockup references without changing the forest hero background.
- [x] Validate logo quality at desktop and mobile sizes, then save a new publish-ready checkpoint.

### Canonical logo validation note

The supplied high-resolution LYCON logo now appears in the sidebar brand lockup and favicon reference. Desktop and mobile screenshots show the correct gold-and-purple mark at readable scale; the forest hero remains free of repeated wolf artwork.

## Pasted Instructions

- [x] Read the supplied pasted instructions and extract the required Lycon changes.
- [x] Refactor secondary navigation into the upper-right overflow menu while keeping primary browser controls visible.
- [x] Unify viewport-aware sizing across shell, toolbar, tabs, menus, content pages, and responsive rail behavior.
- [x] Improve chrome/content separation and restrained contrast without redesigning the existing Start page.
- [x] Validate tabs, navigation, address/search, voice input, bookmarking, overflow access, privacy controls, and narrow-to-desktop viewports.
- [ ] Save a revised publish-ready checkpoint.

### Overflow architecture validation note

The desktop browser shell now shows only Start in the left rail. The upper-right overflow menu visibly exposes Saved pages, History, Downloads, Settings, Privacy & security, Site permissions, and Clear browsing data as actual menu actions.

### Secondary navigation validation note

Settings opens from the overflow menu and exposes Appearance, Privacy, Permissions, and Search. History opens from the overflow menu and renders its existing records and Clear history action. The left rail remains limited to Start.

### Core shell validation note

The simplified rail leaves Start as the sole primary sidebar destination. A second Start tab opens successfully, both tab close controls remain visible, and the browser shell keeps its navigation controls, address bar, voice input, bookmark, shields, private mode, and overflow entry points synchronized.

### Cross-view interaction validation note

Typed local navigation from the address bar reaches Bookmarks. The overflow menu opens from the Bookmarks view and Privacy & security routes into Settings with the Privacy section active. Existing shields and private-tab controls remain visible and usable.

### Responsive validation note

Narrow mobile screenshots for Start, Settings, and History show no horizontal overflow or clipped content. Tabs, toolbar controls, address/search fields, voice input, settings navigation, and list panels remain within the available content viewport. The canonical logo stays legible in the compact sidebar brand lockup.

### Data-management validation note

Clear browsing data is reachable from the overflow menu, clears the local history and downloads stores, closes the menu, and provides the visible confirmation “History and downloads cleared.”

### Final synchronization note

Desktop and narrow mobile captures confirm the shell and content remain separated, the Start, Settings, and History pages share the same responsive rules, the simplified rail does not create horizontal overflow, and the forest Start surface stays readable without competing secondary navigation.

## Lycon Search Surface

- [x] Remove the duplicate hero search input and keep only the browser address/search field.
- [x] Add an in-app Lycon Search results view for ordinary queries.
- [x] Render direct web destinations inside Lycon’s content viewport instead of opening an external browser.
- [x] Validate search, tabs, responsive layout, voice input, and in-app handoff behavior, then save a checkpoint.

### Single-search validation note

The Start page now contains no second search input. The toolbar address/search field is the only search surface; submitting “privacy” routes to `/search`, displays Lycon Search results from the internal workspace index, and keeps the shell state LOCAL without contacting an external search engine.

### Internal search and browsing validation note

Lycon now has exactly one search input in the toolbar. Ordinary queries route to the local `/search` index, while direct web addresses route to Lycon’s `/online` handoff surface. Choosing Open inside Lycon renders the destination inside an iframe within the content viewport and does not open a new external browser window; external sites may render blank when they disallow embedding.

### Native search validation note

The Start surface exposes only the toolbar address/search input. Route terms such as “settings” resolve to Lycon’s local Settings page, while ordinary terms such as “privacy” resolve to the internal Lycon Search page with local indexed results and no external search-engine URL.

### Final native-browser validation note

Desktop and mobile captures show one visible address/search field at a time: the browser toolbar field. The Start, native Search, and Settings pages fit within their content viewport with no horizontal overflow. The browser shell keeps tabs, navigation, voice input, bookmark, shields, private mode, and overflow controls visible and synchronized.

## Search Index and Embedded Loading

- [x] Index saved pages and browsing history with clear result types, timestamps, and direct navigation.
- [x] Add an animated loading/progress state while embedded external pages open.
- [x] Add a graceful embedded-page error or restriction state.
- [x] Validate search relevance, loading behavior, and responsive presentation, then save a checkpoint.

### Rich local index validation note

Searching “example” now returns live history records with result type, relative visit time, and destination URL. The results remain inside `/search`, preserve the query in the single toolbar field, and keep the shell in LOCAL mode.

### Saved-page indexing validation note

A direct handoff can be saved from the toolbar bookmark control, which changes to Remove bookmark and shows “Saved to bookmarks.” The saved destination is now available for the richer local index alongside history records.

### Final feature validation note

Searching “example” returns both the saved example.com page and a browsing-history record with category, metadata, and destination URL. Direct example.com handoff renders successfully inside Lycon’s embedded viewport with the “Rendering inside Lycon” state visible; no external browser window is opened.

### Final richer-index validation note

Desktop and mobile captures confirm result cards remain readable with category, timestamp, and URL metadata. The embedded handoff surface remains contained within Lycon’s viewport, with a dedicated in-app status label and responsive action card. No external browser window is used.

## Full-Text Local Index

- [x] Inspect the current download and local document data structures and storage flow.
- [x] Extract searchable text and metadata from locally stored document/download records without sending data externally.
- [x] Add document and download matches to Lycon Search with useful snippets and result types.
- [x] Validate full-text queries, direct result navigation, and responsive result presentation, then save a checkpoint.

### Full-text surface validation note

Desktop Search and Downloads surfaces render correctly after the data-model upgrade. Downloads now have a dedicated Add file entry point, and Search remains a single-field local index surface ready to receive document text and metadata from locally stored files.

### Full-text responsive validation note

The expanded Search description remains readable on mobile, and the Downloads surface keeps its Add file action and empty state within the viewport without clipping. Document result cards will use the same compact metadata and snippet treatment when local files are indexed.

## Repository Push and Preview Verification

- [x] Confirm the configured Lycon repository remote and current branch.
- [x] Run final type-check, production build, and targeted smoke checks.
- [x] Commit and push the latest full-text search changes.
- [x] Open the updated preview and verify the core search and browsing surfaces.

## UI Consistency and Preview Search Audit

- [x] Audit all Lycon views for canonical logo references, forest background usage, and stale generated assets.
- [x] Refine shared shell, typography, contrast, spacing, and responsive styling without changing the local-first information architecture.
- [x] Test native search, saved/local index results, and browsing history in preview.
- [x] Run final checks and save a revised publish-ready checkpoint.

### UI and preview audit note

The canonical LYCON logo is consistently used in the sidebar brand lockup across Start, Search, History, and Settings. The forest background treatment now carries through every route as a subdued shared atmosphere, while content cards preserve contrast. Preview checks confirm the single-toolbar Search surface, native local index results, and History records remain available and readable.

### Final UI consistency validation note

Desktop and narrow mobile captures confirm the canonical LYCON logo is used consistently in the sidebar brand lockup, the forest background is applied as a subdued shared atmosphere across Start, Search, History, and Settings, and the refined chrome/content separation remains readable without overflow.

## Search Filters and Privacy Controls

- [x] Add Saved, History, Documents, and Core filters to native Lycon Search.
- [x] Add a browser-level privacy notice explaining local indexing and microphone permissions.
- [x] Keep clear browsing history available and add individual delete actions for saved pages.
- [x] Validate filtering, privacy messaging, and granular data controls, then save a checkpoint.

## Safe Data Controls and Advanced Search

- [x] Add confirmation dialogs before clearing history/downloads and deleting individual saved pages.
- [x] Add local JSON export and import for bookmarks and Lycon search data.
- [x] Add date-range and content-type filters to native Search results.
- [x] Validate destructive-action safeguards, backup round-trip behavior, and advanced filters, then save a checkpoint.

## Professional Browser Application Menu

- [x] Map core browser menu functions to Lycon’s local-first and deliberate-online model.
- [x] Add professional overflow-menu actions for tabs, zoom, favorites, history, downloads, extensions placeholder, passwords placeholder, print, translate, split view, screenshot, find-on-page, settings, help, and close-tab behavior where supported.
- [x] Preserve local-only data handling and clearly label unavailable native capabilities without opening external windows.
- [x] Refine the browser chrome and validate desktop/mobile menu behavior, then save a checkpoint.

## Dedicated History, Accessible Menu, and Local Screenshots

- [x] Build out the History view with locally persisted retrieval, date grouping, and direct reopen actions.
- [x] Add focus trapping, initial focus, roving Tab behavior, and Escape close handling to the overflow menu.
- [x] Implement real local screenshot capture from the menu with a downloadable PNG snapshot.
- [x] Validate History persistence, keyboard accessibility, screenshot download behavior, and responsive layout, then save a checkpoint.

## Expanded Reference Menu Scope

- [x] Audit every function shown in the supplied browser application-menu screenshots.
- [x] Replace placeholder menu rows with working local-first equivalents wherever Lycon can support them.
- [x] Add working surfaces for tab/window actions, tab groups, extensions/passwords entry points, translate, split view, screenshot, find-on-page, settings, help, and close-tab behavior.
- [x] Document only the functions intentionally excluded because they require native browser privileges or a backend service.
- [x] Validate the expanded menu against the reference on desktop and mobile, then save a checkpoint.

## Browser Shell UI Refinement

- [x] Fix overflow-menu stacking so it renders above the welcome page and remains inside the viewport.
- [x] Refine the Starter tab geometry, active state, close affordance, and new-tab control.
- [x] Harden desktop, tablet, and mobile toolbar, menu, sidebar, and content behavior.
- [x] Validate the updated shell visually at representative device widths, then save a checkpoint.

## Simplified Living Browser Shell

- [x] Remove the persistent sidebar and replace its Home role with the canonical LYCON mark in the top browser chrome.
- [x] Audit every visible icon and connect it to a real local action or explicit in-app state.
- [x] Add click-outside dismissal for the overflow menu and drag-to-reorder behavior for tabs.
- [x] Optimize tablet layouts and retain fluid desktop/mobile behavior with restrained micro-interactions.
- [x] Verify local search, History, bookmarks, downloads, settings, and online handoff after shell simplification, then save a checkpoint.

## Flexible Persistent Shell

- [x] Remove the redundant visible “Your field stays local” permission notice while keeping permission controls in Settings.
- [x] Persist open tabs, tab order, active tab, and active page state across reloads.
- [x] Add touch-friendly tab reordering for tablet and mobile pointers with accessible keyboard fallback.
- [x] Create a compact overflow menu layout for narrow screens without losing menu actions.
- [x] Validate reload persistence and responsive local functionality, then save a checkpoint.

## Adaptive Voice and Tab Metadata

- [x] Add a tablet-specific compact toolbar mode while retaining accessible labels and core actions.
- [x] Add long-press visual feedback and best-effort haptic feedback for touch tab reordering.
- [x] Add dynamic tab titles and favicons derived from local pages, files, and online destinations.
- [x] Evaluate a lightweight offline/online transcription path and preserve browser-native fallback behavior.
- [x] Validate adaptive shell behavior, voice fallback, and tab metadata, then save a checkpoint.
