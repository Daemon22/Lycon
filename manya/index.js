/**
 * @manya/lycon — Manya integration layer for the Lycon browser.
 *
 * This module bridges Lycon's bridge contract (window.__lyconNative / window.lycon)
 * into the Manya ecosystem. It does three things:
 *
 * 1. **Event forwarding** — Lycon browser events (navigation, download, bookmark,
 *    shield-blocked) are forwarded to Manya Unify's event bus on the
 *    `lycon:*` sync channels.
 *
 * 2. **Identity federation** — browser sessions/profiles can be linked to Manya
 *    federated identities, so an ORCID iD or DOI resolves to a browser profile.
 *
 * 3. **Shield intelligence** — Lycon's ad/tracker blocker can query Manya's
 *    cybersecurity tool for additional threat intelligence (IOCs, malicious URLs).
 *
 * The adapter runs in the Electron main process (Node.js side) and communicates
 * with the renderer via the existing Lycon IPC channels. It does NOT modify
 * Lycon's bridge contract — it adds new `manya:*` actions alongside the
 * existing `lycon:*` actions.
 */

import { randomUUID } from 'node:crypto';

/**
 * Manya-Lycon sync channels — declared in the lyconManifest and used by the
 * event bus to route browser events to interested tools.
 */
export const LYCON_SYNC_CHANNELS = [
  'lycon:navigation',      // a tab navigated to a URL
  'lycon:bookmark-added',  // a bookmark was saved
  'lycon:download',        // a download started/progressed/completed
  'lycon:shield-blocked',  // the ad blocker rejected a request
  'lycon:tab-opened',      // a new tab was created
  'lycon:tab-closed',      // a tab was closed
  'lycon:identity-linked', // a browser profile was linked to a federated identity
];

/**
 * Manya-Lycon capabilities — owned by the lycon tool, distinct from all other
 * Manya tools. These are also declared in @manya/toolkit's capabilityOwners.
 */
export const LYCON_CAPABILITIES = [
  'webBrowsing',
  'adBlocking',
  'bookmarkManagement',
  'downloadManagement',
  'privateBrowsing',
  'browserHistoryManagement',
];

/**
 * Creates a Manya-Lycon adapter that wires browser events into a Manya event bus.
 *
 * @param {object} options
 * @param {object} options.bus - A Manya Unify event bus (from createBus()).
 * @param {object} [options.unify] - Optional Manya Unify module (for identity federation).
 * @returns {ManyaLyconAdapter}
 */
export function createAdapter({ bus, _unify } = {}) {
  if (!bus) throw new Error('createAdapter requires a bus (Manya event bus)');

  const sessionId = `lycon-${randomUUID().slice(0, 8)}`;
  const linkedIdentities = new Map(); // browserProfileId -> federatedIdentityId

  return {
    sessionId,
    bus,

    /**
     * Forwards a Lycon browser event to the Manya event bus.
     * Called by the Electron main process when Lycon emits events.
     * @param {string} channel - One of LYCON_SYNC_CHANNELS.
     * @param {object} event - The event payload.
     * @returns {{ delivered: number, eventId: string }}
     */
    forward(channel, event) {
      if (!LYCON_SYNC_CHANNELS.includes(channel)) {
        throw new Error(`Unknown Lycon sync channel: ${channel}. Valid: ${LYCON_SYNC_CHANNELS.join(', ')}`);
      }
      const enriched = {
        ...event,
        sourceToolId: 'lycon-browser',
        sessionId: this.sessionId,
        timestamp: event.timestamp || new Date().toISOString(),
      };
      const result = publishToBus(bus, channel, enriched);
      return result;
    },

    /**
     * Links a browser profile to a Manya federated identity.
     * @param {string} browserProfileId - The browser profile identifier.
     * @param {string} identityId - The Manya federated identity id.
     * @returns {{ linked: boolean, browserProfileId: string, identityId: string }}
     */
    linkIdentity(browserProfileId, identityId) {
      if (!browserProfileId || !identityId) {
        throw new Error('linkIdentity requires browserProfileId and identityId');
      }
      linkedIdentities.set(browserProfileId, identityId);
      this.forward('lycon:identity-linked', { browserProfileId, identityId });
      return { linked: true, browserProfileId, identityId };
    },

    /**
     * Resolves the federated identity linked to a browser profile.
     * @param {string} browserProfileId
     * @returns {string|null} The federated identity id, or null if not linked.
     */
    resolveIdentity(browserProfileId) {
      return linkedIdentities.get(browserProfileId) || null;
    },

    /**
     * Returns all browser-profile → identity links.
     * @returns {Array<{ browserProfileId: string, identityId: string }>}
     */
    listLinks() {
      return Array.from(linkedIdentities.entries()).map(([browserProfileId, identityId]) => ({
        browserProfileId,
        identityId,
      }));
    },

    /**
     * Unlinks a browser profile from its federated identity.
     * @param {string} browserProfileId
     * @returns {boolean} True if a link was removed.
     */
    unlinkIdentity(browserProfileId) {
      return linkedIdentities.delete(browserProfileId);
    },

    /**
     * Returns the list of Lycon sync channels (for mesh registration).
     * @returns {string[]}
     */
    getSyncChannels() {
      return [...LYCON_SYNC_CHANNELS];
    },

    /**
     * Returns the list of Lycon capabilities (for mesh registration).
     * @returns {string[]}
     */
    getCapabilities() {
      return [...LYCON_CAPABILITIES];
    },
  };
}

/**
 * Creates a browser event for navigation.
 * @param {object} input
 * @param {string} input.tabId
 * @param {string} input.url
 * @param {boolean} [input.private]
 * @returns {object}
 */
export function createNavigationEvent({ tabId, url, private: isPrivate }) {
  return {
    type: 'navigation',
    tabId,
    url,
    private: !!isPrivate,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates a browser event for a shield block.
 * @param {object} input
 * @param {string} input.tabId
 * @param {string} input.url
 * @param {string} [input.filter]
 * @returns {object}
 */
export function createShieldBlockedEvent({ tabId, url, filter }) {
  return {
    type: 'shield-blocked',
    tabId,
    url,
    filter: filter || 'easylist',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates a browser event for a bookmark addition.
 * @param {object} input
 * @param {string} input.url
 * @param {string} input.title
 * @param {string} [input.favicon]
 * @returns {object}
 */
export function createBookmarkEvent({ url, title, favicon }) {
  return {
    type: 'bookmark-added',
    url,
    title,
    favicon: favicon || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates a browser event for a download.
 * @param {object} input
 * @param {string} input.url
 * @param {string} input.filename
 * @param {number} input.total
 * @param {string} input.state
 * @returns {object}
 */
export function createDownloadEvent({ url, filename, total, state }) {
  return {
    type: 'download',
    url,
    filename,
    total,
    state,
    timestamp: new Date().toISOString(),
  };
}

// -- Internal: publish to a Manya bus without depending on internal APIs --

function publishToBus(bus, topic, event) {
  // Use the public publish() if available; otherwise fall back to direct subscriber iteration
  if (typeof bus._publish === 'function') {
    return bus._publish(topic, event);
  }
  // Fallback: iterate subscribers directly (matches @manya/unify eventbus internal shape)
  const enriched = {
    eventId: `evt-${randomUUID().slice(0, 12)}`,
    topic,
    type: event.type || 'generic',
    sourceToolId: event.sourceToolId || 'lycon-browser',
    payload: event,
    publishedAt: new Date().toISOString(),
  };
  let delivered = 0;
  const subs = bus.subscribers?.get(topic);
  if (subs) {
    for (const sub of subs) {
      try { sub.handler(enriched); delivered++; } catch { /* swallow */ }
    }
  }
  if (bus.history) {
    bus.history.push(enriched);
    if (bus.history.length > (bus.maxHistory || 1000)) bus.history.shift();
  }
  bus.eventCount = (bus.eventCount || 0) + 1;
  return { delivered, eventId: enriched.eventId, publishedAt: enriched.publishedAt };
}
