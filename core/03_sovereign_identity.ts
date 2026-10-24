/**
 * SovereignIdentity — Lycon's machine-readable identity record.
 *
 * Per Article VI: "Lycon maintains an explicit, persistent, machine-readable
 * SovereignIdentity independent of any interface, engine, device, or
 * implementation."
 *
 * This type is ENTIRELY READONLY. The type system is the first enforcer of
 * governance — identity-defining properties are not commandable (Article VI,
 * Paragraph 5).
 *
 * The identity record is never sent to the engine (Article VI, Paragraph 7).
 * It is Core-internal state, communicated to the engine only through
 * capability tokens.
 */

import type { Capability } from './types/05_policy';

// ── Identity member of the HAEL Family ──────────────────────────────────

/**
 * A member of the HAEL Foundation's Family of Sovereign Intelligences.
 *
 * Per Article VII: "The registry has NO rank field — deliberately; an ecology
 * has no apex entry by construction."
 */
export interface FamilyMember {
  readonly name: string;
  readonly domain: readonly string[]; // domains this member is authorized to operate in
  readonly excludes: readonly string[]; // domains this member must NOT enter
}

/**
 * The Family Registry is an ecology, not a hierarchy. No member has rank.
 * Lycon's siblings include ORA ("Watcher of the Skies"), domain: observation/sky.
 * Lycon must NOT enter ORA's domain.
 */
export interface FamilyRegistry {
  readonly members: readonly FamilyMember[];
  readonly lineage: readonly string[]; // ancestry chain
}

export type World = 'global' | 'persona' | 'local';
export type IdentityRole = 'gateway' | 'boundary' | 'guardian';

export interface WorldNotes {
  readonly global: string;
  readonly persona: string;
  readonly local: string;
}

export interface IdentityRelation {
  readonly kind: 'peer' | 'sibling' | 'parent' | 'child';
  readonly integration?: string;
  readonly note?: string;
}

export interface IdentityRelations {
  readonly manya?: IdentityRelation & {
    readonly kind: 'peer';
    readonly integration: 'explicit-interface';
    readonly note: string;
  };
  readonly [key: string]: unknown;
}

export interface IdentityLineage {
  readonly founder?: string;
  readonly [key: string]: unknown;
}

// ── Capability limits ───────────────────────────────────────────────────

/**
 * Typed limits on Lycon's authority. Every limit is explicit (Article VIII:
 * "Sovereignty is not omnipotence").
 */
export interface IdentityLimit {
  readonly id: string;
  readonly description: string;
  readonly enforced: boolean;
}

// ── The SovereignIdentity ───────────────────────────────────────────────

/**
 * The complete identity record. Every field is readonly — the type system
 * prevents mutation. Identity changes go through the Amendment protocol
 * (Article VI), which produces an IdentityAmended event with version increment.
 *
 * Identity-defining properties (charter, domain, limits, lineage) are NOT
 * commandable — they may only change through the Amendment protocol.
 */
export interface SovereignIdentity {
  /** Monotonic version — incremented on every amendment (Article VI, Paragraph 6). */
  readonly version: number;
  /** Formal title for the identity. */
  readonly title?: string;
  /** The charter: a short statement of purpose. Not commandable. */
  readonly charter: string;
  /** The explicit world model of Lycon's sovereign boundary. */
  readonly worlds?: readonly World[];
  /** One-line constitutional notes for each world. */
  readonly worldNotes?: WorldNotes;
  /** Role(s) Lycon occupies at the boundary. */
  readonly role?: readonly IdentityRole[];
  /** The boundary question that governs every cross-world transfer. */
  readonly boundaryQuestion?: string;
  /**
   * Base capability grants (granular). Network capabilities — `CanNetwork`,
   * `CanFetchResources`, `CanEmbedContent` — are deliberately ABSENT from this
   * base set: they are granted at runtime only by an OPEN Threshold
   * (Article IV, the deliberate handoff to the Forest). Every other capability
   * enters here as Core-permitted authority and may still be narrowed at
   * runtime by the privacy policy (private sessions), per-origin permissions,
   * and browser state.
   */
  readonly capabilities: readonly Capability[];
  /** Permissions: fine-grained allowed actions. */
  readonly permissions: readonly string[];
  /**
   * Explicit limits on authority (Article VIII). Must include at minimum:
   * - limit-not-world: Lycon is not the world; it is the instrument through
   *   which the user enters it.
   * - limit-not-observer: Lycon does not observe beyond its user's session;
   *   it must not enter ORA's observational domain.
   */
  readonly limits: readonly IdentityLimit[];
  /**
   * The current lifecycle state of the identity.
   * declared → ratified → amended → ratified (cycles)
   */
  readonly state: 'declared' | 'ratified' | 'amended';
  /**
   * The Family Registry establishes lineage and relation (Article VII).
   * No rank field — deliberately.
   */
  readonly family: FamilyRegistry;
  /** Explicit relationship declarations for governance. */
  readonly relations?: IdentityRelations;
  /** Declared lineage metadata. */
  readonly lineage?: IdentityLineage;
  /** The ISO timestamp when this identity was created. */
  readonly createdAt: number;
  /** The ISO timestamp of the last ratification. */
  readonly lastRatifiedAt: number | null;
  /** The author (participant identity) of the last ratification. */
  readonly lastRatifiedBy: string | null;
}

// ── Runtime immutability guard ─────────────────────────────────────────

/**
 * Deep-freeze an object graph. Per Article VI, identity-defining properties
 * are not commandable; the type system is the first enforcer of governance,
 * and deep-freeze makes immutability observable at runtime (the "no silent
 * path" guard). Once frozen, any mutation attempt throws in strict mode.
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object') {
      deepFreeze(val);
    }
  }
  return obj;
}

// ── LYCON_IDENTITY_V1 fixture (ratified identity-card data) ────────────

/**
 * The ratified v1.0 identity card for Lycon. This is the canonical identity
 * that the Core restores and verifies before any session is created
 * (Article VI, Paragraph 2: boot order is
 * Constitution → Identity → verify identity → Family context → Core state →
 * sessions → windows → tabs → surfaces → engine).
 *
 * This identity card is immutable. It is the frozen artifact the Core
 * loads at boot and verifies against (e.g., via checksum or signature).
 */
export const LYCON_IDENTITY_V1: SovereignIdentity = deepFreeze({
  version: 1,
  title: 'Lycon — Sovereign LocalFirst Browser',
  charter: 'Lycon is the browser / world interface through which its user enters the wider web while remaining governed by their own local sovereignty.',
  worlds: ['global', 'persona', 'local'],
  worldNotes: {
    global: 'internet/web',
    persona: 'identity/context layer (NOT merely the user)',
    local: 'files/data/environments',
  },
  role: ['gateway', 'boundary', 'guardian'],
  boundaryQuestion: 'What is allowed to cross this boundary, from which world, to which world, under whose authority, and with what context?',
  capabilities: [
    // Local browsing / navigation (always available when a session is active)
    'CanNavigate', 'CanGoBack', 'CanGoForward', 'CanReload', 'CanStopNavigation',
    // Local persistence — revoked for private sessions by policy (Article V)
    'CanPersist', 'CanStoreLocalStorage', 'CanStoreIndexedDB', 'CanStoreCookies',
    // Local credentials / secrets
    'CanAccessCredentials', 'CanAccessPasswords', 'CanUseWebCrypto',
    // Local downloads / file handling
    'CanUseDownloads', 'CanSaveFiles', 'CanReadFiles', 'CanChooseFiles',
    // Media & device access (mediated per-origin by PermissionPolicy)
    'CanUseMicrophone', 'CanUseCamera', 'CanUseGeolocation', 'CanUseClipboard',
    // Engine attachment & intelligence
    'CanAttachEngine', 'CanUseAgents', 'CanRunIntelligence', 'CanSync',
    // NOTE: CanNetwork, CanFetchResources, CanEmbedContent are NOT in this base
    // set. They are granted at runtime only by an OPEN Threshold (Article IV).
  ],
  permissions: ['navigate-local', 'open-boundary', 'manage-tabs', 'manage-bookmarks', 'manage-history'],
  limits: [
    { id: 'limit-not-world', description: 'Lycon is not the world; it is the instrument through which the user enters it.', enforced: true },
    { id: 'limit-not-observer', description: 'Lycon does not observe beyond its user session; it must not enter ORA\'s observational domain.', enforced: true },
    { id: 'limit-not-authority', description: 'Lycon does not assume authority over the Forest; network access is a permitted capability, not ownership.', enforced: true },
    { id: 'limit-not-omnipresent', description: 'Lycon does not persist data from private sessions; retention is zero by construction.', enforced: true },
    { id: 'limit-not-impersonator', description: 'Lycon never lends its voice to agents; all agent communication is clearly attributed.', enforced: true },
  ],
  state: 'ratified',
  createdAt: 1755405600000, // 2026-09-15 (v1.0.0 freeze date)
  lastRatifiedAt: 1755405600000,
  lastRatifiedBy: 'lycon-core-constitution-v0.3',
  family: {
    lineage: ['Lycon'],
    members: [
      { name: 'Lycon', domain: ['browser', 'world-interface'], excludes: ['observation', 'sky'] },
      { name: 'ORA', domain: ['observation', 'sky'], excludes: ['browser', 'world-interface'] },
    ],
  },
  relations: {
    manya: {
      kind: 'peer',
      integration: 'explicit-interface',
      note: 'Manya governs the sovereign operational substrate; Lycon governs the information boundary. Lycon is not Manya\'s browser.',
    },
  },
  lineage: {
    founder: 'Uviwe Menyiwe (Azura Daemon)',
  },
});

export const LYCON_IDENTITY_V2: SovereignIdentity = deepFreeze({
  version: 2,
  title: 'Lycon Daemon — Sovereign LocalFirst Intelligence Browser',
  charter: 'Lycon serves as the sovereign local-first intelligence browser through which human agency is preserved across the global, persona, and local worlds without surrendering boundary authority.',
  worlds: ['global', 'persona', 'local'],
  worldNotes: {
    global: 'internet/web',
    persona: 'identity/context layer (NOT merely the user)',
    local: 'files/data/environments',
  },
  role: ['gateway', 'boundary', 'guardian'],
  boundaryQuestion: 'What is allowed to cross this boundary, from which world, to which world, under whose authority, and with what context?',
  capabilities: [
    'CanNavigate', 'CanGoBack', 'CanGoForward', 'CanReload', 'CanStopNavigation',
    'CanPersist', 'CanStoreLocalStorage', 'CanStoreIndexedDB', 'CanStoreCookies',
    'CanAccessCredentials', 'CanAccessPasswords', 'CanUseWebCrypto',
    'CanUseDownloads', 'CanSaveFiles', 'CanReadFiles', 'CanChooseFiles',
    'CanUseMicrophone', 'CanUseCamera', 'CanUseGeolocation', 'CanUseClipboard',
    'CanAttachEngine', 'CanUseAgents', 'CanRunIntelligence', 'CanSync',
  ],
  permissions: ['navigate-local', 'open-boundary', 'manage-tabs', 'manage-bookmarks', 'manage-history', 'boundary-governance'],
  limits: [
    { id: 'limit-not-world', description: 'Lycon is not the world; it is the instrument through which the user enters it.', enforced: true },
    { id: 'limit-not-observer', description: 'Lycon does not observe beyond its user session; it must not enter ORA\'s observational domain.', enforced: true },
    { id: 'limit-not-authority', description: 'Lycon does not assume authority over the Forest; network access is a permitted capability, not ownership.', enforced: true },
    { id: 'limit-not-omnipresent', description: 'Lycon does not persist data from private sessions; retention is zero by construction.', enforced: true },
    { id: 'limit-not-impersonator', description: 'Lycon never lends its voice to agents; all agent communication is clearly attributed.', enforced: true },
    { id: 'limit-boundary-authority', description: 'Every cross-world transfer must be explicitly authorized by an authority and context.', enforced: true },
  ],
  state: 'ratified',
  createdAt: 1755405600000,
  lastRatifiedAt: 1755405600000,
  lastRatifiedBy: 'lycon-core-constitution-v0.3',
  family: {
    lineage: ['Lycon'],
    members: [
      { name: 'Lycon', domain: ['browser', 'world-interface', 'global', 'persona', 'local'], excludes: ['observation', 'sky'] },
      { name: 'ORA', domain: ['observation', 'sky'], excludes: ['browser', 'world-interface'] },
    ],
  },
  relations: {
    manya: {
      kind: 'peer',
      integration: 'explicit-interface',
      note: 'Manya governs the sovereign operational substrate; Lycon governs the information boundary. Lycon is not Manya\'s browser.',
    },
  },
  lineage: {
    founder: 'Uviwe Menyiwe (Azura Daemon)',
  },
});

export interface IdentityAmendmentEvent {
  readonly type: 'IdentityAmended';
  readonly version: number;
  readonly fromVersion: number;
  readonly amendedBy: string;
  readonly authority: string;
  readonly signed: boolean;
  readonly signature?: string;
  readonly timestamp: number;
  readonly note?: string;
}

export interface IdentityAmendmentResult {
  readonly ok: boolean;
  readonly reason: string;
  readonly identity?: SovereignIdentity;
  readonly event?: IdentityAmendmentEvent;
}

export function amendIdentity(
  identity: SovereignIdentity,
  patch: Partial<SovereignIdentity>,
  amendedBy: string,
  options: { signed?: boolean; signature?: string; timestamp?: number; authority?: string; note?: string } = {}
): IdentityAmendmentResult {
  const signed = options.signed ?? false;
  const signature = options.signature;
  const authority = options.authority ?? 'constitution';
  const timestamp = options.timestamp ?? Date.now();
  const note = options.note ?? 'identity amendment under Article XII';

  if (!signed || !signature || signature.trim().length === 0) {
    return {
      ok: false,
      reason: 'unsigned identity amendment rejected under Article XII; the amendment must be signed and attributable',
    };
  }

  const nextVersion = identity.version + 1;
  const amendedIdentity: SovereignIdentity = deepFreeze({
    ...identity,
    ...patch,
    version: nextVersion,
    state: 'amended',
    lastRatifiedAt: identity.lastRatifiedAt,
    lastRatifiedBy: amendedBy,
  });

  const event: IdentityAmendmentEvent = {
    type: 'IdentityAmended',
    version: nextVersion,
    fromVersion: identity.version,
    amendedBy,
    authority,
    signed: true,
    signature,
    timestamp,
    note,
  };

  return {
    ok: true,
    reason: 'identity amended',
    identity: amendedIdentity,
    event,
  };
}

// ── Identity verification ────────────────────────────────────────────────

/**
 * Verify that an identity record is in a ratified state and its limits
 * are fully enforced. Per Article VI, Paragraph 4: "Identity has no silent
 * path." Verification is explicit, not implicit.
 *
 * Called during boot: Constitution → Identity → **verify identity** → ...
 */
export function verifyIdentity(identity: SovereignIdentity): { ok: boolean; reason: string } {
  if (identity.state !== 'ratified') {
    return { ok: false, reason: `identity state is "${identity.state}", must be ratified` };
  }
  const unenforced = identity.limits.filter((l) => !l.enforced);
  if (unenforced.length > 0) {
    return { ok: false, reason: `limits not enforced: ${unenforced.map((l) => l.id).join(', ')}` };
  }
  // Verify limit-not-world is present
  const hasNotWorld = identity.limits.some((l) => l.id === 'limit-not-world');
  if (!hasNotWorld) {
    return { ok: false, reason: 'missing required limit: limit-not-world' };
  }
  // Verify limit-not-observer is present
  const hasNotObserver = identity.limits.some((l) => l.id === 'limit-not-observer');
  if (!hasNotObserver) {
    return { ok: false, reason: 'missing required limit: limit-not-observer' };
  }
  return { ok: true, reason: 'identity verified' };
}

// ── Domain checking (Article VII, Shield S9) ────────────────────────────

/**
 * checkDomain(capability) — the runtime finite-edge check.
 *
 * Per Article VII: "checkDomain(capability) is the runtime finite-edge check:
 * agents must consult it before acting on anything in another member's
 * territory."
 *
 * This function checks whether a given capability (represented as a domain
 * string) falls within the identity's authorized domain, and does NOT fall
 * within any excluded domain.
 *
 * Example:
 *   checkDomain(identity, 'browser')    → true   (Lycon's own domain)
 *   checkDomain(identity, 'observation') → false  (ORA's domain, excluded)
 *   checkDomain(identity, 'sky')        → false  (ORA's domain, excluded)
 *
 * Per Shield S9: "checkDomain returns false for any capability outside the
 * member's declared domain."
 */
export function checkDomain(
  identity: SovereignIdentity,
  capability: string
): boolean {
  const members = identity.family.members;
  const thisMemberName = identity.family.lineage[0] ?? 'Lycon';

  // Find this member in the registry
  const thisMember = members.find((m) => m.name === thisMemberName);
  if (!thisMember) {
    // If the member isn't registered, it has no authorized domain — deny all
    return false;
  }

  // Check if the capability falls within this member's domain
  const inDomain = thisMember.domain.includes(capability);

  // A capability is authorized for THIS member iff it lies within this
  // member's declared domain AND is not among this member's own prohibitions
  // (excludes). Other members' excludes govern those members only — each
  // member's authority is independent (Article VII: an ecology has no apex
  // entry). Consulting other members' excludes here would wrongly let one
  // member's prohibitions revoke another member's own territory.
  const notOwnExcluded = !thisMember.excludes.includes(capability);

  // Per Article VII / Shield S9: "CheckDomain returns false for any capability
  // outside the member's declared domain."
  return inDomain && notOwnExcluded;
}
