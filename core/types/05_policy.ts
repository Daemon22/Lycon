/**
 * Gate 4 — Policy & Capabilities (THE SHIELD)
 *
 * Per Article V: "Privacy as capability reduction, not a boolean."
 * A private session receives a RESTRICTED capability set by construction —
 * its persistent-store code paths don't exist; they are absent, not checked
 * at runtime.
 *
 * Per Shield S3: A private Session's capability set never includes CanPersist,
 * CanStoreCookies, CanAccessCredentials, or CanUseDownloads (persistent).
 *
 * Per Shield S6: "Every capability is granted only if the effective capability
 * set includes it. No implicit grants."
 *
 * Per Article IV: "Closing the boundary must revoke external capabilities,
 * not merely change presentation."
 *
 * The CapabilityResolver is the Core's single authority for computing
 * effective capabilities. No surface may compute capabilities independently.
 */

import type { TabId, WindowId, SessionId } from './00_ids';
import type {
  SessionMode,
  TabType,
} from './01_objects';
import type {
  BrowserState,
  ThresholdState,
  NavigationState,
} from './02_lifecycle';
import type { SovereignIdentity } from '../03_sovereign_identity';

// ── Capability definitions ──────────────────────────────────────────────

/**
 * All capabilities that the Core can grant or revoke.
 * Each is a fine-grained, atomic permission — no compound capabilities.
 */
export type Capability =
  // Navigation & browsing
  | 'CanNavigate'
  | 'CanGoBack'
  | 'CanGoForward'
  | 'CanReload'
  | 'CanStopNavigation'
  // Network & external resources
  | 'CanNetwork'
  | 'CanFetchResources'
  | 'CanEmbedContent' // iframe embedding of external content
  // Persistence (local data storage)
  | 'CanPersist'
  | 'CanStoreLocalStorage'
  | 'CanStoreIndexedDB'
  | 'CanStoreCookies'
  // Credentials & secrets
  | 'CanAccessCredentials'
  | 'CanAccessPasswords'
  | 'CanUseWebCrypto'
  // Download & file system
  | 'CanUseDownloads'
  | 'CanSaveFiles'
  | 'CanReadFiles'
  | 'CanChooseFiles'
  // Media & device
  | 'CanUseMicrophone'
  | 'CanUseCamera'
  | 'CanUseGeolocation'
  | 'CanUseClipboard'
  // Engine attachment
  | 'CanAttachEngine'
  // Agent features
  | 'CanUseAgents'
  | 'CanRunIntelligence'
  // Sync
  | 'CanSync';

/**
 * The complete set of capabilities. Used for set operations.
 */
export const ALL_CAPABILITIES: readonly Capability[] = [
  'CanNavigate',
  'CanGoBack',
  'CanGoForward',
  'CanReload',
  'CanStopNavigation',
  'CanNetwork',
  'CanFetchResources',
  'CanEmbedContent',
  'CanPersist',
  'CanStoreLocalStorage',
  'CanStoreIndexedDB',
  'CanStoreCookies',
  'CanAccessCredentials',
  'CanAccessPasswords',
  'CanUseWebCrypto',
  'CanUseDownloads',
  'CanSaveFiles',
  'CanReadFiles',
  'CanChooseFiles',
  'CanUseMicrophone',
  'CanUseCamera',
  'CanUseGeolocation',
  'CanUseClipboard',
  'CanAttachEngine',
  'CanUseAgents',
  'CanRunIntelligence',
  'CanSync',
] as const;

// ── Private session capability restrictions ─────────────────────────────

/**
 * Capabilities that a private session NEVER receives, regardless of
 * identity or permissions. This list is the single source of truth for
 * privacy enforcement (Article V).
 *
 * Per Article V: "A private session has a retention policy of zero."
 * These capabilities are ABSENT from the set, not checked at runtime.
 */
export const PRIVATE_SESSION_FORBIDDEN_CAPABILITIES: readonly Capability[] = [
  'CanPersist',
  'CanStoreLocalStorage',
  'CanStoreIndexedDB',
  'CanStoreCookies',
  'CanAccessCredentials',
  'CanAccessPasswords',
  'CanSaveFiles',
  'CanUseDownloads',
  'CanSync',
  'CanRunIntelligence', // agents cannot persist private-session data
] as const;

// ── Sealed threshold capability restrictions ────────────────────────────

/**
 * Capabilities that are revoked when the threshold is sealed (boundary
 * closed). Per Article IV: "closing the boundary must revoke external
 * capabilities, not merely change presentation."
 */
export const SEALED_BOUNDARY_REVOKED_CAPABILITIES: readonly Capability[] = [
  'CanNetwork',
  'CanFetchResources',
  'CanEmbedContent',
  'CanStoreCookies', // cookies require network interaction
] as const;

/**
 * Capabilities that are granted when the threshold is open (boundary
 * open). These are ONLY available when the threshold is in the 'open' state.
 */
export const OPEN_BOUNDARY_GRANTED_CAPABILITIES: readonly Capability[] = [
  'CanNetwork',
  'CanFetchResources',
  'CanEmbedContent',
] as const;

// ── Policy types ────────────────────────────────────────────────────────

/**
 * A PrivacyPolicy defines what data persists for a session.
 * Per Article V, this is not a runtime check — it's a capability filter.
 */
export interface PrivacyPolicy {
  readonly name: string;
  readonly description: string;
  /** Capabilities to remove for this privacy policy. */
  readonly removeCapabilities: readonly Capability[];
}

/**
 * A NetworkPolicy governs how and when the Core may access the network.
 * Per Article IV, network is a permitted capability, not ownership.
 */
export interface NetworkPolicy {
  readonly name: string;
  readonly description: string;
  /** Capabilities required for network access. */
  readonly requiredCapabilities: readonly Capability[];
  /** Capabilities revoked when network is denied. */
  readonly revokedCapabilities: readonly Capability[];
}

/**
 * A PermissionPolicy defines per-origin permissions (microphone, camera,
 * geolocation, clipboard, etc.).
 */
export interface PermissionPolicy {
  readonly origin: string; // 'self' for local pages, or a URL origin
  readonly permissions: ReadonlyMap<string, boolean>; // permission name → granted
}

/**
 * A PersistencePolicy defines what data can be stored and for how long.
 * Per Article V: "A private session has a retention policy of zero."
 */
export interface PersistencePolicy {
  readonly name: string;
  /** Whether local storage is allowed. */
  readonly localStorageAllowed: boolean;
  /** Whether IndexedDB is allowed. */
  readonly indexedDbAllowed: boolean;
  /** Maximum retention period in milliseconds (0 = no persistence). */
  readonly retentionMs: number;
}

/**
 * An ExposurePolicy governs the threshold (boundary) state machine.
 * Per Article IV, the threshold is deliberate, visible, and guarded.
 */
export interface ExposurePolicy {
  readonly name: string;
  readonly description: string;
  /** Whether online content can be loaded. */
  readonly allowOnline: boolean;
  /** Time in ms to display the "opening" state before transitioning to "open". */
  readonly openingDelayMs: number;
  /** Time in ms to display the "closing" state before transitioning to "sealed". */
  readonly closingDelayMs: number;
  /** Whether the user must explicitly consent before opening the boundary. */
  readonly requiresExplicitConsent: boolean;
}

// ── Policy set ──────────────────────────────────────────────────────────

/**
 * The complete set of policies governing a session or tab.
 * The Core uses this to compute effective capabilities.
 */
export interface PolicySet {
  readonly privacy: PrivacyPolicy;
  readonly network: NetworkPolicy;
  readonly persistence: PersistencePolicy;
  readonly exposure: ExposurePolicy;
  readonly permissions: readonly PermissionPolicy[];
}

// ── Effective capabilities ──────────────────────────────────────────────

/**
 * The effective capability set for a specific context (session + tab +
 * threshold state). This is computed by the CapabilityResolver and is
 * the ONLY way surfaces should determine what a session/tab can do.
 *
 * Per Shield S6: "Every capability is granted only if the effective
 * capability set includes it."
 */
export interface EffectiveCapabilities {
  readonly sessionId: SessionId;
  readonly tabId: TabId | null;
  readonly thresholdState: ThresholdState;
  readonly sessionMode: SessionMode;
  readonly capabilities: ReadonlySet<Capability>;
  /** Capabilities that were explicitly revoked and why. */
  readonly revoked: ReadonlyArray<{ capability: Capability; reason: string }>;
}

// ── Default policies ───────────────────────────────────────────────────

export const PERSISTENT_PRIVACY_POLICY: PrivacyPolicy = {
  name: 'persistent',
  description: 'Standard browsing with full persistence.',
  removeCapabilities: [],
};

export const PRIVATE_PRIVACY_POLICY: PrivacyPolicy = {
  name: 'private',
  description: 'Private session — zero retention, no persistence capabilities.',
  removeCapabilities: PRIVATE_SESSION_FORBIDDEN_CAPABILITIES as readonly Capability[],
};

export const DEFAULT_NETWORK_POLICY: NetworkPolicy = {
  name: 'default',
  description: 'Network access gated by threshold state.',
  requiredCapabilities: ['CanNetwork'],
  revokedCapabilities: [...SEALED_BOUNDARY_REVOKED_CAPABILITIES],
};

export const PERSISTENT_PERSISTENCE_POLICY: PersistencePolicy = {
  name: 'persistent',
  localStorageAllowed: true,
  indexedDbAllowed: true,
  retentionMs: 0, // 0 = indefinite
};

export const PRIVATE_PERSISTENCE_POLICY: PersistencePolicy = {
  name: 'private',
  localStorageAllowed: false,
  indexedDbAllowed: false,
  retentionMs: 0, // retention policy of zero
};

export const DEFAULT_EXPOSURE_POLICY: ExposurePolicy = {
  name: 'deliberate-handoff',
  description: 'Online content requires explicit user consent before loading.',
  allowOnline: true,
  openingDelayMs: 500,
  closingDelayMs: 300,
  requiresExplicitConsent: true,
};

// ── CapabilityResolver ─────────────────────────────────────────────────

/**
 * The CapabilityResolver is the Core's single authority for computing
 * effective capabilities (Article V, Shield S3, Shield S6).
 *
 * It takes:
 * - The SovereignIdentity (for base capabilities and permissions)
 * - The session mode (persistent vs. private)
 * - The threshold state (sealed/open)
 * - Optional per-origin permissions
 *
 * And returns the EffectiveCapabilities for that context.
 *
 * Per Article V: "The capability set is computed by the Core, never by surfaces."
 */
export class CapabilityResolver {
  /**
   * Compute the effective capability set for a given context.
   * This is a pure function — no side effects, no state mutation.
   */
  static resolve(params: {
    identity: SovereignIdentity;
    sessionMode: SessionMode;
    thresholdState: ThresholdState;
    tabType: TabType;
    browserState: BrowserState;
    sessionId: SessionId;
    tabId: TabId | null;
    permissions?: PermissionPolicy[];
    origin?: string; // current origin for permission lookup
    navigationState?: NavigationState; // whether a navigation is in progress
  }): EffectiveCapabilities {
    const { identity, sessionMode, thresholdState, tabType, browserState } = params;
    const permissions = params.permissions ?? [];
    const origin = params.origin ?? 'self';

    const revoked: Array<{ capability: Capability; reason: string }> = [];

    // Start with identity's base capabilities
    const caps: Set<Capability> = new Set(
      identity.capabilities
        .map((c) => c as Capability)
        .filter((c): c is Capability => ALL_CAPABILITIES.includes(c as Capability))
    );

    // If the Core is not running, no capabilities
    if (browserState === 'shutdown' || browserState === 'suspended') {
      for (const c of ALL_CAPABILITIES) {
        caps.delete(c);
        revoked.push({ capability: c, reason: 'core-not-running' });
      }
      return {
        sessionId: '' as SessionId,
        tabId: null,
        thresholdState,
        sessionMode,
        capabilities: caps,
        revoked,
      };
    }

    // Network capabilities enter the set ONLY when the Threshold is open —
    // the deliberate handoff to the Forest (Article IV). They are NOT part of
    // the identity's base set; closing the boundary (sealed) removes them
    // (SEALED_BOUNDARY_REVOKED_CAPABILITIES below). Private sessions keep
    // network access — Article V allows CanNetwork for private sessions;
    // only persistence/credentials/downloads are absent there.
    if (thresholdState === 'open') {
      for (const c of OPEN_BOUNDARY_GRANTED_CAPABILITIES) {
        caps.add(c);
      }
    }

    // Private session restrictions (Article V)
    if (sessionMode === 'private') {
      for (const c of PRIVATE_SESSION_FORBIDDEN_CAPABILITIES) {
        if (caps.delete(c)) {
          revoked.push({ capability: c, reason: 'private-session-restriction' });
        }
      }
    }

    // Threshold state restrictions (Article IV)
    if (thresholdState === 'sealed') {
      for (const c of SEALED_BOUNDARY_REVOKED_CAPABILITIES) {
        if (caps.delete(c)) {
          revoked.push({ capability: c, reason: 'boundary-sealed' });
        }
      }
    }

    // Destroyed tab: no capabilities
    if (tabType === 'private' && sessionMode !== 'private') {
      // Inconsistent state — tab is private but session is persistent.
      // This is a violation; revoke all persistence capabilities.
      const persistenceCaps: Capability[] = [
        'CanPersist',
        'CanStoreLocalStorage',
        'CanStoreIndexedDB',
        'CanStoreCookies',
      ];
      for (const c of persistenceCaps) {
        if (caps.delete(c)) {
          revoked.push({ capability: c, reason: 'inconsistent-tab-session-mode' });
        }
      }
    }

    // Engine attachment only when threshold is open or sealed (local pages)
    // Engine cannot attach when threshold is opening/closing (transient state)
    if (thresholdState === 'opening' || thresholdState === 'closing') {
      if (caps.delete('CanAttachEngine')) {
        revoked.push({ capability: 'CanAttachEngine', reason: 'boundary-in-transition' });
      }
      if (caps.delete('CanNavigate')) {
        revoked.push({ capability: 'CanNavigate', reason: 'boundary-in-transition' });
      }
    }

    // Navigation state: if a navigation is already in progress, block new navigation
    if (params.navigationState !== undefined && params.navigationState !== 'completed' && params.navigationState !== 'failed' && params.navigationState !== 'cancelled') {
      if (caps.delete('CanNavigate')) {
        revoked.push({ capability: 'CanNavigate', reason: 'navigation-in-progress' });
      }
    }

    // Per-origin permission check
    const perm = permissions.find((p) => p.origin === origin);
    if (perm) {
      // Check device permissions
      const deviceCaps: Array<[Capability, string]> = [
        ['CanUseMicrophone', 'microphone'],
        ['CanUseCamera', 'camera'],
        ['CanUseGeolocation', 'geolocation'],
        ['CanUseClipboard', 'clipboard'],
      ];
      for (const [cap, permName] of deviceCaps) {
        const granted = perm.permissions.get(permName);
        if (granted === false && caps.delete(cap)) {
          revoked.push({ capability: cap, reason: `permission-denied:${permName}` });
        }
      }
    }

    // Private sessions never get network unless explicitly... wait.
    // Per Article IV: network access is a permitted capability. A private session
    // CAN have network access (for online pages), but cannot persist data.
    // The threshold still gates network access.
    // (No additional restrictions here — the private session restrictions above
    // already removed persistence/cookie/credential capabilities.)

    // Final guard: if browser is not running, remove engine attachment
    if (browserState !== 'running') {
      caps.delete('CanAttachEngine');
      revoked.push({ capability: 'CanAttachEngine', reason: 'browser-not-running' });
    }

    // Build the result
    return {
      sessionId: params.sessionId,
      tabId: params.tabId,
      thresholdState,
      sessionMode,
      capabilities: caps,
      revoked,
    };
  }

  /**
   * Check if a specific capability is in the effective set.
   * Per Shield S6: "Every capability is granted only if the
   * effective capability set includes it. No implicit grants."
   */
  static hasCapability(effective: EffectiveCapabilities, capability: Capability): boolean {
    return effective.capabilities.has(capability);
  }

  /**
   * Check if a capability is present AND the threshold allows it.
   * For network-related capabilities, the threshold must be open.
   */
  static checkCapability(
    effective: EffectiveCapabilities,
    capability: Capability
  ): boolean {
    if (!effective.capabilities.has(capability)) return false;

    // Network-related capabilities require an open threshold
    const networkCaps: Capability[] = ['CanNetwork', 'CanFetchResources', 'CanEmbedContent'];
    if (networkCaps.includes(capability)) {
      return effective.thresholdState === 'open';
    }

    return true;
  }

  /**
   * Compute the difference between two capability sets.
   * Used by the Core to emit ThresholdOpened/ThresholdSealed events
   * with the exact list of capabilities gained or lost.
   */
  static diff(
    before: Set<Capability>,
    after: Set<Capability>
  ): { gained: Capability[]; lost: Capability[] } {
    const gained = ALL_CAPABILITIES.filter((c) => after.has(c) && !before.has(c));
    const lost = ALL_CAPABILITIES.filter((c) => before.has(c) && !after.has(c));
    return { gained, lost };
  }
}
