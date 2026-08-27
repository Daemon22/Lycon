
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
