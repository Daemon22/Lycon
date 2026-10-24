/**
 * @manya/lycon — Deep integration tests.
 * Covers shield intelligence, identity panel, and private session factory.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createShieldIntelligence,
  createIdentityPanel,
  createPrivateSessionFactory,
} from '../deep-integration.js';
import { createAdapter, createShieldBlockedEvent } from '../index.js';
import { createBus, subscribe } from '@manya/unify';
import { createIOC, classifyThreat } from '../../../cybersecurity/src/threats.js';

// Mock cybersecurity API
const mockCyberApi = {
  createIOC,
  classifyThreat,
};

// -- Shield Intelligence --

test('Lycon/ShieldIntel: checkBlockedUrl returns matched=false for benign URLs', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const intel = createShieldIntelligence({ adapter, cybersecurityApi: mockCyberApi });
  const result = intel.checkBlockedUrl({ url: 'https://ads.example.com/track.js', tabId: 't1' });
  assert.equal(result.checked, true);
  assert.equal(result.matched, false);
  assert.equal(result.ioc, null);
});

test('Lycon/ShieldIntel: checkBlockedUrl auto-creates IOC for malicious .tk domain', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const intel = createShieldIntelligence({ adapter, cybersecurityApi: mockCyberApi });
  const result = intel.checkBlockedUrl({ url: 'https://phishing-login.tk/steal', tabId: 't1', filter: 'easylist' });
  assert.equal(result.matched, true);
  assert.ok(result.ioc);
  assert.equal(result.ioc.type, 'domain');
  assert.equal(result.ioc.value, 'phishing-login.tk');
  assert.equal(result.ioc.source, 'lycon-shields');
  assert.ok(result.threat);
  assert.match(result.threat.name, /phishing-login\.tk/);
});

test('Lycon/ShieldIntel: repeat check on same domain matches registered IOC', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const intel = createShieldIntelligence({ adapter, cybersecurityApi: mockCyberApi });
  // First check creates the IOC
  intel.checkBlockedUrl({ url: 'https://bad-site.ml/page1', tabId: 't1' });
  // Second check on same domain should match
  const result = intel.checkBlockedUrl({ url: 'https://bad-site.ml/page2', tabId: 't1' });
  assert.equal(result.matched, true);
  assert.ok(result.ioc);
  assert.equal(result.ioc.value, 'bad-site.ml');
});

test('Lycon/ShieldIntel: registerIOC adds an existing IOC to the store', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const intel = createShieldIntelligence({ adapter, cybersecurityApi: mockCyberApi });
  const ioc = createIOC({ type: 'domain', value: 'known-bad.com', source: 'manual' });
  intel.registerIOC(ioc);
  const result = intel.checkBlockedUrl({ url: 'https://known-bad.com/anything' });
  assert.equal(result.matched, true);
  assert.equal(result.ioc.value, 'known-bad.com');
});

test('Lycon/ShieldIntel: registerIOC rejects invalid IOC', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const intel = createShieldIntelligence({ adapter });
  assert.throws(() => intel.registerIOC({}), /requires ioc.type and ioc.value/);
});

test('Lycon/ShieldIntel: listIOCs returns all registered IOCs', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const intel = createShieldIntelligence({ adapter, cybersecurityApi: mockCyberApi });
  intel.checkBlockedUrl({ url: 'https://bad1.tk/x' });
  intel.checkBlockedUrl({ url: 'https://bad2.ml/y' });
  const iocs = intel.listIOCs();
  assert.equal(iocs.length, 2);
  assert.ok(iocs.some(i => i.value === 'bad1.tk'));
  assert.ok(iocs.some(i => i.value === 'bad2.ml'));
});

test('Lycon/ShieldIntel: stats returns correct counts', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const intel = createShieldIntelligence({ adapter, cybersecurityApi: mockCyberApi });
  intel.checkBlockedUrl({ url: 'https://example.com/ads' });        // benign, no match
  intel.checkBlockedUrl({ url: 'https://phishing.tk/x' });          // malicious, match
  intel.checkBlockedUrl({ url: 'https://phishing.tk/y' });          // repeat, match
  const stats = intel.stats();
  assert.equal(stats.totalChecked, 3);
  assert.equal(stats.totalMatches, 2);
  assert.ok(stats.matchRate > 0);
  assert.equal(stats.iocCount, 1); // only one unique IOC for phishing.tk
});

test('Lycon/ShieldIntel: checkBlockedUrl rejects missing url', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const intel = createShieldIntelligence({ adapter });
  assert.throws(() => intel.checkBlockedUrl({}), /requires a url/);
});

test('Lycon/ShieldIntel: checkBlockedUrl handles invalid URL gracefully', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const intel = createShieldIntelligence({ adapter });
  const result = intel.checkBlockedUrl({ url: 'not-a-url' });
  assert.equal(result.checked, true);
  assert.equal(result.matched, false);
});

test('Lycon/ShieldIntel: checkBlockedUrl detects IP addresses', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const intel = createShieldIntelligence({ adapter, cybersecurityApi: mockCyberApi });
  // Register an IOC for an IP
  const ioc = createIOC({ type: 'ip', value: '192.0.2.123', source: 'manual' });
  intel.registerIOC(ioc);
  const result = intel.checkBlockedUrl({ url: 'https://192.0.2.123/path' });
  assert.equal(result.matched, true);
  assert.equal(result.ioc.value, '192.0.2.123');
});

test('Lycon/ShieldIntel: processShieldBlock forwards event + checks intelligence', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const intel = createShieldIntelligence({ adapter, cybersecurityApi: mockCyberApi });
  let forwarded = null;
  subscribe(bus, 'lycon:shield-blocked', (e) => { forwarded = e; });
  const result = intel.processShieldBlock(
    createShieldBlockedEvent({ tabId: 't1', url: 'https://phishing.tk/x', filter: 'easylist' })
  );
  assert.ok(result.forwarded);
  assert.ok(result.intelligence);
  assert.equal(result.intelligence.matched, true);
  assert.ok(forwarded);
  assert.equal(forwarded.payload.url, 'https://phishing.tk/x');
});

test('Lycon/ShieldIntel: createShieldIntelligence rejects missing adapter', () => {
  assert.throws(() => createShieldIntelligence({}), /requires an adapter/);
});

// -- Identity Panel --

test('Lycon/IdentityPanel: initial state shows unlinked', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const panel = createIdentityPanel({ adapter });
  const state = panel.getPanelState();
  assert.equal(state.profileId, 'default');
  assert.equal(state.linked, false);
  assert.equal(state.identityId, null);
});

test('Lycon/IdentityPanel: linkCurrent links the current profile', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const panel = createIdentityPanel({ adapter });
  panel.linkCurrent('id-josiah');
  const state = panel.getPanelState();
  assert.equal(state.linked, true);
  assert.equal(state.identityId, 'id-josiah');
});

test('Lycon/IdentityPanel: unlinkCurrent removes the link', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const panel = createIdentityPanel({ adapter });
  panel.linkCurrent('id-josiah');
  assert.equal(panel.unlinkCurrent(), true);
  assert.equal(panel.getPanelState().linked, false);
});

test('Lycon/IdentityPanel: switchProfile changes the current profile', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const panel = createIdentityPanel({ adapter });
  panel.switchProfile('work-profile');
  assert.equal(panel.getCurrentProfile(), 'work-profile');
});

test('Lycon/IdentityPanel: switchProfile rejects missing profileId', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const panel = createIdentityPanel({ adapter });
  assert.throws(() => panel.switchProfile(null), /requires a profileId/);
});

test('Lycon/IdentityPanel: linkCurrent rejects missing identityId', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const panel = createIdentityPanel({ adapter });
  assert.throws(() => panel.linkCurrent(null), /requires an identityId/);
});

test('Lycon/IdentityPanel: listLinkedProfiles returns all links', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const panel = createIdentityPanel({ adapter });
  panel.switchProfile('profile-1');
  panel.linkCurrent('id-a');
  panel.switchProfile('profile-2');
  panel.linkCurrent('id-b');
  const links = panel.listLinkedProfiles();
  assert.equal(links.length, 2);
});

test('Lycon/IdentityPanel: on() fires events on link/unlink/switch', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const panel = createIdentityPanel({ adapter });
  const events = [];
  panel.on((e) => events.push(e));
  panel.switchProfile('profile-x');
  panel.linkCurrent('id-test');
  panel.unlinkCurrent();
  assert.equal(events.length, 3);
  assert.equal(events[0].type, 'profile-switched');
  assert.equal(events[1].type, 'identity-linked');
  assert.equal(events[2].type, 'identity-unlinked');
});

test('Lycon/IdentityPanel: createIdentityPanel rejects missing adapter', () => {
  assert.throws(() => createIdentityPanel({}), /requires an adapter/);
});

// -- Private Session Factory --

test('Lycon/PrivateSession: createSession returns a session with profileId and identityId', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const factory = createPrivateSessionFactory({ adapter });
  const session = factory.createSession();
  assert.ok(session.sessionId.startsWith('private-'));
  assert.ok(session.profileId.startsWith('private-'));
  assert.ok(session.identityId);
  assert.ok(session.createdAt);
});

test('Lycon/PrivateSession: createSession links the profile to the identity', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const factory = createPrivateSessionFactory({ adapter });
  const session = factory.createSession();
  assert.equal(adapter.resolveIdentity(session.profileId), session.identityId);
});

test('Lycon/PrivateSession: getSession returns the active session', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const factory = createPrivateSessionFactory({ adapter });
  const session = factory.createSession();
  const retrieved = factory.getSession(session.sessionId);
  assert.equal(retrieved.sessionId, session.sessionId);
});

test('Lycon/PrivateSession: getSession returns null for unknown session', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const factory = createPrivateSessionFactory({ adapter });
  assert.equal(factory.getSession('nonexistent'), null);
});

test('Lycon/PrivateSession: endSession unlinks the profile and removes the session', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const factory = createPrivateSessionFactory({ adapter });
  const session = factory.createSession();
  const result = factory.endSession(session.sessionId);
  assert.equal(result.ended, true);
  assert.equal(result.session.sessionId, session.sessionId);
  // Profile should be unlinked
  assert.equal(adapter.resolveIdentity(session.profileId), null);
  // Session should be gone
  assert.equal(factory.getSession(session.sessionId), null);
});

test('Lycon/PrivateSession: endSession returns ended=false for unknown session', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const factory = createPrivateSessionFactory({ adapter });
  const result = factory.endSession('nonexistent');
  assert.equal(result.ended, false);
  assert.equal(result.session, null);
});

test('Lycon/PrivateSession: listSessions returns all active sessions', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const factory = createPrivateSessionFactory({ adapter });
  factory.createSession();
  factory.createSession();
  factory.createSession();
  const sessions = factory.listSessions();
  assert.equal(sessions.length, 3);
});

test('Lycon/PrivateSession: activeCount returns the number of active sessions', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const factory = createPrivateSessionFactory({ adapter });
  assert.equal(factory.activeCount(), 0);
  factory.createSession();
  assert.equal(factory.activeCount(), 1);
  factory.createSession();
  assert.equal(factory.activeCount(), 2);
});

test('Lycon/PrivateSession: endAllSessions ends all sessions and returns count', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const factory = createPrivateSessionFactory({ adapter });
  factory.createSession();
  factory.createSession();
  factory.createSession();
  const count = factory.endAllSessions();
  assert.equal(count, 3);
  assert.equal(factory.activeCount(), 0);
});

test('Lycon/PrivateSession: createPrivateSessionFactory rejects missing adapter', () => {
  assert.throws(() => createPrivateSessionFactory({}), /requires an adapter/);
});

test('Lycon/PrivateSession: with unify, creates a real federated identity', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  // Pass a mock unify with createIdentity
  const mockUnify = {
    createIdentity({ type, value, metadata }) {
      return {
        id: `id-${value}`,
        primary: { type, value, addedAt: new Date().toISOString() },
        linked: [],
        metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
  };
  const factory = createPrivateSessionFactory({ adapter, unify: mockUnify });
  const session = factory.createSession();
  // The identityId should be derived from the sessionId via the mock createIdentity
  assert.ok(session.identityId.startsWith('id-private-'));
  assert.equal(adapter.resolveIdentity(session.profileId), session.identityId);
});

// -- E2E: full deep integration flow --

test('Lycon/E2E: shield block → intelligence → identity panel → private session', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const panel = createIdentityPanel({ adapter });
  const privateFactory = createPrivateSessionFactory({ adapter });
  const shieldIntel = createShieldIntelligence({ adapter, cybersecurityApi: mockCyberApi });

  // 1. Start a private session
  const session = privateFactory.createSession();
  assert.ok(session.identityId);

  // 2. Switch the identity panel to the private profile
  panel.switchProfile(session.profileId);
  panel.linkCurrent(session.identityId);
  assert.equal(panel.getPanelState().linked, true);

  // 3. Simulate a shield block on a malicious URL
  const result = shieldIntel.processShieldBlock(
    createShieldBlockedEvent({ tabId: 't1', url: 'https://phishing.tk/steal', filter: 'easylist' })
  );
  assert.equal(result.intelligence.matched, true);
  assert.ok(result.intelligence.ioc);

  // 4. End the private session
  privateFactory.endSession(session.sessionId);
  assert.equal(privateFactory.activeCount(), 0);

  // 5. The panel should now show unlinked (profile was unlinked by endSession)
  // Note: the panel's currentProfileId is still the private profile, but it's unlinked
  assert.equal(panel.getPanelState().linked, false);
});
