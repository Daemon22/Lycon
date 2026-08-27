# Lycon brand assets

Lycon vendors the service marks used by its new-tab shortcuts under `src/assets/brands/`. The UI never loads shortcut icons from a CDN, so the start page remains usable offline and the icons render consistently in the desktop and mobile bundles.

Most marks come from [Simple Icons](https://github.com/simple-icons/simple-icons), whose icon records include the original brand source, brand color, guidelines URL, and any available per-icon license metadata. Each record is preserved in [`src/assets/brands/manifest.json`](src/assets/brands/manifest.json).

YouTube uses the official YouTube icon shape and brand color. YouTube’s [branding guidance](https://developers.google.com/youtube/terms/branding-guidelines) distinguishes the YouTube icon from the full logo; Lycon uses the icon as a shortcut mark and links directly to YouTube without modifying its geometry.

Hacker News is the one first-party exception to the Simple Icons set. Lycon vendors the compact orange-square Y mark directly from [news.ycombinator.com/y18.svg](https://news.ycombinator.com/y18.svg), rather than incorrectly using the Y Combinator mark.

Brand marks remain the property of their respective owners. Lycon does not claim ownership of these marks; the source and guidelines links are included to make provenance explicit.
