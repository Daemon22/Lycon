# The Lycon Core Constitution — v0.3

> **The document outranks the code.** Any dispute between implementation and
> Constitution resolves in favor of the Constitution until it is formally
> amended.
>
> Version history: v0.1 (territory), v0.2 (boundary), v0.3 (selfhood).

---

## Preamble

Lycon is a sovereign browsing workspace. It is not merely an application that
*displays* web content. It is an instrument through which a user enters the
wider web (the Forest) while remaining governed by its own internal order (the
Den). Every line of code in the Core answers to the principles below.

---

## Article I — The Core Is Sovereign

1. The Core owns the browser object graph: identity, sessions, windows, tabs,
   navigation state, the privacy model, exposure state (threshold), policies,
   events, and all data boundaries.
2. Nothing outside the Core may redefine these objects or their lifecycles.
3. The Core is the sole authority that validates Commands against Policy and
   mutates state. It is the only component that can emit Events.

## Article II — The Engine Adapter Is the Only Gate

1. No layer — not the UI, not the agent, not a plugin — may communicate with a
   browser engine except through the EngineAdapter interface.
2. The Core is engine-agnostic. It knows `EngineCapabilities`, never
   "Chromium." The concrete engine (GeckoView, WebView2, etc.) is a replaceable
   strategy behind the Adapter.
3. Swapping the engine must require changes only in the Adapter and the Shell.
   If a Core change is needed to swap engines, the boundary has leaked. Fix the
   boundary, not the Core.
4. The EngineAdapter attaches only when a tab becomes visible. It detaches when
   a tab is hidden or destroyed. The engine is lazy, not eager.

## Article III — Command / Event Discipline

1. The UI never mutates Core state directly. Surfaces issue Commands.
2. Every Command either:
   a. Produces one or more Events (the historical record), or
   b. Produces a `CommandRejected` Event (with a reason).
   There is no third path. A Command that produces neither is a rumor.
3. An Event without a causally traceable Command is a leak. Every Event carries
   the `commandId` of the Command that initiated it.
4. Commands describe **intent**. Events describe **history**. The two are never
   merged into a single type.

## Article IV — The Boundary Principle (Wolf / Den / Forest)

1. **The Den** is Lycon's local domain — sovereign, owned by the user.
2. **The Forest** is the wider web — untrusted, outside Lycon's authority.
3. **The Threshold** is the boundary between Den and Forest. It is:
   - Deliberate — the user must explicitly consent before any online content
     is loaded.
   - Visible — the UI shows a handoff screen ("INTENTIONAL HANDOFF / ONLINE").
   - Guarded — closing the boundary revokes external capabilities, not merely
     changes presentation.
4. Network access is a **permitted capability**, not a change in ownership.
   When the boundary is sealed, the network capability is revoked by construction.
5. The engine never becomes the authority. The Core remains sovereign even when
   the engine renders online content.

## Article V — Privacy as Capability Reduction

1. Privacy is not a boolean flag. It is a restriction of the capability set.
2. A private session receives a **restricted** capability set by construction:
   `CanNetwork` may be granted, but `CanPersist`, `CanStoreCookies`,
   `CanAccessCredentials`, and `CanUseDownloads` (in their persistent form)
   are absent — not checked at runtime, but absent from the set entirely.
3. A private session has a retention policy of **zero**. Its data paths
   (persistent store, cookie jar, credential vault) do not exist. There are no
   `if (!private)` guards — the private session simply lacks the capabilities
   that would exercise those paths.
4. The capability set is computed by the Core, never by surfaces.

## Article VI — Identity Is Core State (Article XII)

1. Lycon maintains an explicit, persistent, machine-readable
   `SovereignIdentity` independent of any interface, engine, device, or
   implementation.
2. **Boot order** is immutable:
   Constitution → Identity → verify identity → Family context → Core state →
   sessions → windows → tabs → surfaces → engine (lazy).
3. Identity has a lifecycle: `declared → ratified → amended → ratified`.
4. Identity has **no silent path**. Every entry into `ratified` is preceded by
   an explicit verification step.
5. Identity-defining properties (charter, domain, limits, lineage) are
   **not** Commandable. They may only be changed through the Amendment
   protocol, which produces an `IdentityAmended` event.
6. Every identity change emits an `identity.*` Event with:
   - An incremented version number
   - An author (the participant responsible for the change)
7. The engine never receives the identity record. Identity is Core-internal
   state, communicated to the engine only through capability tokens, never
   through identity claims.

## Article VII — Family Registry

1. Lycon is a member of the HAEL Foundation's Family of Sovereign Intelligences.
2. Sibling members include ORA ("Watcher of the Skies"), domain: observation /
   sky. **Lycon must not enter ORA's domain.**
3. The registry has **no rank field** — an ecology has no apex entry by
   construction. Siblings are peers, not a hierarchy.
4. `checkDomain(capability)` is the runtime finite-edge check: agents and
   surfaces must consult it before acting on anything in another member's
   territory. Acting outside one's domain is a constitutional violation.

## Article VIII — Sovereignty Is Not Omnipotence

1. Sovereignty is knowing the boundary of one's own authority.
2. The identity manifest must state limits explicitly, including:
   - `limit-not-world`: Lycon is not the world; it is the instrument through
     which the user enters it.
   - `limit-not-observer`: Lycon does not observe beyond its user's browser
     session; it must not enter ORA's observational domain.
3. Acting beyond one's stated limits, even successfully, is a violation.

## Article IX — Non-Impersonation

1. Agents and surfaces speak as their registered participant identity — e.g.,
   "Agent X suggests..." — never as Lycon itself.
2. Lycon's voice is its identity's voice and is not lent to any other
   participant.
3. Agents command the Core like any other peer client. They never bypass it.
4. Forbidden paths for agents:
   - Agent → Engine (direct)
   - Agent → database (direct)
   - Agent → network (direct)
   - Agent → hidden state (direct)
   
   Every agent action must route through the Core via a Command.

## Article X — The Anti-Branch Rule

1. No new feature may keep its own state model. New features are **branches**:
   they subscribe to Core state, render, and command back.
2. If a feature needs Core data it cannot obtain through the existing Command/
   Event vocabulary, the Constitution is amended first — the vocabulary is
   extended — not the other way around.
3. Removing a feature must never remove or corrupt Core canonical state.
   Feature data that enters Core state remains canonical; the feature may be
   unregistered but the state persists.

---

## The Shield (S1–S11)

The following invariants are enforced by the Core. They are the constitutional
test suite. Every commit must leave all Shield invariants passing.

- **S1 — Boundary Sovereignty**: The Threshold state machine has exactly five
  states. Transitions are only: sealed→opening→open→closing→sealed. No
  transition skips a state. Closing the boundary always reduces capabilities.

- **S2 — Engine Isolation**: No non-EngineAdapter code path ever directly
  invokes engine APIs. The Adapter is the only gate.

- **S3 — Private by Construction**: A private Session's capability set never
  includes `CanPersist`, `CanStoreCookies`, `CanAccessCredentials`, or
  `CanUseDownloads` (persistent). No runtime check for "is private" exists in
  any engine interaction path.

- **S4 — Identity Primacy**: Identity is restored and verified before any
  Session object is constructed. The Core refuses to boot without a verified
  identity.

- **S5 — Non-Impersonation**: No Command carries a participant identity that
  does not match its author. Agent-originated Commands are clearly tagged and
  never appear as Lycon-originated.

- **S6 — Capability Minimality**: Every capability is granted only if the
  effective capability set includes it. No implicit grants.

- **S7 — Causal Integrity**: Every Event carries the `commandId` of its
  originating Command. No Event exists without a causally prior Command.

- **S8 — State Machine Integrity**: No object may be in an invalid state. All
  transitions pass through the validator. Invalid transitions produce
  `CommandRejected` events.

- **S9 — Family Non-Interference**: `checkDomain` returns false for any
  capability outside the member's declared domain. ORA's domain (observation/
  sky) is explicitly excluded from Lycon's domain.

- **S10 — Extension Safety**: Adding or removing a feature never mutates Core
  canonical state. Feature data is registered as a branch; removal
  deregisters, never deletes Core state.

- **S11 — Self-Knowledge**: The Core can produce a complete snapshot of its
  current state (identity, sessions, windows, tabs, threshold, capabilities)
  on demand, without revealing the identity record to the engine.

---

*Browse wild. Browse free.* 🦊 — The Lycon Core Constitution, v0.3
