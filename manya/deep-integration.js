/**
 * @manya/lycon — Deep integration layer.
 *
 * Three features that wire Lycon deeper into the Manya ecosystem:
 *
 * 1. **Shield Intelligence** — Lycon's ad/tracker blocker can query Manya's
 *    cybersecurity tool for additional threat intelligence. When Shields
 *    blocks a URL, it's also checked against the cybersecurity tool's IOC
 *    database. Matches are recorded as IOCs and the threat is classified.
 *
 * 2. **Federated Identity Panel** — A browser toolbar panel that shows the
 *    current browser profile's linked Manya federated identity, with a
 *    quick-link form to connect a new identity.
 *
 * 3. **Private Mode with Temporary Identity** — `manya browse --private`
 *    auto-creates a temporary federated identity for the private session,
 *    so even private browsing is identity-aware without persisting.
 */

import { randomUUID, createHash } from 'node:crypto';

// ============================================================================
// 1. SHIELD INTELLIGENCE — bridge between Lycon Shields and Manya Cybersecurity
// ============================================================================

/**
 * Creates a shield intelligence bridge that checks blocked URLs against
 * Manya's cybersecurity IOC database.
 *
 * @param {object} options
 * @param {object} options.adapter - The Manya-Lycon adapter (from createAdapter()).
 * @param {object} [options.cybersecurityApi] - The cybersecurity tool's API (threats module).
 * @param {object} [options.iocStore] - A Map to store IOCs created from shield blocks (defaults to a new Map).
 * @returns {ShieldIntelligenceBridge}
 */
export function createShieldIntelligence({ adapter, cybersecurityApi, iocStore }) {
  if (!adapter) throw new Error('createShieldIntelligence requires an adapter');
  const store = iocStore || new Map(); // iocHash -> ioc
  let totalChecked = 0;
  let totalMatches = 0;

  return {
    /**
     * Checks a blocked URL against the cybersecurity IOC database.
     * If a match is found, the threat is classified and an IOC is recorded.
     * @param {object} input
     * @param {string} input.url - The blocked URL.
     * @param {string} [input.tabId] - The tab where the block occurred.
     * @param {string} [input.filter] - The filter that triggered the block (e.g. 'easylist').
     * @returns {{ checked: boolean, matched: boolean, ioc: object|null, threat: object|null }}
     */
    checkBlockedUrl({ url, _tabId, filter }) {
      if (!url) throw new Error('checkBlockedUrl requires a url');
      totalChecked++;

      // Extract domain and IP from the URL for IOC matching
      const parsed = parseUrl(url);
      if (!parsed) return { checked: true, matched: false, ioc: null, threat: null };

      // Try to find an existing IOC matching the URL, domain, or IP
      const candidates = [];
      if (parsed.url) candidates.push({ type: 'url', value: parsed.url });
      if (parsed.domain) candidates.push({ type: 'domain', value: parsed.domain });
      if (parsed.ip) candidates.push({ type: 'ip', value: parsed.ip });

      for (const candidate of candidates) {
        const hash = iocHash(candidate.type, candidate.value);
        if (store.has(hash)) {
          totalMatches++;
          const ioc = store.get(hash);
          return { checked: true, matched: true, ioc, threat: ioc.threat || null };
        }
      }

      // No existing IOC — optionally create one if the URL looks malicious
      const looksMalicious = isLikelyMalicious(url, parsed);
      if (looksMalicious && cybersecurityApi) {
        try {
          const ioc = cybersecurityApi.createIOC({
            type: 'domain',
            value: parsed.domain || parsed.url,
            source: 'lycon-shields',
            description: `Auto-detected by Lycon Shields (filter: ${filter || 'unknown'})`,
            tags: ['ad-tracker', 'auto-detected', filter || 'unknown'],
            confidence: 'medium',
          });
          let threat = null;
          if (cybersecurityApi.classifyThreat) {
            try {
              threat = cybersecurityApi.classifyThreat({
                name: `Malicious domain: ${parsed.domain || url}`,
                cvssScore: 5.0,
                tactics: ['initial-access'],
              });
            } catch {
              // classifyThreat optional — skip if it fails
            }
          }
          ioc.threat = threat;
          const hash = iocHash(ioc.type, ioc.value);
          store.set(hash, ioc);
          totalMatches++;
          return { checked: true, matched: true, ioc, threat };
        } catch {
          // If IOC creation fails (e.g. invalid type), just record the block
        }
      }

      return { checked: true, matched: false, ioc: null, threat: null };
    },

    /**
     * Registers an existing IOC (e.g. from the cybersecurity tool) so that
     * future shield blocks matching it will be reported as matches.
     * @param {object} ioc - The IOC to register.
     */
    registerIOC(ioc) {
      if (!ioc || !ioc.type || !ioc.value) throw new Error('registerIOC requires ioc.type and ioc.value');
      const hash = iocHash(ioc.type, ioc.value);
      store.set(hash, ioc);
    },

    /**
     * Returns all IOCs registered via shield intelligence.
     * @returns {object[]}
     */
    listIOCs() {
      return Array.from(store.values());
    },

    /**
     * Returns shield intelligence statistics.
     * @returns {{ totalChecked: number, totalMatches: number, matchRate: number, iocCount: number }}
     */
    stats() {
      return {
        totalChecked,
        totalMatches,
        matchRate: totalChecked > 0 ? totalMatches / totalChecked : 0,
        iocCount: store.size,
      };
    },

    /**
     * Processes a shield-blocked event end-to-end: forwards it to the bus
     * AND checks it against the IOC database.
     * @param {object} event - The shield-blocked event.
     * @returns {{ forwarded: object, intelligence: object }}
     */
    processShieldBlock(event) {
      const forwarded = adapter.forward('lycon:shield-blocked', event);
      const intelligence = this.checkBlockedUrl({
        url: event.url,
        tabId: event.tabId,
        filter: event.filter,
      });
      return { forwarded, intelligence };
    },
  };
}

// ============================================================================
// 2. FEDERATED IDENTITY PANEL — toolbar panel state
// ============================================================================

/**
 * Creates a federated identity panel controller that manages the browser
 * toolbar panel showing the current profile's linked identity.
 *
 * @param {object} options
 * @param {object} options.adapter - The Manya-Lycon adapter.
 * @param {string} [options.defaultProfileId='default'] - The default browser profile id.
 * @returns {IdentityPanelController}
 */
export function createIdentityPanel({ adapter, defaultProfileId = 'default' }) {
  if (!adapter) throw new Error('createIdentityPanel requires an adapter');

  let currentProfileId = defaultProfileId;
  const listeners = new Set();

  function notify(event) {
    for (const fn of listeners) {
      try { fn(event); } catch { /* swallow */ }
    }
  }

  return {
    /**
     * Returns the current profile id.
     * @returns {string}
     */
    getCurrentProfile() {
      return currentProfileId;
    },

    /**
     * Switches to a different browser profile.
     * @param {string} profileId
     */
    switchProfile(profileId) {
      if (!profileId) throw new Error('switchProfile requires a profileId');
      const old = currentProfileId;
      currentProfileId = profileId;
      notify({ type: 'profile-switched', from: old, to: profileId });
    },

    /**
     * Returns the federated identity linked to the current profile (if any).
     * @returns {{ linked: boolean, identityId: string|null }}
     */
    getCurrentIdentity() {
      const identityId = adapter.resolveIdentity(currentProfileId);
      return { linked: !!identityId, identityId };
    },

    /**
     * Links the current profile to a federated identity.
     * @param {string} identityId
     * @returns {{ linked: boolean, profileId: string, identityId: string }}
     */
    linkCurrent(identityId) {
      if (!identityId) throw new Error('linkCurrent requires an identityId');
      const result = adapter.linkIdentity(currentProfileId, identityId);
      notify({ type: 'identity-linked', profileId: currentProfileId, identityId });
      return result;
    },

    /**
     * Unlinks the current profile from its federated identity.
     * @returns {boolean}
     */
    unlinkCurrent() {
      const result = adapter.unlinkIdentity(currentProfileId);
      if (result) {
        notify({ type: 'identity-unlinked', profileId: currentProfileId });
      }
      return result;
    },

    /**
     * Lists all browser profiles known to have linked identities.
     * @returns {Array<{ browserProfileId: string, identityId: string }>}
     */
    listLinkedProfiles() {
      return adapter.listLinks();
    },

    /**
     * Subscribes to panel events.
     * @param {function} cb
     * @returns {function} Unsubscribe function.
     */
    on(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    /**
     * Returns the panel state for rendering.
     * @returns {{ profileId: string, linked: boolean, identityId: string|null, linkedProfiles: Array }}
     */
    getPanelState() {
      const current = this.getCurrentIdentity();
      return {
        profileId: currentProfileId,
        linked: current.linked,
        identityId: current.identityId,
        linkedProfiles: this.listLinkedProfiles(),
      };
    },
  };
}

// ============================================================================
// 3. PRIVATE MODE WITH TEMPORARY IDENTITY
// ============================================================================

/**
 * Creates a private browsing session with a temporary federated identity.
 * The identity is created on-demand and linked to a temporary browser profile.
 * When the session ends, the temporary profile and identity link are cleaned up.
 *
 * @param {object} options
 * @param {object} options.adapter - The Manya-Lycon adapter.
 * @param {object} [options.unify] - The Manya Unify module (for createIdentity).
 * @param {string} [options.profilePrefix='private-'] - Prefix for temporary profile ids.
 * @returns {PrivateSessionFactory} A factory that creates private sessions.
 */
export function createPrivateSessionFactory({ adapter, unify, profilePrefix = 'private-' }) {
  if (!adapter) throw new Error('createPrivateSessionFactory requires an adapter');
  const activeSessions = new Map(); // sessionId -> { profileId, identityId, createdAt }

  return {
    /**
     * Creates a new private browsing session with a temporary identity.
     * @param {object} [options]
     * @param {string} [options.metadata] - Optional metadata for the temporary identity.
     * @returns {{ sessionId: string, profileId: string, identityId: string, createdAt: string }}
     */
    createSession(options = {}) {
      const sessionId = `private-${randomUUID().slice(0, 8)}`;
      const profileId = `${profilePrefix}${randomUUID().slice(0, 8)}`;
      const createdAt = new Date().toISOString();

      // Create a temporary federated identity if unify is available
      let identityId = null;
      if (unify && typeof unify.createIdentity === 'function') {
        const identity = unify.createIdentity({
          type: 'session',
          value: sessionId,
          metadata: {
            ...options.metadata,
            private: true,
            temporary: true,
            createdAt,
          },
        });
        identityId = identity.id;
      } else {
        // Fallback: generate a synthetic identity id
        identityId = `temp-id-${randomUUID().slice(0, 12)}`;
      }

      // Link the temporary profile to the temporary identity
      adapter.linkIdentity(profileId, identityId);

      const session = { sessionId, profileId, identityId, createdAt };
      activeSessions.set(sessionId, session);
      return session;
    },

    /**
     * Ends a private session — unlinks the profile and removes the session.
     * @param {string} sessionId
     * @returns {{ ended: boolean, session: object|null }}
     */
    endSession(sessionId) {
      const session = activeSessions.get(sessionId);
      if (!session) return { ended: false, session: null };
      adapter.unlinkIdentity(session.profileId);
      activeSessions.delete(sessionId);
      return { ended: true, session };
    },

    /**
     * Returns the active private session.
     * @param {string} sessionId
     * @returns {object|null}
     */
    getSession(sessionId) {
      return activeSessions.get(sessionId) || null;
    },

    /**
     * Lists all active private sessions.
     * @returns {Array<{ sessionId: string, profileId: string, identityId: string, createdAt: string }>}
     */
    listSessions() {
      return Array.from(activeSessions.values());
    },

    /**
     * Ends all active private sessions (e.g. when the browser closes).
     * @returns {number} The number of sessions ended.
     */
    endAllSessions() {
      const count = activeSessions.size;
      for (const session of activeSessions.values()) {
        adapter.unlinkIdentity(session.profileId);
      }
      activeSessions.clear();
      return count;
    },

    /**
     * Returns the count of active private sessions.
     * @returns {number}
     */
    activeCount() {
      return activeSessions.size;
    },
  };
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Parses a URL into its components for IOC matching.
 * @param {string} url
 * @returns {{ url: string, domain: string|null, ip: string|null }|null}
 */
function parseUrl(url) {
  try {
    const u = new URL(url);
    const hostname = u.hostname;
    // Check if hostname is an IP address
    const ipMatch = hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);
    return {
      url: u.href,
      domain: ipMatch ? null : hostname,
      ip: ipMatch ? hostname : null,
    };
  } catch {
    // Not a valid URL — try treating it as a domain
    if (typeof url === 'string' && url.includes('.')) {
      return { url, domain: url, ip: null };
    }
    return null;
  }
}

/**
 * Heuristic: determines if a blocked URL is likely malicious (not just an ad/tracker).
 * Used to decide whether to auto-create an IOC.
 * @param {string} url
 * @param {object} parsed - The parsed URL components.
 * @returns {boolean}
 */
function isLikelyMalicious(url, parsed) {
  if (!parsed || !parsed.domain) return false;
  const domain = parsed.domain.toLowerCase();
  // Known malicious patterns
  const maliciousPatterns = [
    /\.tk$/i, /\.ml$/i, /\.ga$/i, /\.cf$/i, /\.gq$/i,  // free TLDs often abused
    /phishing/i, /malware/i, /exploit/i, /hack/i,
    /(secure|login|signin|account|verify|update)\.[^.]+\.(tk|ml|ga|cf|gq)$/i,
  ];
  for (const pattern of maliciousPatterns) {
    if (pattern.test(domain)) return true;
  }
  // Suspicious: domain has many digits (often auto-generated)
  if (/\d{5,}/.test(domain)) return true;
  return false;
}

/**
 * Computes a hash key for an IOC.
 * @param {string} type
 * @param {string} value
 * @returns {string}
 */
function iocHash(type, value) {
  return createHash('sha256').update(`${type}:${value}`).digest('hex').slice(0, 16);
}
