## Sidebar-free shell geometry diagnosis

After removing the sidebar, the live shell correctly fills the viewport, but the new `.home-mark` button had no explicit flex sizing. Its computed width expanded to roughly 1186px, leaving only a 5px tab area and causing the tablet preview to look broken. The fix is to give the logo Home control an explicit fixed flex-basis and width, while allowing the real tabs to own the remaining strip space.

## Sidebar-free shell verification

The live shell now has no persistent sidebar. The canonical LYCON mark is the fixed 52px Home control at the start of the tab strip; the Starter tab is visible at 150px; the tabs region owns the remaining width; New tab and overflow controls stay right-aligned. This corrected the earlier tablet geometry issue where the unstyled Home button expanded across the strip.

## Click-outside and Home control interaction test

The overflow menu opened from the top-right three-dot control and closed when the welcome surface was clicked outside it. The sidebar-free shell remained intact, with Home represented by the canonical logo at the left edge of the tab strip and the Starter tab remaining visible.

## Persistence and touch-ready tab validation

The live preview created a second Start tab through the top New tab control, confirming the sidebar-free tab strip remains interactive after the shell simplification. The tab model is now stored through the existing local persistence hook, with active-tab identity and ordering included in the persisted state.

Reload verification passed: the refreshed live preview still showed both Start tabs. The local storage payload contained both tab records and the active-tab identifier, confirming open tabs and active selection survive reload without a server.

## Voice modes and Vosk pack validation

The live Settings control room now exposes a Voice section with Online browser recognition, On-device browser recognition, and Offline Vosk language pack modes. The optional English small pack is presented as a separate 40 MB download and is not part of the initial application bundle. The main voice button receives the selected on-device preference, while the browser-native engine remains the lightweight base path.

Final verification passed: Settings exposes the Voice section with online, browser on-device, and offline Vosk modes. Selecting Offline Vosk updates the explanatory panel without initiating a download; the user must explicitly select Download offline pack. The workflow fetches the official small English archive and stores it in IndexedDB, with persisted ready/removal state. Favicon components use a localStorage data-URL cache when cross-origin fetch permits and fall back to the source URL when it does not.

## South African English voice validation

The live Voice settings panel now presents English (South Africa) as the selected built-in language, with the standard `en-ZA` tag passed to the browser-native recognizer. Online, on-device, and Offline Vosk modes remain available. If the browser reports `language-not-supported`, recognition retries with the browser language and then reports a clear unavailable-language status rather than failing silently.

## Voice preflight and catalog validation

Live Settings verification passed: the Voice section shows the browser-native recognition mode selector, `English (South Africa)` (`en-ZA`) as the selected language, a visible “Run test” microphone/language control, and an offline catalog containing an honest South African English browser-profile entry plus the verified downloadable English small pack. The Run test control is intentionally user-triggered because it requests microphone access; the implementation performs `SpeechRecognition.available()` preflight when the browser exposes it.
