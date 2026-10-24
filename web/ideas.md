# Lycon Permanent Website — Design Direction

## Theme Name: Quiet Field Instrument

### Very Brief Intro
A local-first browser interface presented as a composed field instrument: dark plum surfaces, warm amber signal accents, restrained motion, and a wolf mark that feels protective rather than decorative.

### Probability
0.04

## Theme Name: Archive Cabin

### Very Brief Intro
A warmer, paper-led interface with archival cream, ink, and muted copper, making Lycon feel like a private reading room for personal browsing.

### Probability
0.07

## Theme Name: Night Relay

### Very Brief Intro
A more technical control-room direction using near-black surfaces, violet signal states, and bright amber handoff markers for a sharper operational mood.

### Probability
0.02

## Chosen Approach: Quiet Field Instrument

### Design Movement
Contemporary digital brutalism softened by editorial typography and field-notes instrumentation. The interface should feel authored, calm, and slightly rugged rather than like a generic browser dashboard.

### Core Principles
1. **Local information hierarchy:** the sidebar is the source of truth for library, settings, and device state; the hero stays focused on browsing.
2. **Signal over decoration:** amber, green, and plum accents communicate state and action instead of being used as ornamental gradients.
3. **Editorial asymmetry:** content uses an anchored sidebar, browser chrome, and an offset hero rather than a centered marketing grid.
4. **Deliberate handoff:** external destinations are always staged visibly before leaving the local workspace.

### Color Philosophy
The base is a deep plum-black that gives the interface a quiet, nocturnal workspace quality. Warm amber is the ownable action color: it marks movement, search, and deliberate handoff. Plum-violet is reserved for private or protected states, while moss green signals local continuity and a healthy device state. Color should be sparse and semantic so the interface never becomes noisy.

### Layout Paradigm
A persistent vertical field-kit rail supports a browser-like top chrome and a spacious, asymmetrical content stage. On the Start view, the hero occupies the visual center of gravity with the wordmark and wolf mark balanced across an offset two-column composition. Library and preference screens use the same shell but become denser and more task-oriented.

### Signature Elements
1. A compact wolf mark with an amber keyline and violet halo.
2. Thin instrument-style borders, monospaced state labels, and signal dots.
3. A visible online handoff screen that distinguishes the wider web from local pages.

### Interaction Philosophy
Interactions should feel deliberate and reversible. Navigation is immediate but quiet, buttons acknowledge input with a small physical lift, and risky or external actions are staged before they execute. Voice input should feel like an optional instrument: visible, keyboard-reachable, and honest when browser permissions are unavailable.

### Animation
Use short ease-out transitions under 240ms for buttons, tabs, fields, and state changes. Use a restrained page entrance with opacity and a small vertical offset. The private microphone state may pulse subtly, but no animation should compete with the browsing task. Respect `prefers-reduced-motion` by disabling nonessential movement.

### Typography System
Use **Space Grotesk** for display headlines and brand lockups, **Manrope** for readable interface copy, and **DM Mono** for URLs, labels, and device-state readouts. Headlines should use a slightly compressed, tight-tracked rhythm; body copy should stay between 14px and 15px with generous line-height; metadata should remain compact and uppercase.

### Brand Essence
Lycon is a local-first browser workspace for people who want their personal browsing library close and their online handoffs intentional; it is different because it treats privacy as a visible posture rather than a hidden preference.

Personality: **protective, independent, observant**.

### Brand Voice
Headlines are brief, confident, and a little wild. CTAs are direct and specific. Microcopy explains boundaries without fear-mongering or filler.

Example lines:

> Browse wild. Browse free.

> The wider web starts when you say go.

### Wordmark & Logo
Use a compact uppercase LYCON wordmark set in Space Grotesk with generous tracking beside the supplied wolf crest. The mark should remain a graphic symbol without relying on the wordmark alone, and should be legible in the sidebar, favicon, and hero treatment.

### Signature Brand Color
**Signal Amber — `hsl(39 83% 60%)`**. It is the visual cue for intentional movement, local actions, and the moment Lycon makes a boundary visible.

## Style Decisions

- Keep the hero focused on the browsing message, search, voice input, and wolf mark.
- Keep library counts, local mode, settings, and device-state information in the sidebar or dedicated views rather than duplicating it in the hero.
- Preserve the current Lycon dark plum / amber / violet palette as the permanent website identity.
- Use voice input in both the browser toolbar and Start-view search, with graceful unsupported and denied-permission feedback.

## Accepted Review Amendments

- Headlines use a compact Space Grotesk character at display scale; drama comes from scale, tracking, and asymmetry rather than decorative type effects.
- Signal Amber appears on intentional movement, active navigation, handoff, and primary actions; it is not used as a general gradient treatment.
- The wolf mark reads as a compact field badge with an amber keyline and violet protection halo, not as a large fantasy crest.
- Secondary screens preserve the browser shell but shift into denser, task-oriented instrument panels instead of repeating the Start hero.
- Matte plum-black surfaces, etched borders, mono state labels, and small signal dots carry the material language.
