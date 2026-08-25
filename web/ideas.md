# Lycon Web Companion — Design Direction

## Three stylistic approaches

### Theme Name: Trailhead Utility
Very Brief Intro: A field-ready browser start page with warm dark earth tones, quiet metallic accents, and highly legible navigation. It feels practical, focused, and built for people who browse with intent.
Probability: 0.03

### Theme Name: Archive Light
Very Brief Intro: A parchment-and-sage reading interface inspired by naturalist field journals and annotated maps. It makes local-first browsing feel calm, trustworthy, and human.
Probability: 0.08

### Theme Name: Night Signal
Very Brief Intro: A low-light hunter console with restrained teal indicators and high-contrast status cues. It emphasizes security and operational awareness without drifting into decorative cyberpunk.
Probability: 0.06

## Chosen approach: Trailhead Utility

### Design Movement
Contemporary field equipment design blended with editorial utility interfaces: tactile surfaces, restrained instrumentation, and warm material contrast rather than glossy futurism.

### Core Principles
1. **Field clarity:** Every control should explain its purpose quickly and remain readable at a glance.
2. **Material restraint:** Use deep bark-brown surfaces, brass-gold actions, and muted teal/sage status accents with no purple gradients or decorative noise overload.
3. **Local confidence:** Make the on-device/local-first story visibly primary, while keeping online access useful and honest.
4. **Responsive shelter:** Preserve the compact wolf mark and content hierarchy across sizes; narrow screens should simplify structure, not merely shrink it.

### Color Philosophy
The dark brown base evokes a sheltered trailhead and lets the supplied wolf artwork carry recognition. Brass-gold is the owned action color: it signals warmth, direction, and deliberate movement. Teal and sage are reserved for trust, local availability, and security states so that intelligence remains optional rather than dominant.

### Layout Paradigm
A centered field-card composition with a controlled 700px reading column, supported by horizontal section rules and asymmetric card grouping. The page should feel like a compact instrument panel placed inside generous breathing room, not a generic dashboard grid.

### Signature Elements
- The supplied compact wolf artwork framed as the anchor mark above the wordmark.
- Fine brass rules that label sections like field notes: “Your web” and “On this device.”
- Tactile translucent cards with subtle depth, paired with authentic service marks instead of invented iconography.

### Interaction Philosophy
Interactions should feel deliberate and reversible. Buttons respond with small tactile movement, links clearly announce destinations, and local-first actions are presented as direct tools rather than hidden settings. Online visitors may explore the interface, but the page must not imply that local filesystem access is available in a normal browser.

### Animation
Use brief 140–220ms ease-out transitions for hover and focus, a gentle 4s float on the logo only when motion is allowed, and no looping motion on controls. Respect `prefers-reduced-motion` by removing the float and minimizing transitions.

### Typography System
Use a strong system sans stack for the wordmark and headings, with weight contrast between the brand (700–800) and supporting copy (400–600). Keep labels small, uppercase, and letter-spaced; maintain generous line-height for device descriptions.

### Brand Essence
Lycon is a privacy-first Hunter browser companion for people who want local control, straightforward web access, and optional intelligence without silent data movement. Personality: **watchful, grounded, self-directed**.

### Brand Voice
Headlines should be concise and assured. CTAs should describe an action without hype. Microcopy should distinguish what works online from what requires the native browser.

Example lines:
- “Browse wild. Browse free.”
- “Local tools belong on your device. This web companion keeps the boundary clear.”

### Wordmark & Logo
Use the exact supplied wolf artwork as the visual mark, displayed compactly above the “Lycon” wordmark. The wordmark remains a custom typographic lockup through weight, spacing, and the brass-highlighted “y”; never substitute a generic logo glyph.

### Signature Brand Color
**Hunter Brass — `#D4A574`**, used for focus states, primary action surfaces, wordmark emphasis, and the visual thread connecting the browser and its online companion.

## Online companion boundary
The online version is a public responsive companion start page. It can offer web search, service shortcuts, documentation, and a clear “Open in Lycon”/download pathway, but it must not claim browser-native filesystem access, credential storage, shields, or local LLM connectivity from an ordinary webpage.
