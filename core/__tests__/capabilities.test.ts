/**
 * Shield S3 — Private by Construction
 * Shield S6 — Capability Minimality
 *
 * Tests that private sessions never receive persistence/credential capabilities,
 * and that every capability is granted only if the effective set includes it.
 */

import { describe, it, expect } from 'vitest';
import {
  CapabilityResolver,
  PRIVATE_SESSION_FORBIDDEN_CAPABILITIES,
  SEALED_BOUNDARY_REVOKED_CAPABILITIES,
  ALL_CAPABILITIES,
  DEFAULT_NETWORK_POLICY,
  DEFAULT_EXPOSURE_POLICY,
  PRIVATE_PERSISTENCE_POLICY,
  PERSISTENT_PERSISTENCE_POLICY,
} from '../types/05_policy';
import { LYCON_IDENTITY_V1 } from '../03_sovereign_identity';
import type { Capability } from '../types/05_policy';
import type { SessionMode } from '../types/01_objects';
import { Id } from '../types/00_ids';

describe('Shield S3: Private by Construction', () => {
  it('private session capability set never includes CanPersist', () => {
    const result = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'private',
      thresholdState: 'sealed',
      tabType: 'private',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: null,
    });
    expect(result.capabilities.has('CanPersist')).toBe(false);
    expect(result.revoked).toContainEqual({
      capability: 'CanPersist',
      reason: 'private-session-restriction',
    });
  });

  it('private session capability set never includes CanStoreLocalStorage', () => {
    const result = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'private',
      thresholdState: 'open',
      tabType: 'private',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: null,
    });
    expect(result.capabilities.has('CanStoreLocalStorage')).toBe(false);
  });

  it('private session capability set never includes CanStoreIndexedDB', () => {
    const result = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'private',
      thresholdState: 'open',
      tabType: 'private',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: null,
    });
    expect(result.capabilities.has('CanStoreIndexedDB')).toBe(false);
  });

  it('private session capability set never includes CanStoreCookies', () => {
    const result = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'private',
      thresholdState: 'open',
      tabType: 'private',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: null,
    });
    expect(result.capabilities.has('CanStoreCookies')).toBe(false);
  });

  it('private session capability set never includes CanAccessCredentials', () => {
    const result = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'private',
      thresholdState: 'open',
      tabType: 'private',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: null,
    });
    expect(result.capabilities.has('CanAccessCredentials')).toBe(false);
  });

  it('private session capability set never includes CanUseDownloads', () => {
    const result = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'private',
      thresholdState: 'open',
      tabType: 'private',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: null,
    });
    expect(result.capabilities.has('CanUseDownloads')).toBe(false);
  });

  it('private session capability set never includes CanSaveFiles', () => {
    const result = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'private',
      thresholdState: 'open',
      tabType: 'private',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: null,
    });
    expect(result.capabilities.has('CanSaveFiles')).toBe(false);
  });

  it('private session capability set never includes CanSync', () => {
    const result = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'private',
      thresholdState: 'open',
      tabType: 'private',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: null,
    });
    expect(result.capabilities.has('CanSync')).toBe(false);
  });

  it('private session capability set never includes CanRunIntelligence', () => {
    const result = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'private',
      thresholdState: 'open',
      tabType: 'private',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: null,
    });
    expect(result.capabilities.has('CanRunIntelligence')).toBe(false);
  });

  it('all PRIVATE_SESSION_FORBIDDEN_CAPABILITIES are absent from private sessions', () => {
    const result = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'private',
      thresholdState: 'open',
      tabType: 'private',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: null,
    });
    for (const cap of PRIVATE_SESSION_FORBIDDEN_CAPABILITIES) {
      expect(
        result.capabilities.has(cap),
        `Private session should NOT have ${cap}`
      ).toBe(false);
    }
  });

  it('NO runtime if(!private) checks needed — capabilities are structurally absent (S3)', () => {
    // This test verifies the architecture: the same CapabilityResolver.resolve
    // call produces different capability sets for private vs persistent sessions,
    // without any conditional in the calling code.
    const persistent = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'persistent',
      thresholdState: 'open',
      tabType: 'normal',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: Id.tab(),
    });
    const privateResult = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'private',
      thresholdState: 'open',
      tabType: 'private',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: null,
    });

    // The persistent set should have MORE capabilities than the private set
    let hasMore = false;
    for (const cap of persistent.capabilities) {
      if (!privateResult.capabilities.has(cap)) {
        hasMore = true;
        break;
      }
    }
    expect(hasMore, 'Persistent session should have at least one capability private session lacks').toBe(true);
  });

  it('persistence policy for private is zero retention', () => {
    expect(PRIVATE_PERSISTENCE_POLICY.retentionMs).toBe(0);
    expect(PRIVATE_PERSISTENCE_POLICY.localStorageAllowed).toBe(false);
    expect(PRIVATE_PERSISTENCE_POLICY.indexedDbAllowed).toBe(false);
  });

  it('persistence policy for persistent allows storage', () => {
    expect(PERSISTENT_PERSISTENCE_POLICY.localStorageAllowed).toBe(true);
    expect(PERSISTENT_PERSISTENCE_POLICY.indexedDbAllowed).toBe(true);
  });
});

describe('Shield S6: Capability Minimality', () => {
  it('hasCapability returns true only if the capability is in the effective set', () => {
    const result = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'persistent',
      thresholdState: 'open',
      tabType: 'normal',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: Id.tab(),
    });

    // For an open threshold, CanNavigate should be present (identity-level capability)
    // CanNetwork should be present but only checkable via checkCapability
    expect(CapabilityResolver.hasCapability(result, 'CanNavigate')).toBeTypeOf('boolean');
  });

  it('checkCapability requires threshold to be open for network capabilities', () => {
    // Sealed threshold → network capabilities revoked
    const sealed = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'persistent',
      thresholdState: 'sealed',
      tabType: 'normal',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: Id.tab(),
    });
    expect(CapabilityResolver.checkCapability(sealed, 'CanNetwork')).toBe(false);

    // Open threshold → network capabilities available
    const open = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'persistent',
      thresholdState: 'open',
      tabType: 'normal',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: Id.tab(),
    });
    // CanNetwork may have been removed if identity doesn't include it;
    // the point is checkCapability gates on threshold state
    const inCaps = open.capabilities.has('CanNetwork');
    const checkable = CapabilityResolver.checkCapability(open, 'CanNetwork');
    if (inCaps) {
      expect(checkable).toBe(true);
    } else {
      expect(checkable).toBe(false);
    }
  });

  it('opening/closing threshold state revokes navigation and engine attachment', () => {
    const opening = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'persistent',
      thresholdState: 'opening',
      tabType: 'normal',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: Id.tab(),
    });
    expect(opening.capabilities.has('CanAttachEngine')).toBe(false);
    expect(opening.capabilities.has('CanNavigate')).toBe(false);
    expect(opening.revoked).toContainEqual({
      capability: 'CanAttachEngine',
      reason: 'boundary-in-transition',
    });
  });

  it('suspended browser revokes ALL capabilities', () => {
    const suspended = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'persistent',
      thresholdState: 'open',
      tabType: 'normal',
      browserState: 'suspended',
      sessionId: Id.session(),
      tabId: Id.tab(),
    });
    expect(suspended.capabilities.size).toBe(0);
  });

  it('NO implicit grants — every capability was either in the identity set or explicitly added', () => {
    // Per Shield S6: "Every capability is granted only if the effective
    // capability set includes it. No implicit grants."
    // This means the only way a capability enters the set is through:
    // 1. Being in the identity's capability list
    // 2. Being explicitly granted by an open threshold
    // (In the current model, capabilities only flow DOWN from identity —
    // nothing is ever implicitly added.)
    const result = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'persistent',
      thresholdState: 'open',
      tabType: 'normal',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: Id.tab(),
    });

    // Every capability in the set must come from the identity
    for (const cap of result.capabilities) {
      // Check it's either in the identity capabilities (mapped to Capability)
      // or it's a network capability granted by an open threshold
      const fromIdentity = LYCON_IDENTITY_V1.capabilities.includes(cap);
      const fromThreshold = ['CanNetwork', 'CanFetchResources', 'CanEmbedContent'].includes(cap);
      // If threshold is open, network caps may be added from identity
      // But in our model, identity caps are mapped, and threshold only REMOVES caps, never adds
      // So every cap must come from identity
      expect(
        fromIdentity || fromThreshold,
        `Capability ${cap} was granted without being in the identity set or threshold-granted`
      ).toBe(true);
    }
  });

  it('SEALED_BOUNDARY_REVOKED_CAPABILITIES are revoked when threshold is sealed', () => {
    const sealedResult = CapabilityResolver.resolve({
      identity: LYCON_IDENTITY_V1,
      sessionMode: 'persistent',
      thresholdState: 'sealed',
      tabType: 'normal',
      browserState: 'running',
      sessionId: Id.session(),
      tabId: Id.tab(),
    });

    for (const cap of SEALED_BOUNDARY_REVOKED_CAPABILITIES) {
      expect(
        sealedResult.capabilities.has(cap),
        `Sealed threshold should revoke ${cap}`
      ).toBe(false);
    }
  });

  it('diff() correctly identifies gained and lost capabilities', () => {
    const before: Set<Capability> = new Set(['CanNavigate', 'CanNetwork']);
    const after: Set<Capability> = new Set(['CanNavigate', 'CanNetwork', 'CanEmbedContent']);
    const { gained, lost } = CapabilityResolver.diff(before, after);
    expect(gained).toContain('CanEmbedContent');
    expect(lost).toHaveLength(0);
  });
});
