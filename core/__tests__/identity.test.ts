/**
 * Shield S4 — Identity Primacy
 * Shield S9 — Family Non-Interference
 *
 * Tests for identity verification, the boot order constraint,
 * and domain boundary checking (checkDomain).
 */

import { describe, it, expect } from 'vitest';
import {
  LYCON_IDENTITY_V1,
  LYCON_IDENTITY_V2,
  verifyIdentity,
  checkDomain,
  amendIdentity,
} from '../03_sovereign_identity';
import { isValidIdentityTransition } from '../types/02_lifecycle';
import type { SovereignIdentity } from '../03_sovereign_identity';

describe('Identity V2 governance amendments', () => {
  it('LYCON_IDENTITY_V2 is valid, readonly, and declares all three worlds', () => {
    expect(LYCON_IDENTITY_V2.version).toBe(2);
    expect(LYCON_IDENTITY_V2.state).toBe('ratified');
    expect(LYCON_IDENTITY_V2.worlds).toEqual(['global', 'persona', 'local']);
    expect(LYCON_IDENTITY_V2.worldNotes?.persona).toBe('identity/context layer (NOT merely the user)');
    expect(LYCON_IDENTITY_V2.role).toEqual(['gateway', 'boundary', 'guardian']);
    expect(verifyIdentity(LYCON_IDENTITY_V2).ok).toBe(true);
    expect(() => {
      'use strict';
      // @ts-expect-error — readonly property, TS prevents this
      LYCON_IDENTITY_V2.version = 99;
    }).toThrow();
  });

  it('persona is explicitly not equal to user', () => {
    expect(LYCON_IDENTITY_V2.worldNotes?.persona).not.toBe('user');
    expect(LYCON_IDENTITY_V2.worldNotes?.persona).toContain('NOT merely the user');
    expect(LYCON_IDENTITY_V2.worldNotes?.persona).not.toEqual('user');
  });

  it('relations.manya is a peer relation and there is no ownership or rank field in the manifest or FamilyRegistry', () => {
    expect(LYCON_IDENTITY_V2.relations?.manya).toMatchObject({
      kind: 'peer',
      integration: 'explicit-interface',
    });
    expect((LYCON_IDENTITY_V2.relations?.manya as any).ownership).toBeUndefined();
    expect((LYCON_IDENTITY_V2.relations?.manya as any).rank).toBeUndefined();
    for (const member of LYCON_IDENTITY_V2.family.members) {
      expect((member as Record<string, unknown>).rank).toBeUndefined();
    }
    expect((LYCON_IDENTITY_V2 as Record<string, unknown>).rank).toBeUndefined();
  });

  it('amendment path produces a versioned attributable IdentityAmended event per Article XII', () => {
    const signed = amendIdentity(
      LYCON_IDENTITY_V2,
      { title: 'Lycon Daemon — Sovereign LocalFirst Intelligence Browser V2.1' },
      'constitution-article-xii',
      { signed: true, signature: 'sig:article-xii:valid', authority: 'article-xii', note: 'governance amendment' }
    );

    expect(signed.ok).toBe(true);
    expect(signed.event?.type).toBe('IdentityAmended');
    expect(signed.event?.version).toBe(LYCON_IDENTITY_V2.version + 1);
    expect(signed.event?.amendedBy).toBe('constitution-article-xii');
    expect(signed.event?.signed).toBe(true);
    expect(signed.identity?.state).toBe('amended');
  });

  it('unsigned amendment is rejected', () => {
    const unsigned = amendIdentity(
      LYCON_IDENTITY_V2,
      { title: 'Attempted unsigned amendment' },
      'constitution-article-xii',
      { signed: false, authority: 'article-xii' }
    );

    expect(unsigned.ok).toBe(false);
    expect(unsigned.reason).toMatch(/unsigned identity amendment rejected/i);
  });
});

describe('Shield S4: Identity Primacy', () => {
  it('LYCON_IDENTITY_V1 is in ratified state', () => {
    expect(LYCON_IDENTITY_V1.state).toBe('ratified');
  });

  it('verifyIdentity accepts a ratified identity', () => {
    const result = verifyIdentity(LYCON_IDENTITY_V1);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('identity verified');
  });

  it('verifyIdentity rejects a declared (unratified) identity', () => {
    const declared: SovereignIdentity = { ...LYCON_IDENTITY_V1, state: 'declared' };
    const result = verifyIdentity(declared);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/state is "declared"/);
  });

  it('verifyIdentity rejects an amended (unratified) identity', () => {
    const amended: SovereignIdentity = { ...LYCON_IDENTITY_V1, state: 'amended' };
    const result = verifyIdentity(amended);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/state is "amended"/);
  });

  it('verifyIdentity accepts a re-ratified identity after an amendment cycle', () => {
    // Identity lifecycle: declared → ratified → amended → ratified.
    // After an amendment the record returns to state 'ratified' (with an
    // incremented version) and is verifiable again — there is no distinct
    // 'ratified_after_amend' state.
    const reRatified: SovereignIdentity = {
      ...LYCON_IDENTITY_V1,
      version: LYCON_IDENTITY_V1.version + 1,
      state: 'ratified',
    };
    const result = verifyIdentity(reRatified);
    expect(result.ok).toBe(true);
    expect(reRatified.version).toBe(LYCON_IDENTITY_V1.version + 1);
  });

  it('verifyIdentity rejects identity with unenforced limits', () => {
    const badLimits: SovereignIdentity = {
      ...LYCON_IDENTITY_V1,
      limits: LYCON_IDENTITY_V1.limits.map((l) =>
        l.id === 'limit-not-world' ? { ...l, enforced: false } : l
      ),
    };
    const result = verifyIdentity(badLimits);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not enforced/);
  });

  it('identity is immutable — identity-defining properties are not commandable (Article VI)', () => {
    // The SovereignIdentity interface has all readonly fields.
    // This test confirms the type-level guarantee at runtime:
    // attempting to mutate would throw in strict mode.
    expect(() => {
      'use strict';
      // @ts-expect-error — readonly property, TS prevents this
      LYCON_IDENTITY_V1.version = 999;
    }).toThrow();
  });

  it('identity restores before any session (boot order, Article VI Paragraph 2)', () => {
    // The boot order is: Constitution → Identity → verify identity → Family context →
    // Core state → sessions → windows → tabs → surfaces → engine(lazy)
    //
    // This test verifies that identity verification passes independently
    // of session state. The identity must be valid before any session
    // can be constructed.
    const identityOk = verifyIdentity(LYCON_IDENTITY_V1);
    expect(identityOk.ok).toBe(true);

    // The identity must have a FamilyRegistry with lineage before sessions
    expect(LYCON_IDENTITY_V1.family).toBeDefined();
    expect(LYCON_IDENTITY_V1.family.lineage).toContain('Lycon');
  });

  it('identity survives engine/UI/device replacement — identity is Core state, not interface state (Article VI)', () => {
    // The identity is stored in the Core's identity manifest, not in
    // localStorage, not in the engine, not in the UI.
    // This test verifies that the identity can be serialized and restored
    // without loss.
    const serialized = JSON.stringify(LYCON_IDENTITY_V1);
    const restored = JSON.parse(serialized) as SovereignIdentity;
    expect(verifyIdentity(restored).ok).toBe(true);
    expect(restored.version).toBe(LYCON_IDENTITY_V1.version);
    expect(restored.state).toBe(LYCON_IDENTITY_V1.state);
  });

  it('unsigned identity amendments are rejected (Article VI, Paragraph 8)', () => {
    // An identity amendment that is not ratified should fail verification.
    // The Amendment protocol requires: AmendIdentity → IdentityAmended event
    // → RatifyIdentity → IdentityRatified event.
    // An unsigned amendment (amended state without subsequent ratification)
    // is rejected by verifyIdentity.
    const unsigned: SovereignIdentity = {
      ...LYCON_IDENTITY_V1,
      version: LYCON_IDENTITY_V1.version + 1,
      state: 'amended',
      limits: [
        ...LYCON_IDENTITY_V1.limits,
        {
          id: 'limit-test-only',
          description: 'A test limit that was not ratified',
          enforced: true,
        },
      ],
    };
    const result = verifyIdentity(unsigned);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/state is "amended"/);
  });

  it('identity has NO silent path (Article VI, Paragraph 4)', () => {
    // Every identity change emits an identity.* event.
    // The state machine requires explicit transitions:
    // declared → ratified → amended → ratified (version-incremented).
    // There is no direct path that skips ratification or amendment, and no
    // self-transition that could signal a change without the protocol.
    expect(LYCON_IDENTITY_V1.state).toBe('ratified');
    expect(isValidIdentityTransition('ratified', 'ratified')).toBe(false);
    expect(isValidIdentityTransition('declared', 'amended')).toBe(false);
    expect(isValidIdentityTransition('amended', 'ratified')).toBe(true);
  });
});

describe('Shield S9: Family Non-Interference', () => {
  it('checkDomain returns true for Lycon\'s own domain', () => {
    expect(checkDomain(LYCON_IDENTITY_V1, 'browser')).toBe(true);
    expect(checkDomain(LYCON_IDENTITY_V1, 'world-interface')).toBe(true);
  });

  it('checkDomain returns false for ORA\'s domain (observation/sky)', () => {
    // Per Article VII: "Lycon must NOT enter ORA's domain"
    expect(checkDomain(LYCON_IDENTITY_V1, 'observation')).toBe(false);
    expect(checkDomain(LYCON_IDENTITY_V1, 'sky')).toBe(false);
  });

  it('checkDomain returns false for unmapped capabilities', () => {
    expect(checkDomain(LYCON_IDENTITY_V1, 'nonexistent-capability')).toBe(false);
  });

  it('family registry has NO rank field (Article VII)', () => {
    // The FamilyMember interface has no 'rank' field.
    // This test verifies at runtime that the registry members don't have rank.
    for (const member of LYCON_IDENTITY_V1.family.members) {
      expect((member as unknown as Record<string, unknown>).rank).toBeUndefined();
    }
  });

  it('ORA is a sibling, not subordinate (no rank, no hierarchy)', () => {
    const ora = LYCON_IDENTITY_V1.family.members.find((m) => m.name === 'ORA');
    expect(ora).toBeDefined();
    expect(ora!.domain).toContain('observation');
    expect(ora!.domain).toContain('sky');
    expect(ora!.excludes).toContain('browser');
    expect(ora!.excludes).toContain('world-interface');
  });

  it('Lycon\'s excludes include ORA\'s domains', () => {
    const lycon = LYCON_IDENTITY_V1.family.members.find((m) => m.name === 'Lycon');
    expect(lycon).toBeDefined();
    expect(lycon!.excludes).toContain('observation');
    expect(lycon!.excludes).toContain('sky');
  });

  it('checkDomain returns false for ORA member checking its own excluded domain', () => {
    // If we construct an ORA identity, checkDomain should return false for
    // browser/world-interface (Lycon's domain)
    const oraIdentity: SovereignIdentity = {
      ...LYCON_IDENTITY_V1,
      family: {
        lineage: ['ORA'],
        members: [
          { name: 'ORA', domain: ['observation', 'sky'], excludes: ['browser', 'world-interface'] },
          { name: 'Lycon', domain: ['browser', 'world-interface'], excludes: ['observation', 'sky'] },
        ],
      },
    };
    expect(checkDomain(oraIdentity, 'browser')).toBe(false);
    expect(checkDomain(oraIdentity, 'observation')).toBe(true);
  });
});
