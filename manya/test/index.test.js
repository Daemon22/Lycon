/**
 * @manya/lycon — Integration tests.
 * Verifies the Manya-Lycon adapter correctly forwards browser events to the
 * Manya event bus, links browser profiles to federated identities, and
 * declares the right capabilities and sync channels.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAdapter,
  createNavigationEvent,
  createShieldBlockedEvent,
  createBookmarkEvent,
  createDownloadEvent,
  LYCON_SYNC_CHANNELS,
  LYCON_CAPABILITIES,
} from '../index.js';
import { lyconManifest } from '@manya/toolkit';
import { createBus, subscribe } from '@manya/unify';

// -- Constants --

test('Lycon: LYCON_SYNC_CHANNELS has 7 channels', () => {
  assert.equal(LYCON_SYNC_CHANNELS.length, 7);
  assert.ok(LYCON_SYNC_CHANNELS.includes('lycon:navigation'));
  assert.ok(LYCON_SYNC_CHANNELS.includes('lycon:shield-blocked'));
  assert.ok(LYCON_SYNC_CHANNELS.includes('lycon:identity-linked'));
});

test('Lycon: LYCON_CAPABILITIES has 6 capabilities', () => {
  assert.equal(LYCON_CAPABILITIES.length, 6);
  assert.ok(LYCON_CAPABILITIES.includes('webBrowsing'));
  assert.ok(LYCON_CAPABILITIES.includes('adBlocking'));
  assert.ok(LYCON_CAPABILITIES.includes('privateBrowsing'));
});

test('Lycon: lyconManifest has correct identity and capabilities', () => {
  assert.equal(lyconManifest.id, 'lycon-browser');
  assert.equal(lyconManifest.name, 'Lycon Browser');
  assert.equal(lyconManifest.foundation, 'Manya');
  assert.ok(lyconManifest.owns.includes('webBrowsing'));
  assert.ok(lyconManifest.owns.includes('adBlocking'));
  assert.ok(lyconManifest.owns.includes('bookmarkManagement'));
  assert.ok(lyconManifest.owns.includes('downloadManagement'));
  assert.ok(lyconManifest.owns.includes('privateBrowsing'));
  assert.ok(lyconManifest.owns.includes('browserHistoryManagement'));
});

test('Lycon: lyconManifest sync channels match LYCON_SYNC_CHANNELS', () => {
  for (const ch of LYCON_SYNC_CHANNELS) {
    assert.ok(lyconManifest.syncChannels.includes(ch), `manifest should declare ${ch}`);
  }
});

// -- Adapter creation --

test('Lycon/Adapter: createAdapter returns adapter with sessionId and bus', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  assert.ok(adapter.sessionId.startsWith('lycon-'));
  assert.equal(adapter.bus, bus);
  assert.equal(typeof adapter.forward, 'function');
  assert.equal(typeof adapter.linkIdentity, 'function');
  assert.equal(typeof adapter.resolveIdentity, 'function');
});

test('Lycon/Adapter: createAdapter rejects missing bus', () => {
  assert.throws(() => createAdapter({}), /requires a bus/);
});

// -- Event forwarding --

test('Lycon/Adapter: forward publishes navigation event to bus', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  let received = null;
  subscribe(bus, 'lycon:navigation', (evt) => { received = evt; });
  adapter.forward('lycon:navigation', createNavigationEvent({ tabId: 't1', url: 'https://example.com' }));
  assert.ok(received);
  assert.equal(received.topic, 'lycon:navigation');
  assert.equal(received.payload.url, 'https://example.com');
  assert.equal(received.payload.tabId, 't1');
  assert.equal(received.sourceToolId, 'lycon-browser');
  assert.equal(received.payload.sessionId, adapter.sessionId);
});

test('Lycon/Adapter: forward publishes shield-blocked event to bus', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  let received = null;
  subscribe(bus, 'lycon:shield-blocked', (evt) => { received = evt; });
  adapter.forward('lycon:shield-blocked', createShieldBlockedEvent({ tabId: 't1', url: 'https://ads.example.com/track.js' }));
  assert.ok(received);
  assert.equal(received.payload.url, 'https://ads.example.com/track.js');
  assert.equal(received.payload.filter, 'easylist');
});

test('Lycon/Adapter: forward publishes bookmark-added event to bus', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  let received = null;
  subscribe(bus, 'lycon:bookmark-added', (evt) => { received = evt; });
  adapter.forward('lycon:bookmark-added', createBookmarkEvent({ url: 'https://example.com', title: 'Example' }));
  assert.ok(received);
  assert.equal(received.payload.url, 'https://example.com');
  assert.equal(received.payload.title, 'Example');
});

test('Lycon/Adapter: forward publishes download event to bus', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  let received = null;
  subscribe(bus, 'lycon:download', (evt) => { received = evt; });
  adapter.forward('lycon:download', createDownloadEvent({ url: 'https://example.com/file.pdf', filename: 'file.pdf', total: 1024, state: 'progressing' }));
  assert.ok(received);
  assert.equal(received.payload.filename, 'file.pdf');
  assert.equal(received.payload.state, 'progressing');
});

test('Lycon/Adapter: forward rejects unknown channel', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  assert.throws(() => adapter.forward('lycon:unknown', {}), /Unknown Lycon sync channel/);
});

test('Lycon/Adapter: forward returns delivery result', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  subscribe(bus, 'lycon:navigation', () => {});
  subscribe(bus, 'lycon:navigation', () => {});
  const result = adapter.forward('lycon:navigation', createNavigationEvent({ tabId: 't1', url: 'https://example.com' }));
  assert.equal(result.delivered, 2);
  assert.ok(result.eventId.startsWith('evt-'));
});

// -- Identity federation --

test('Lycon/Adapter: linkIdentity links a browser profile to a federated identity', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const result = adapter.linkIdentity('profile-default', 'id-abc123');
  assert.equal(result.linked, true);
  assert.equal(result.browserProfileId, 'profile-default');
  assert.equal(result.identityId, 'id-abc123');
});

test('Lycon/Adapter: linkIdentity rejects missing fields', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  assert.throws(() => adapter.linkIdentity(null, 'id-abc'), /requires browserProfileId and identityId/);
  assert.throws(() => adapter.linkIdentity('profile', null), /requires browserProfileId and identityId/);
});

test('Lycon/Adapter: resolveIdentity returns linked identity', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  adapter.linkIdentity('profile-default', 'id-abc123');
  assert.equal(adapter.resolveIdentity('profile-default'), 'id-abc123');
});

test('Lycon/Adapter: resolveIdentity returns null for unlinked profile', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  assert.equal(adapter.resolveIdentity('profile-unknown'), null);
});

test('Lycon/Adapter: listLinks returns all links', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  adapter.linkIdentity('profile-1', 'id-a');
  adapter.linkIdentity('profile-2', 'id-b');
  const links = adapter.listLinks();
  assert.equal(links.length, 2);
  assert.ok(links.some(l => l.browserProfileId === 'profile-1' && l.identityId === 'id-a'));
  assert.ok(links.some(l => l.browserProfileId === 'profile-2' && l.identityId === 'id-b'));
});

test('Lycon/Adapter: unlinkIdentity removes a link', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  adapter.linkIdentity('profile-1', 'id-a');
  assert.equal(adapter.unlinkIdentity('profile-1'), true);
  assert.equal(adapter.resolveIdentity('profile-1'), null);
  assert.equal(adapter.unlinkIdentity('profile-1'), false); // already removed
});

test('Lycon/Adapter: linkIdentity publishes identity-linked event', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  let received = null;
  subscribe(bus, 'lycon:identity-linked', (evt) => { received = evt; });
  adapter.linkIdentity('profile-default', 'id-abc123');
  assert.ok(received);
  assert.equal(received.payload.browserProfileId, 'profile-default');
  assert.equal(received.payload.identityId, 'id-abc123');
});

// -- Event factory functions --

test('Lycon/Events: createNavigationEvent includes timestamp', () => {
  const evt = createNavigationEvent({ tabId: 't1', url: 'https://example.com', private: true });
  assert.equal(evt.type, 'navigation');
  assert.equal(evt.tabId, 't1');
  assert.equal(evt.url, 'https://example.com');
  assert.equal(evt.private, true);
  assert.ok(evt.timestamp);
});

test('Lycon/Events: createShieldBlockedEvent defaults filter to easylist', () => {
  const evt = createShieldBlockedEvent({ tabId: 't1', url: 'https://ads.example.com' });
  assert.equal(evt.filter, 'easylist');
});

test('Lycon/Events: createBookmarkEvent includes optional favicon', () => {
  const evt = createBookmarkEvent({ url: 'https://example.com', title: 'Example', favicon: 'https://example.com/favicon.ico' });
  assert.equal(evt.favicon, 'https://example.com/favicon.ico');
  const evt2 = createBookmarkEvent({ url: 'https://example.com', title: 'Example' });
  assert.equal(evt2.favicon, null);
});

test('Lycon/Events: createDownloadEvent includes all fields', () => {
  const evt = createDownloadEvent({ url: 'https://example.com/file.pdf', filename: 'file.pdf', total: 1024, state: 'completed' });
  assert.equal(evt.url, 'https://example.com/file.pdf');
  assert.equal(evt.filename, 'file.pdf');
  assert.equal(evt.total, 1024);
  assert.equal(evt.state, 'completed');
});

// -- Adapter introspection --

test('Lycon/Adapter: getSyncChannels returns all 7 channels', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const channels = adapter.getSyncChannels();
  assert.equal(channels.length, 7);
  assert.ok(channels.includes('lycon:navigation'));
});

test('Lycon/Adapter: getCapabilities returns all 6 capabilities', () => {
  const bus = createBus();
  const adapter = createAdapter({ bus });
  const caps = adapter.getCapabilities();
  assert.equal(caps.length, 6);
  assert.ok(caps.includes('webBrowsing'));
});

// -- End-to-end: browser events flow through the bus to subscribers --

test('Lycon/E2E: navigation → shield-blocked → bookmark → download all flow through bus', () => {
  const bus = createBus({ replay: true });
  const adapter = createAdapter({ bus });
  const received = [];
  for (const ch of LYCON_SYNC_CHANNELS) {
    subscribe(bus, ch, (evt) => received.push(evt));
  }
  // Simulate a browsing session
  adapter.forward('lycon:navigation', createNavigationEvent({ tabId: 't1', url: 'https://example.com' }));
  adapter.forward('lycon:shield-blocked', createShieldBlockedEvent({ tabId: 't1', url: 'https://ads.example.com/track.js' }));
  adapter.forward('lycon:bookmark-added', createBookmarkEvent({ url: 'https://example.com', title: 'Example' }));
  adapter.forward('lycon:download', createDownloadEvent({ url: 'https://example.com/file.pdf', filename: 'file.pdf', total: 1024, state: 'completed' }));
  // Link an identity
  adapter.linkIdentity('profile-default', 'id-josiah');
  // All 5 events should have been received
  assert.equal(received.length, 5);
  const topics = received.map(e => e.topic);
  assert.ok(topics.includes('lycon:navigation'));
  assert.ok(topics.includes('lycon:shield-blocked'));
  assert.ok(topics.includes('lycon:bookmark-added'));
  assert.ok(topics.includes('lycon:download'));
  assert.ok(topics.includes('lycon:identity-linked'));
  // All events should carry the adapter's sessionId
  for (const evt of received) {
    assert.equal(evt.payload.sessionId, adapter.sessionId);
  }
});
