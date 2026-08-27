# Lycon transcription research

## Recommendation

Keep the existing browser-native Web Speech API as Lycon’s default voice path, and request on-device recognition when supported through `SpeechRecognition.processLocally`, with availability and language-pack checks. This has effectively zero application bundle cost and can work online or on-device depending on the browser and installed language pack.

For an optional true offline fallback, Vosk Browser is the lighter architectural fit: it packages Vosk as WebAssembly in a WebWorker and can run fully in-browser after a language model is available. Its trade-off is that the model is a separate download/storage payload and must be loaded before recognition; model quality and vocabulary handling vary by language and model. It should therefore be an optional, user-downloaded voice pack rather than bundled into the base Lycon app.

Whisper/WebAssembly offers stronger general vocabulary and multilingual robustness, but browser model payloads are substantially heavier than the requested “light” base experience. It is better reserved for an opt-in enhanced transcription pack or online fallback, not the default shell.

## Sources

- [MDN: Using the Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API) — documents `processLocally`, `available()`, `install()`, language packs, and on-device recognition.
- [ccoreilly/vosk-browser](https://github.com/ccoreilly/vosk-browser) — documents the browser WebAssembly/WebWorker approach and explicit model loading.
- [Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://openai.com/index/whisper/) — establishes Whisper’s broad multilingual and multitask training basis, while its model family remains a heavier option for a browser base build.
