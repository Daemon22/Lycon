## Sidebar-free shell geometry diagnosis

After removing the sidebar, the live shell correctly fills the viewport, but the new `.home-mark` button had no explicit flex sizing. Its computed width expanded to roughly 1186px, leaving only a 5px tab area and causing the tablet preview to look broken. The fix is to give the logo Home control an explicit fixed flex-basis and width, while allowing the real tabs to own the remaining strip space.

## Sidebar-free shell verification

The live shell now has no persistent sidebar. The canonical LYCON mark is the fixed 52px Home control at the start of the tab strip; the Starter tab is visible at 150px; the tabs region owns the remaining width; New tab and overflow controls stay right-aligned. This corrected the earlier tablet geometry issue where the unstyled Home button expanded across the strip.

## Click-outside and Home control interaction test

The overflow menu opened from the top-right three-dot control and closed when the welcome surface was clicked outside it. The sidebar-free shell remained intact, with Home represented by the canonical logo at the left edge of the tab strip and the Starter tab remaining visible.

## Persistence and touch-ready tab validation

The live preview created a second Start tab through the top New tab control, confirming the sidebar-free tab strip remains interactive after the shell simplification. The tab model is now stored through the existing local persistence hook, with active-tab identity and ordering included in the persisted state.

Reload verification passed: the refreshed live preview still showed both Start tabs. The local storage payload contained both tab records and the active-tab identifier, confirming open tabs and active selection survive reload without a server.
