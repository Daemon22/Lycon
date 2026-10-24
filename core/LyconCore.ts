/**
 * LyconCore — the in-memory, engine-agnostic Core (Phase 2 / Gate 7).
 *
 * The Core owns the browser object graph (Article I): identity, sessions,
 * windows, tabs, pages, navigation state, the threshold (boundary), policies,
 * and events. It is engine-agnostic — it communicates with any engine ONLY
 * through the EngineAdapter (Article II), which attaches lazily when a tab
 * becomes visible.
 *
 * Boot order (Article VI):
 *   Constitution → Identity → verify → Family → Core state → sessions →
 *   windows → tabs → surfaces → engine (lazy).
 *
 * Command/Event discipline (Article III): surfaces issue Commands; the Core
 * validates against policy, mutates, and emits immutable Events. Every Command
 * produces at least one Event (CommandRejected if it could not be honored).
 */

import { Id } from './types/00_ids';
import type {
  BrowserId, SessionId, WindowId, TabId, PageId, NavigationId,
  CommandId, IdentityVersion,
} from './types/00_ids';
import type {
  Browser, Session, Window, Tab, Page, Navigation, Threshold,
  SessionMode, TabType, PageKind, ViewType,
} from './types/01_objects';
import {
  isValidBrowserTransition,
  isValidSessionTransition,
  isValidTabTransition,
  isValidNavigationTransition,
  isValidThresholdTransition,
  isTerminalNavigationState,
  type BrowserState,
  type SessionState,
  type TabState,
  type NavigationState,
  type ThresholdState,
  type IdentityState,
} from './types/02_lifecycle';
import type {
  Command, Navigate, GoBack, GoForward, CreateTab,
  CreateSession, CreateWindow, ActivateTab, CloseTab,
  OpenBoundary, CloseBoundary, SuspendCore, ResumeCore, ShutdownCore,
  FocusSession, FocusWindow, ResizeWindow, StopNavigation, Reload,
  RegisterAgent, UnregisterAgent, AgentSuggestion,
} from './types/03_commands';
import type { CoreEvent } from './types/04_events';
import {
  CapabilityResolver,
  type Capability,
  type EffectiveCapabilities,
} from './types/05_policy';
import type {
  EngineAdapter, EngineAdapterFactory, EngineContext, EngineEvent,
  EngineNavigationStarted, EngineNavigationCompleted, EngineNavigationFailed,
  Unsubscribe,
} from './types/06_engine';
import { LYCON_IDENTITY_V1, verifyIdentity, checkDomain, type SovereignIdentity } from './03_sovereign_identity';

// ── Internal mutable state (Core-owned) ─────────────────────────────────
// Mutable working copies. Public getters return frozen, readonly snapshots
// typed as the canonical immutable interfaces.

interface GBrowser {
  id: BrowserId;
  createdAt: number;
  sessionIds: SessionId[];
  activeSessionId: SessionId | null;
  identityVersion: IdentityVersion;
}

interface GSession {
  id: SessionId;
  browserId: BrowserId;
  mode: SessionMode;
  createdAt: number;
  lastActiveAt: number;
  windowIds: WindowId[];
  activeWindowId: WindowId | null;
}

interface GWindow {
  id: WindowId;
  sessionId: SessionId;
  createdAt: number;
  title: string;
  tabIds: TabId[];
  activeTabId: TabId | null;
  width: number;
  height: number;
  x: number;
  y: number;
}

interface GTab {
  id: TabId;
  windowId: WindowId;
  sessionId: SessionId;
  createdAt: number;
  title: string;
  faviconUrl: string | null;
  type: TabType;
  pageIds: PageId[];
  activePageIndex: number;
  lifecycle: TabState;
  pendingNavigationId: NavigationId | null;
  engineAttached: boolean;
}

interface GNavigation {
  id: NavigationId;
  tabId: TabId;
  commandId: CommandId;
  targetUrl: string;
  targetKind: PageKind;
  targetView: ViewType | null;
  state: NavigationState;
  createdAt: number;
  startedAt: number | null;
  committedAt: number | null;
  completedAt: number | null;
  failedAt: number | null;
  cancelledAt: number | null;
  failureReason: string | null;
  finalUrl: string | null;
  /** -1 = new page; >=0 = history traversal target index into pageIds. */
  targetPageIndex: number;
}

interface GThreshold {
  tabId: TabId;
  state: ThresholdState;
  pendingUrl: string | null;
  openedAt: number | null;
  openSince: number | null;
}

// ── Boundary helpers ───────────────────────────────────────────────────

/** Per Article IX: agents may not act as Lycon. */
const FORBIDDEN_PARTICIPANTS = new Set(
  ['lycon', 'core', 'lycon-core', 'lycon_core', 'Lycon'].map((s) => s.toLowerCase())
);
function isForbiddenParticipant(participantId: string): boolean {
  return FORBIDDEN_PARTICIPANTS.has(participantId.toLowerCase());
}

/** Private tab sandbox attributes are stricter than normal (Article V). */
const NORMAL_SANDBOX: readonly string[] = ['allow-scripts', 'allow-same-origin', 'allow-forms'];
const PRIVATE_SANDBOX: readonly string[] = ['allow-scripts', 'allow-forms']; // no same-origin for private

/** Classify a URL into a (PageKind, ViewType) — the Core's authority, not the engine's. */
function classifyUrl(url: string): { kind: PageKind; view: ViewType | null } {
  if (url.startsWith('about:')) return { kind: 'local', view: 'start' };
  if (url.startsWith('lycos://search')) return { kind: 'search', view: 'search' };
  if (url.startsWith('lycos://history')) return { kind: 'local', view: 'history' };
  if (url.startsWith('lycos://bookmarks')) return { kind: 'local', view: 'bookmarks' };
  if (url.startsWith('lycos://downloads')) return { kind: 'local', view: 'downloads' };
  if (url.startsWith('lycos://settings')) return { kind: 'local', view: 'settings' };
  if (url.startsWith('file://')) return { kind: 'file', view: null };
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return { kind: 'online', view: 'online' };
    }
    return { kind: 'local', view: null };
  } catch {
    return { kind: 'local', view: null };
  }
}

// ── Snapshot / redacted-identity (S11) ──────────────────────────────────

export interface IdentitySummary {
  readonly version: number;
  readonly state: IdentityState;
  readonly lastRatifiedBy: string | null;
}

export interface CoreStateSnapshot {
  /** REDACTED identity (version/state/author ONLY — engine never receives the record). */
  readonly identity: IdentitySummary;
  readonly browserState: BrowserState;
  readonly sessions: readonly Session[];
  readonly windows: readonly Window[];
  readonly tabs: readonly Tab[];
  readonly navigations: readonly Navigation[];
  readonly thresholds: readonly Threshold[];
  readonly effectiveCapabilities: EffectiveCapabilities | null;
  readonly eventCount: number;
  readonly lastCausality: number;
}

export interface BootResult {
  readonly ok: boolean;
  readonly reason: string;
  readonly events: readonly CoreEvent[];
}

// ── The Core ────────────────────────────────────────────────────────────

export class LyconCore {
  // Identity (Article VI) — restored BEFORE any session.
  private identity: SovereignIdentity | null = null;
  private identityRestored = false;

  // Browser (Article I) — exactly one per Core instance.
  private browser: GBrowser | null = null;
  private browserState: BrowserState = 'boot';

  // Object graph.
  private sessions = new Map<SessionId, GSession>();
  private windows = new Map<WindowId, GWindow>();
  private tabs = new Map<TabId, GTab>();
  private readonly pageIndex = new Map<PageId, Page>();
  private navigations = new Map<NavigationId, GNavigation>();
  private thresholds = new Map<TabId, GThreshold>();

  // Engine (Article II) — the ONLY engine reference; an interface, never concrete.
  private adapter: EngineAdapter | null = null;
  private readonly engineFactory: EngineAdapterFactory | null;
  private engineUnsubscribe: Unsubscribe | null = null;

  // Event stream (Article III) — append-only history.
  private eventStream: CoreEvent[] = [];
  private causality = 0;
  private activeBuffer: CoreEvent[] | null = null;
  private listeners = new Set<(e: CoreEvent) => void>();

  /** The commandId used for identity / core lifecycle events (boot has no surface issuer). */
  private readonly bootCommandId: CommandId = Id.command();

  constructor(engineOrFactory?: EngineAdapter | EngineAdapterFactory, private readonly bootIdentity?: SovereignIdentity) {
    if (engineOrFactory && typeof engineOrFactory === 'function') {
      this.engineFactory = engineOrFactory;
    } else if (engineOrFactory && typeof engineOrFactory !== 'function') {
      this.engineFactory = null;
      this.adapter = engineOrFactory;
    } else {
      this.engineFactory = null;
    }
  }

  // ── Boot (Article VI order) ───────────────────────────────────────────

  /**
   * Boot the Core: restore identity → verify → family context → Core state.
   * The engine is NOT attached here; it attaches lazily when a tab is
   * activated (Article II, Paragraph 4). Identity restores BEFORE any session.
   */
  async boot(): Promise<BootResult> {
    const buffer: CoreEvent[] = [];
    this.activeBuffer = buffer;

    const identity = this.bootIdentity ?? LYCON_IDENTITY_V1;
    this.identity = identity;
    this.identityRestored = true; // <-- BEFORE any session (S4)

    // 1. Identity declared (restored).
    this.emit({
      ...this.base(),
      type: 'IdentityDeclared',
      identity,
      state: identity.state,
    });

    // 2. Verify identity (Article VI, Paragraph 4 — no silent path).
    const verified = verifyIdentity(identity);
    if (!verified.ok) {
      this.reject(this.bootCommandId, 'BootCore', `identity-not-verified: ${verified.reason}`);
      this.activeBuffer = null;
      return { ok: false, reason: verified.reason, events: buffer };
    }

    // 3. Family context (Article VII / Shield S9): Lycon must own the browser
    //    domain and must NOT overlap ORA's observation/sky domain.
    if (!checkDomain(identity, 'browser')) {
      this.reject(this.bootCommandId, 'BootCore', 'family-domain-violation: identity does not authorize the browser domain');
      this.activeBuffer = null;
      return { ok: false, reason: 'family-domain-violation', events: buffer };
    }

    // 4. Identity ratified (verified).
    this.emit({
      ...this.base(this.bootCommandId),
      type: 'IdentityRatified',
      identity,
      version: identity.version as IdentityVersion,
      author: identity.lastRatifiedBy ?? 'lycon-core-constitution',
    });

    // 5. Core state: boot → running.
    this.browserState = 'boot';
    this.emit({
      ...this.base(this.bootCommandId),
      type: 'CoreBooting',
      identityVersion: identity.version as IdentityVersion,
    });

    this.browserState = 'running';
    this.browser = {
      id: Id.browser(),
      createdAt: Date.now(),
      sessionIds: [],
      activeSessionId: null,
      identityVersion: identity.version as IdentityVersion,
    };
    this.emit({
      ...this.base(this.bootCommandId),
      type: 'CoreReady',
      identity,
    });

    // 6. Engine: resolve the adapter (lazy attach — do NOT attach tabs yet).
    if (!this.adapter && this.engineFactory) {
      this.adapter = await this.engineFactory();
    }
    if (this.adapter && !this.engineUnsubscribe) {
      this.engineUnsubscribe = this.adapter.subscribe((e) => this.onEngineEvent(e));
      await this.adapter.verifyContract();
    }

    this.activeBuffer = null;
    return { ok: true, reason: 'identity verified; core running', events: buffer };
  }

  // ── Command dispatch ──────────────────────────────────────────────────

  /**
   * Process a Command from a surface. Validates against policy (Article III),
   * mutates Core state, and emits Events. Returns the Events produced for this
   * Command (including any emitted synchronously by engine-signal translation).
   */
  async dispatch(cmd: Command): Promise<CoreEvent[]> {
    const buffer: CoreEvent[] = [];
    this.activeBuffer = buffer;

    // Article IX: non-impersonation (S5).
    if (isForbiddenParticipant(cmd.participantId)) {
      this.reject(cmd.commandId, cmd.type, `non-impersonation: participant "${cmd.participantId}" may not act as Lycon core`);
      this.activeBuffer = null;
      return buffer;
    }
    if (cmd.type === 'ResumeCore') {
      if (this.browserState !== 'suspended') {
        this.reject(cmd.commandId, cmd.type, `resume-not-allowed (state=${this.browserState})`);
        this.activeBuffer = null;
        return buffer;
      }
    } else if (this.browserState !== 'running') {
      this.reject(cmd.commandId, cmd.type, `core-not-running (state=${this.browserState})`);
      this.activeBuffer = null;
      return buffer;
    }
    if (!this.identity) {
      this.reject(cmd.commandId, cmd.type, 'identity-not-restored');
      this.activeBuffer = null;
      return buffer;
    }

    const from = buffer.length;
    await this.handleCommand(cmd);

    // Article III: a Command without an Event is a rumor. Guarantee ≥1 event.
    if (buffer.length === from) {
      this.reject(cmd.commandId, cmd.type, 'command produced no event');
    }

    this.activeBuffer = null;
    return buffer;
  }

  private async handleCommand(cmd: Command): Promise<void> {
    // Capture the id/type BEFORE the exhaustive switch — inside the default
    // branch the discriminated union narrows `cmd` to `never`.
    const commandId = cmd.commandId;
    const commandType = cmd.type;
    switch (cmd.type) {
      // ── Core lifecycle ──
      case 'SuspendCore': await this.suspendCore(cmd); break;
      case 'ResumeCore': await this.resumeCore(cmd); break;
      case 'ShutdownCore': await this.shutdownCore(cmd); break;

      // ── Session / window / tab ──
      case 'CreateSession': this.createSession(cmd); break;
      case 'FocusSession': this.focusSession(cmd); break;
      case 'CreateWindow': this.createWindow(cmd); break;
      case 'FocusWindow': this.focusWindow(cmd); break;
      case 'ResizeWindow': this.resizeWindow(cmd); break;
      case 'CreateTab': await this.createTab(cmd); break;
      case 'ActivateTab': await this.activateTab(cmd); break;
      case 'CloseTab': await this.closeTab(cmd); break;

      // ── Navigation ──
      case 'Navigate': await this.navigate(cmd); break;
      case 'GoBack': await this.goBack(cmd); break;
      case 'GoForward': await this.goForward(cmd); break;
      case 'StopNavigation': this.stopNavigation(cmd); break;
      case 'Reload': await this.reload(cmd); break;

      // ── Boundary ──
      case 'OpenBoundary': this.openBoundary(cmd); break;
      case 'CloseBoundary': this.closeBoundary(cmd); break;

      // ── Agents (Family registry — no rank, Article VII / Article IX) ──
      case 'RegisterAgent': this.registerAgent(cmd); break;
      case 'UnregisterAgent': this.unregisterAgent(cmd); break;
      case 'AgentSuggestion': this.agentSuggestion(cmd); break;

      // Not dispatchable through the command channel (Article VI/VII).
      case 'DestroySession':
      case 'CloseWindow':
      case 'BootCore':
      case 'AmendIdentity':
      case 'RatifyIdentity':
        this.reject(cmd.commandId, cmd.type, 'not-dispatchable-through-command-channel');
        break;
      default: {
        const _exhaustive: never = cmd;
        this.reject(commandId, commandType, 'unsupported-command');
        void _exhaustive;
      }
    }
  }

  // ── Session ───────────────────────────────────────────────────────────

  private createSession(cmd: CreateSession): void {
    const session: GSession = {
      id: Id.session(),
      browserId: this.browser!.id,
      mode: cmd.mode,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      windowIds: [],
      activeWindowId: null,
    };
    this.sessions.set(session.id, session);
    this.browser!.sessionIds.push(session.id);
    this.browser!.activeSessionId = session.id;

    // Article V: a private session is created with its privacy policy in effect
    // (persistence capabilities absent by construction, not by runtime check).
    this.emit({
      ...this.base(cmd.commandId),
      type: 'SessionCreated',
      sessionId: session.id,
      mode: session.mode,
    });
    this.emit({
      ...this.base(cmd.commandId),
      type: 'SessionStateChanged',
      sessionId: session.id,
      from: 'created',
      to: 'active',
    });
    void isValidSessionTransition; // transition integrity is exercised in lifecycle.test.ts
  }

  private focusSession(cmd: FocusSession): void {
    const session = this.sessions.get(cmd.sessionId);
    if (!session) { this.reject(cmd.commandId, cmd.type, 'no such session'); return; }
    session.lastActiveAt = Date.now();
    this.browser!.activeSessionId = session.id;
    this.emit({ ...this.base(cmd.commandId), type: 'SessionFocused', sessionId: session.id });
  }

  // ── Window ────────────────────────────────────────────────────────────

  private createWindow(cmd: CreateWindow): void {
    const session = this.sessions.get(cmd.sessionId);
    if (!session) { this.reject(cmd.commandId, cmd.type, 'no such session'); return; }
    const win: GWindow = {
      id: Id.window(),
      sessionId: session.id,
      createdAt: Date.now(),
      title: 'Lycon',
      tabIds: [],
      activeTabId: null,
      width: cmd.width,
      height: cmd.height,
      x: cmd.x ?? 0,
      y: cmd.y ?? 0,
    };
    this.windows.set(win.id, win);
    session.windowIds.push(win.id);
    session.activeWindowId = win.id;

    this.emit({
      ...this.base(cmd.commandId),
      type: 'WindowCreated',
      windowId: win.id,
      sessionId: session.id,
      width: win.width,
      height: win.height,
    });
  }

  private focusWindow(cmd: FocusWindow): void {
    const win = this.windows.get(cmd.windowId);
    if (!win) { this.reject(cmd.commandId, cmd.type, 'no such window'); return; }
    this.emit({ ...this.base(cmd.commandId), type: 'WindowFocused', windowId: win.id });
  }

  private resizeWindow(cmd: ResizeWindow): void {
    const win = this.windows.get(cmd.windowId);
    if (!win) { this.reject(cmd.commandId, cmd.type, 'no such window'); return; }
    win.width = cmd.width;
    win.height = cmd.height;
    win.x = cmd.x ?? win.x;
    win.y = cmd.y ?? win.y;
    this.emit({
      ...this.base(cmd.commandId),
      type: 'WindowResized',
      windowId: win.id,
      width: win.width,
      height: win.height,
    });
  }

  // ── Tab ───────────────────────────────────────────────────────────────

  private async createTab(cmd: CreateTab): Promise<void> {
    const win = this.windows.get(cmd.windowId);
    if (!win) { this.reject(cmd.commandId, cmd.type, 'no such window'); return; }
    const session = this.sessions.get(win.sessionId);
    if (!session) { this.reject(cmd.commandId, cmd.type, 'no such session'); return; }

    const now = Date.now();
    const tab: GTab = {
      id: Id.tab(),
      windowId: win.id,
      sessionId: session.id,
      createdAt: now,
      title: 'start',
      faviconUrl: null,
      type: cmd.typeKind,
      pageIds: [],
      activePageIndex: 0,
      lifecycle: 'dormant',
      pendingNavigationId: null,
      engineAttached: false,
    };
    this.tabs.set(tab.id, tab);
    this.thresholds.set(tab.id, this.defaultThreshold(tab.id));
    win.tabIds.push(tab.id);
    win.activeTabId = win.activeTabId ?? tab.id;

    // The tab is born on its local Start view (den-local, no engine load yet).
    const startPage: Page = {
      id: Id.page(),
      tabId: tab.id,
      url: 'about:start',
      title: 'Lycon Start',
      faviconUrl: null,
      kind: 'local',
      viewType: 'start',
      createdAt: now,
      navigationId: null,
    };
    this.pageIndex.set(startPage.id, startPage);
    tab.pageIds.push(startPage.id);

    this.emit({
      ...this.base(cmd.commandId),
      type: 'TabCreated',
      tabId: tab.id,
      windowId: win.id,
      sessionId: session.id,
      tabType: tab.type,
    });

    if (cmd.initialUrl) {
      // The Core classifies the intent (URL vs query) — never the engine or
      // the surface. A tab is born den-local; online content still requires
      // the OpenBoundary handoff before it can load.
      const { kind, view } = classifyUrl(cmd.initialUrl);
      await this.doNavigate(tab, cmd.initialUrl, kind, view, false, cmd.commandId);
    }
  }

  private async activateTab(cmd: ActivateTab): Promise<void> {
    const tab = this.tabs.get(cmd.tabId);
    if (!tab) { this.reject(cmd.commandId, cmd.type, 'no such tab'); return; }
    if (!isValidTabTransition(tab.lifecycle, 'active')) {
      this.reject(cmd.commandId, cmd.type, `invalid tab lifecycle transition: ${tab.lifecycle} → active`);
      return;
    }
    const prevLifecycle = tab.lifecycle;
    tab.lifecycle = 'active';
    this.emit({ ...this.base(cmd.commandId), type: 'TabActivated', tabId: tab.id });
    this.emit({
      ...this.base(cmd.commandId),
      type: 'TabStateChanged',
      tabId: tab.id,
      from: prevLifecycle,
      to: 'active',
    });

    // Lazy engine attach (Article II, Paragraph 4): attach only when visible.
    await this.attachEngine(tab);
  }

  private async closeTab(cmd: CloseTab): Promise<void> {
    const tab = this.tabs.get(cmd.tabId);
    if (!tab) { this.reject(cmd.commandId, cmd.type, 'no such tab'); return; }
    if (!isValidTabTransition(tab.lifecycle, 'destroyed')) {
      this.reject(cmd.commandId, cmd.type, `invalid tab lifecycle transition: ${tab.lifecycle} → destroyed`);
      return;
    }
    const prevLifecycle = tab.lifecycle;
    tab.lifecycle = 'destroyed';

    // Detach the engine (release all resources for this tab — Article II).
    if (tab.engineAttached && this.adapter) {
      await this.adapter.detach(tab.id);
      tab.engineAttached = false;
    }
    this.thresholds.delete(tab.id);
    this.navigations.forEach((n) => { if (n.tabId === tab.id) this.navigations.delete(n.id); });
    this.pageIndex.forEach((p, pageId) => {
      if (p.tabId === tab.id) this.pageIndex.delete(pageId);
    });
    this.tabs.delete(tab.id);

    const win = this.windows.get(tab.windowId);
    if (win) {
      win.tabIds = win.tabIds.filter((t) => t !== tab.id);
      if (win.activeTabId === tab.id) {
        win.activeTabId = win.tabIds[0] ?? null;
      }
    }

    this.emit({ ...this.base(cmd.commandId), type: 'TabClosed', tabId: tab.id });
    this.emit({
      ...this.base(cmd.commandId),
      type: 'TabStateChanged',
      tabId: tab.id,
      from: prevLifecycle,
      to: 'destroyed',
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────

  private async navigate(cmd: Navigate): Promise<void> {
    const tab = this.tabs.get(cmd.tabId);
    if (!tab) { this.reject(cmd.commandId, cmd.type, 'no such tab'); return; }
    const caps = this.capabilitiesFor(tab);
    if (!CapabilityResolver.checkCapability(caps, 'CanNavigate')) {
      this.reject(cmd.commandId, cmd.type, 'capability-not-present: CanNavigate');
      return;
    }
    const { kind, view } = classifyUrl(cmd.url);
    // Online resources require an open boundary (Article IV).
    if (kind === 'online' && !CapabilityResolver.checkCapability(caps, 'CanNetwork')) {
      this.reject(cmd.commandId, cmd.type, 'capability-not-present: CanNetwork (threshold sealed)');
      return;
    }
    await this.doNavigate(tab, cmd.url, kind, view, cmd.replace ?? false, cmd.commandId);
  }

  private async goBack(cmd: GoBack): Promise<void> {
    const tab = this.tabs.get(cmd.tabId);
    if (!tab) { this.reject(cmd.commandId, cmd.type, 'no such tab'); return; }
    if (tab.pageIds.length === 0 || tab.activePageIndex <= 0) {
      this.reject(cmd.commandId, cmd.type, 'no history to go back to');
      return;
    }
    const targetIndex = tab.activePageIndex - 1;
    const targetPage = this.pageIndex.get(tab.pageIds[targetIndex]);
    if (!targetPage) { this.reject(cmd.commandId, cmd.type, 'no target page'); return; }
    await this.doHistoryNav(tab, targetPage, targetIndex, 'back', cmd.commandId);
  }

  private async goForward(cmd: GoForward): Promise<void> {
    const tab = this.tabs.get(cmd.tabId);
    if (!tab) { this.reject(cmd.commandId, cmd.type, 'no such tab'); return; }
    if (tab.pageIds.length === 0 || tab.activePageIndex >= tab.pageIds.length - 1) {
      this.reject(cmd.commandId, cmd.type, 'no history to go forward to');
      return;
    }
    const targetIndex = tab.activePageIndex + 1;
    const targetPage = this.pageIndex.get(tab.pageIds[targetIndex]);
    if (!targetPage) { this.reject(cmd.commandId, cmd.type, 'no target page'); return; }
    await this.doHistoryNav(tab, targetPage, targetIndex, 'forward', cmd.commandId);
  }

  /**
   * Drive a NEW navigation: the Core owns the page record (Article I), then
   * signals the engine through the Adapter only (Article II). The engine's
   * Started/Completed signals are translated to CoreEvents by onEngineEvent.
   */
  private async doNavigate(
    tab: GTab,
    url: string,
    targetKind: PageKind,
    targetView: ViewType | null,
    replace: boolean,
    commandId: CommandId,
  ): Promise<void> {
    const nav: GNavigation = {
      id: Id.navigation(),
      tabId: tab.id,
      commandId,
      targetUrl: url,
      targetKind,
      targetView,
      state: 'requested',
      createdAt: Date.now(),
      startedAt: null,
      committedAt: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      failureReason: null,
      finalUrl: null,
      targetPageIndex: -1,
    };
    this.navigations.set(nav.id, nav);
    tab.pendingNavigationId = nav.id;

    this.emit({
      ...this.base(commandId),
      type: 'NavigationRequested',
      navigationId: nav.id,
      tabId: tab.id,
      url,
      kind: targetKind,
      view: targetView,
    });

    // The Core owns history: create/replace the Page record BEFORE driving the
    // engine, so the Committed event can reference it deterministically.
    if (replace && tab.pageIds.length > 0) {
      const oldId = tab.pageIds[tab.activePageIndex];
      this.pageIndex.delete(oldId);
      nav.targetPageIndex = tab.activePageIndex;
      tab.pageIds[tab.activePageIndex] = this.addPage(tab, nav, url, targetKind, targetView);
    } else {
      const hasStartPage = tab.pageIds.length === 1
        && this.pageIndex.get(tab.pageIds[0])?.url === 'about:start';
      if (hasStartPage) {
        const oldId = tab.pageIds[0];
        this.pageIndex.delete(oldId);
        tab.pageIds[0] = this.addPage(tab, nav, url, targetKind, targetView);
        tab.activePageIndex = 0;
      } else {
        const pageId = this.addPage(tab, nav, url, targetKind, targetView);
        tab.pageIds.push(pageId);
        tab.activePageIndex = tab.pageIds.length - 1;
      }
    }

    await this.driveEngineNavigate(tab, nav, url, replace);
  }

  /** Drive a history traversal (back/forward). The target Page already exists. */
  private async doHistoryNav(tab: GTab, targetPage: Page, targetIndex: number, direction: 'back' | 'forward', commandId: CommandId): Promise<void> {
    const nav: GNavigation = {
      id: Id.navigation(),
      tabId: tab.id,
      commandId,
      targetUrl: targetPage.url,
      targetKind: targetPage.kind,
      targetView: targetPage.viewType,
      state: 'requested',
      createdAt: Date.now(),
      startedAt: null,
      committedAt: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      failureReason: null,
      finalUrl: null,
      targetPageIndex: targetIndex,
    };
    this.navigations.set(nav.id, nav);
    tab.pendingNavigationId = nav.id;
    tab.activePageIndex = targetIndex;

    this.emit({
      ...this.base(commandId),
      type: 'NavigationRequested',
      navigationId: nav.id,
      tabId: tab.id,
      url: targetPage.url,
      kind: targetPage.kind,
      view: targetPage.viewType,
    });

    await this.driveHistoryNav(tab, nav, targetPage.url, direction);
  }

  private addPage(tab: GTab, nav: GNavigation, url: string, kind: PageKind, view: ViewType | null): PageId {
    const page: Page = {
      id: Id.page(),
      tabId: tab.id,
      url,
      title: '',
      faviconUrl: null,
      kind,
      viewType: view ?? 'start',
      createdAt: Date.now(),
      navigationId: nav.id,
    };
    this.pageIndex.set(page.id, page);
    return page.id;
  }

  private async driveEngineNavigate(tab: GTab, nav: GNavigation, url: string, _replace: boolean): Promise<void> {
    if (this.adapter && tab.engineAttached) {
      // FakeEngine emits EngineNavigationStarted/Completed synchronously, so the
      // translated CoreEvents land in the active dispatch buffer.
      await this.adapter.navigate({
        tabId: tab.id,
        url,
        replace: _replace,
        method: 'GET',
        referrerPolicy: 'no-referrer',
      });
    } else {
      // No engine attached: drive completion locally (Core is sovereign w/o engine).
      this.simulateEngineSignals(nav, url, 200);
    }
  }

  private async driveHistoryNav(tab: GTab, nav: GNavigation, url: string, direction: 'back' | 'forward'): Promise<void> {
    if (this.adapter && tab.engineAttached) {
      if (direction === 'back') {
        await this.adapter.goBack(tab.id);
      } else {
        await this.adapter.goForward(tab.id);
      }
    } else {
      this.simulateEngineSignals(nav, url, 200);
    }
  }

  private simulateEngineSignals(nav: GNavigation, url: string, statusCode: number): void {
    // Emit canonical engine-level signals (as a real adapter would) so the
    // Core translates them through the same path regardless of engine presence.
    this.onEngineStarted(nav, { type: 'EngineNavigationStarted', tabId: nav.tabId, url });
    this.onEngineCompleted(nav, { type: 'EngineNavigationCompleted', tabId: nav.tabId, url, statusCode });
  }

  private stopNavigation(cmd: StopNavigation): void {
    const nav = this.navigations.get(cmd.navigationId);
    if (!nav) { this.reject(cmd.commandId, cmd.type, 'no such navigation'); return; }
    if (isTerminalNavigationState(nav.state)) {
      this.reject(cmd.commandId, cmd.type, `cannot stop a terminal navigation (${nav.state})`);
      return;
    }
    if (!isValidNavigationTransition(nav.state, 'cancelled')) {
      this.reject(cmd.commandId, cmd.type, `invalid navigation transition: ${nav.state} → cancelled`);
      return;
    }
    const from = nav.state;
    nav.state = 'cancelled';
    nav.cancelledAt = Date.now();
    const tab = this.tabs.get(nav.tabId);
    if (tab && tab.pendingNavigationId === nav.id) tab.pendingNavigationId = null;
    this.emit({ ...this.base(cmd.commandId), type: 'NavigationCancelled', navigationId: nav.id, tabId: nav.tabId, url: nav.targetUrl });
    this.emit({ ...this.base(cmd.commandId), type: 'NavigationStateChanged', navigationId: nav.id, from, to: 'cancelled' });
  }

  private async reload(cmd: Reload): Promise<void> {
    const tab = this.tabs.get(cmd.tabId);
    if (!tab) { this.reject(cmd.commandId, cmd.type, 'no such tab'); return; }
    const page = tab.activePageIndex >= 0 ? this.pageIndex.get(tab.pageIds[tab.activePageIndex]) : undefined;
    if (!page) { this.reject(cmd.commandId, cmd.type, 'no current page'); return; }
    await this.doNavigate(tab, page.url, page.kind, page.viewType, true, cmd.commandId);
  }

  // ── Boundary (threshold) ──────────────────────────────────────────────

  private defaultThreshold(tabId: TabId): GThreshold {
    return { tabId, state: 'sealed', pendingUrl: null, openedAt: null, openSince: null };
  }

  private openBoundary(cmd: OpenBoundary): void {
    const tab = this.tabs.get(cmd.tabId);
    if (!tab) { this.reject(cmd.commandId, cmd.type, 'no such tab'); return; }
    const th = this.thresholds.get(cmd.tabId) ?? this.defaultThreshold(cmd.tabId);
    if (th.state !== 'sealed') {
      this.reject(cmd.commandId, cmd.type, `cannot open boundary from state ${th.state}`);
      return;
    }
    // sealed → opening → open (no transition skipped — Article IV)
    th.state = 'opening';
    th.pendingUrl = cmd.url;
    this.emit({ ...this.base(cmd.commandId), type: 'ThresholdOpening', tabId: tab.id, url: cmd.url });

    th.state = 'open';
    th.openedAt = Date.now();
    th.openSince = Date.now();
    // Network capabilities are granted by the open boundary (Article IV).
    this.emit({
      ...this.base(cmd.commandId),
      type: 'ThresholdOpened',
      tabId: tab.id,
      url: cmd.url,
      capabilitiesRevoked: [],
    });
    this.thresholds.set(cmd.tabId, th);
  }

  private closeBoundary(cmd: CloseBoundary): void {
    const tab = this.tabs.get(cmd.tabId);
    if (!tab) { this.reject(cmd.commandId, cmd.type, 'no such tab'); return; }
    const th = this.thresholds.get(cmd.tabId);
    if (!th || th.state !== 'open') {
      this.reject(cmd.commandId, cmd.type, 'boundary is not open');
      return;
    }
    // open → closing → sealed (closing MUST revoke external caps — Article IV)
    th.state = 'closing';
    this.emit({ ...this.base(cmd.commandId), type: 'ThresholdClosing', tabId: tab.id, reason: 'user' });

    const before = this.capsSetFor(tab, 'open');
    th.state = 'sealed';
    th.openedAt = null;
    th.openSince = null;
    th.pendingUrl = null;
    const after = this.capsSetFor(tab, 'sealed');
    const revoked = CapabilityResolver.diff(before, after).lost;
    this.emit({
      ...this.base(cmd.commandId),
      type: 'ThresholdSealed',
      tabId: tab.id,
      capabilitiesRevoked: revoked,
    });
    this.thresholds.set(cmd.tabId, th);

    // Closing the boundary revokes network: cancel any in-flight online load.
    if (tab.pendingNavigationId && !CapabilityResolver.checkCapability(this.capabilitiesFor(tab), 'CanNetwork')) {
      const nav = this.navigations.get(tab.pendingNavigationId);
      if (nav && nav.targetKind === 'online' && isValidNavigationTransition(nav.state, 'cancelled')) {
        const from = nav.state;
        nav.state = 'cancelled';
        nav.cancelledAt = Date.now();
        nav.failureReason = 'boundary-closed';
        tab.pendingNavigationId = null;
        this.emit({ ...this.base(cmd.commandId), type: 'NavigationCancelled', navigationId: nav.id, tabId: tab.id, url: nav.targetUrl });
        this.emit({ ...this.base(cmd.commandId), type: 'NavigationStateChanged', navigationId: nav.id, from, to: 'cancelled' });
      }
    }
  }

  /** Lazy engine attach — only when a tab becomes visible (Article II, §4). */
  private async attachEngine(tab: GTab): Promise<void> {
    if (!this.adapter || tab.engineAttached) return;
    const session = this.sessions.get(tab.sessionId);
    if (!session) return;
    const caps = this.capabilitiesFor(tab, session);
    if (!CapabilityResolver.checkCapability(caps, 'CanAttachEngine')) {
      return; // boundary in transition or browser not running
    }
    const th = this.thresholds.get(tab.id) ?? this.defaultThreshold(tab.id);
    const ctx: EngineContext = {
      tabId: tab.id,
      windowId: tab.windowId,
      sessionId: tab.sessionId,
      effectiveCapabilities: [...caps.capabilities] as readonly Capability[],
      thresholdState: th.state,
      initialUrl: null,
      container: null, // Shell injects the real container; null in Node tests.
      sandboxAttributes: tab.type === 'private' ? PRIVATE_SANDBOX : NORMAL_SANDBOX,
      tabType: tab.type,
      sessionMode: session.mode,
      // NOTE: the identity record is NEVER placed in the engine context.
    };
    await this.adapter.attach(ctx);
    tab.engineAttached = true;
  }

  // ── Core lifecycle commands ───────────────────────────────────────────

  private async suspendCore(cmd: SuspendCore): Promise<void> {
    if (!isValidBrowserTransition(this.browserState, 'suspending')) {
      this.reject(cmd.commandId, cmd.type, `invalid browser transition: ${this.browserState} → suspending`);
      return;
    }
    this.emit({ ...this.base(cmd.commandId), type: 'CoreSuspending', reason: cmd.reason });
    this.browserState = 'suspended';

    // Close the boundary: detach ALL engines, revoking external capabilities.
    const attached: TabId[] = [];
    this.tabs.forEach((t) => { if (t.engineAttached) attached.push(t.id); });
    for (const tabId of attached) {
      if (this.adapter) {
        await this.adapter.detach(tabId);
      }
      const t = this.tabs.get(tabId);
      if (t) t.engineAttached = false;
    }

    this.emit({ ...this.base(cmd.commandId), type: 'CoreSuspended' });
  }

  private async resumeCore(cmd: ResumeCore): Promise<void> {
    if (!isValidBrowserTransition(this.browserState, 'resuming')) {
      this.reject(cmd.commandId, cmd.type, `invalid browser transition: ${this.browserState} → resuming`);
      return;
    }
    this.emit({ ...this.base(cmd.commandId), type: 'CoreResuming' });
    this.browserState = 'running';
    this.emit({
      ...this.base(cmd.commandId),
      type: 'CoreReady',
      identity: this.identity!,
    });
  }

  private async shutdownCore(cmd: ShutdownCore): Promise<void> {
    if (!isValidBrowserTransition(this.browserState, 'shutdown')) {
      this.reject(cmd.commandId, cmd.type, `invalid browser transition: ${this.browserState} → shutdown`);
      return;
    }
    const attached: TabId[] = [];
    this.tabs.forEach((t) => { if (t.engineAttached) attached.push(t.id); });
    for (const tabId of attached) {
      if (this.adapter) { await this.adapter.detach(tabId); }
      const t = this.tabs.get(tabId);
      if (t) t.engineAttached = false;
    }
    this.emit({ ...this.base(cmd.commandId), type: 'CoreShutdown' });
  }

  // ── Identity / agent commands ─────────────────────────────────────────

  private registerAgent(cmd: RegisterAgent): void {
    // Article VII (no rank) + Article IX + Shield S9 (checkDomain guards
    // territory before any cross-domain action).
    if (!checkDomain(this.identity!, cmd.domain)) {
      this.reject(cmd.commandId, cmd.type, `checkDomain: agent "${cmd.agentName}" cannot operate in domain "${cmd.domain}"`);
      return;
    }
    this.emit({
      ...this.base(cmd.commandId),
      type: 'AgentRegistered',
      agentName: cmd.agentName,
      domain: cmd.domain,
    });
  }

  private unregisterAgent(cmd: UnregisterAgent): void {
    this.emit({
      ...this.base(cmd.commandId),
      type: 'AgentUnregistered',
      agentName: cmd.agentName,
    });
  }

  private agentSuggestion(cmd: AgentSuggestion): void {
    // Per Article IX: an agent SPEAKS AS ITSELF and proposes; it never bypasses
    // the Core. Suggestions are not commands — the Core records a rejection so
    // the surface can re-issue an attributed Command if it chooses to honor it.
    this.emit({
      ...this.base(cmd.commandId),
      type: 'CommandRejected',
      rejectedCommand: { type: cmd.suggestedAction.type, commandId: cmd.suggestedAction.commandId },
      reason: 'agent-suggestion-requires-surface-re-issue',
    });
  }

  // ── Engine signal translation (Article II) ────────────────────────────

  private onEngineEvent(event: EngineEvent): void {
    switch (event.type) {
      case 'EngineNavigationStarted':
        this.onEngineStarted(this.findPendingNavigation(event.tabId), event);
        break;
      case 'EngineNavigationCompleted':
        this.onEngineCompleted(this.findPendingNavigation(event.tabId), event);
        break;
      case 'EngineNavigationFailed':
        this.onEngineFailed(this.findPendingNavigation(event.tabId), event);
        break;
      default:
        break;
    }
  }

  private onEngineStarted(nav: GNavigation | undefined, event: EngineNavigationStarted): void {
    if (!nav) return;
    if (isValidNavigationTransition(nav.state, 'started')) {
      nav.state = 'started';
      nav.startedAt = Date.now();
    }
    this.emit({
      ...this.base(nav.commandId),
      type: 'NavigationStarted',
      navigationId: nav.id,
      tabId: nav.tabId,
      engineUrl: event.url,
    });
  }

  private onEngineCompleted(nav: GNavigation | undefined, event: EngineNavigationCompleted): void {
    if (!nav) return;
    // requested/started → committed → loading → completed (no skipped state).
    if (isValidNavigationTransition(nav.state, 'committed')) { nav.state = 'committed'; nav.committedAt = Date.now(); }
    if (isValidNavigationTransition(nav.state, 'loading')) { nav.state = 'loading'; }

    const tab = this.tabs.get(nav.tabId);
    const pageId = tab ? (tab.pageIds[tab.activePageIndex] ?? ('' as PageId)) : ('' as PageId);

    this.emit({ ...this.base(nav.commandId), type: 'NavigationCommitted', navigationId: nav.id, tabId: nav.tabId, pageId });
    this.emit({ ...this.base(nav.commandId), type: 'NavigationLoading', navigationId: nav.id, tabId: nav.tabId, progress: 100 });

    if (isValidNavigationTransition(nav.state, 'completed')) {
      nav.state = 'completed';
      nav.completedAt = Date.now();
      nav.finalUrl = event.url;
    }
    if (tab && tab.pendingNavigationId === nav.id) tab.pendingNavigationId = null;

    this.emit({
      ...this.base(nav.commandId),
      type: 'NavigationCompleted',
      navigationId: nav.id,
      tabId: nav.tabId,
      finalUrl: nav.finalUrl ?? event.url,
      statusCode: event.statusCode,
    });
  }

  private onEngineFailed(nav: GNavigation | undefined, event: EngineNavigationFailed): void {
    if (!nav) return;
    if (isValidNavigationTransition(nav.state, 'failed')) {
      nav.state = 'failed';
      nav.failedAt = Date.now();
      nav.failureReason = event.errorMessage;
    }
    const tab = this.tabs.get(nav.tabId);
    if (tab && tab.pendingNavigationId === nav.id) tab.pendingNavigationId = null;
    this.emit({
      ...this.base(nav.commandId),
      type: 'NavigationFailed',
      navigationId: nav.id,
      tabId: nav.tabId,
      url: event.url,
      errorCode: event.errorCode,
      errorMessage: event.errorMessage,
    });
    this.emit({ ...this.base(nav.commandId), type: 'NavigationStateChanged', navigationId: nav.id, from: 'started', to: 'failed' });
  }

  private findPendingNavigation(tabId: TabId): GNavigation | undefined {
    for (const nav of this.navigations.values()) {
      if (nav.tabId === tabId && !isTerminalNavigationState(nav.state)) {
        return nav;
      }
    }
    return undefined;
  }

  // ── Capability / context ──────────────────────────────────────────────

  private capabilitiesFor(tab: GTab | undefined, session?: GSession): EffectiveCapabilities {
    const sess = session ?? (tab ? this.sessions.get(tab.sessionId) : undefined);
    const th = tab ? (this.thresholds.get(tab.id) ?? this.defaultThreshold(tab.id)) : this.defaultThreshold('' as TabId);
    const tabType = tab ? tab.type : 'normal';
    const tabId: TabId | null = tab ? tab.id : null;
    const sessionId: SessionId = sess ? sess.id : ('' as SessionId);
    return CapabilityResolver.resolve({
      identity: this.identity!,
      sessionMode: sess ? sess.mode : 'persistent',
      thresholdState: th.state,
      tabType,
      browserState: this.browserState,
      sessionId,
      tabId,
      navigationState: tab ? (tab.pendingNavigationId ? ('loading' as NavigationState) : undefined) : undefined,
    });
  }

  private capsSetFor(tab: GTab, thresholdState: ThresholdState): Set<Capability> {
    const session = this.sessions.get(tab.sessionId);
    return new Set(
      CapabilityResolver.resolve({
        identity: this.identity!,
        sessionMode: session!.mode,
        thresholdState,
        tabType: tab.type,
        browserState: this.browserState,
        sessionId: tab.sessionId,
        tabId: tab.id,
      }).capabilities
    );
  }

  private base(commandId: CommandId = this.bootCommandId) {
    return {
      eventId: Id.event(),
      commandId,
      causality: this.causality++,
      timestamp: Date.now(),
      participantId: 'core',
    };
  }

  private emit(event: CoreEvent): void {
    const frozen = Object.freeze(event) as CoreEvent;
    this.eventStream.push(frozen);
    if (this.activeBuffer) this.activeBuffer.push(frozen);
    for (const l of [...this.listeners]) l(frozen);
  }

  private reject(commandId: CommandId, commandType: string, reason: string): void {
    this.emit({
      ...this.base(commandId),
      type: 'CommandRejected',
      rejectedCommand: { type: commandType, commandId },
      reason,
    });
  }

  // ── Public read API ───────────────────────────────────────────────────

  subscribe(listener: (e: CoreEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getEvents(): readonly CoreEvent[] {
    return [...this.eventStream];
  }

  getIdentityRestored(): boolean {
    return this.identityRestored;
  }

  getIdentity(): SovereignIdentity | null {
    return this.identity;
  }

  getBrowserState(): BrowserState {
    return this.browserState;
  }

  getBrowser(): Browser | null {
    if (!this.browser) return null;
    return Object.freeze({
      id: this.browser.id,
      createdAt: this.browser.createdAt,
      sessionIds: Object.freeze([...this.browser.sessionIds]),
      activeSessionId: this.browser.activeSessionId,
      identityVersion: this.browser.identityVersion,
    });
  }

  getSessions(): readonly Session[] {
    return [...this.sessions.values()].map((s) => Object.freeze({
      id: s.id, browserId: s.browserId, mode: s.mode, createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      windowIds: Object.freeze([...s.windowIds]),
      activeWindowId: s.activeWindowId,
    }));
  }

  getSession(sessionId: SessionId): Session | undefined {
    const s = this.sessions.get(sessionId);
    if (!s) return undefined;
    return Object.freeze({
      id: s.id, browserId: s.browserId, mode: s.mode, createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      windowIds: Object.freeze([...s.windowIds]),
      activeWindowId: s.activeWindowId,
    });
  }

  getWindows(): readonly Window[] {
    return [...this.windows.values()].map((w) => Object.freeze({
      id: w.id, sessionId: w.sessionId, createdAt: w.createdAt, title: w.title,
      tabIds: Object.freeze([...w.tabIds]), activeTabId: w.activeTabId,
      width: w.width, height: w.height, x: w.x, y: w.y,
    }));
  }

  getTabs(): readonly Tab[] {
    return [...this.tabs.values()].map((t) => Object.freeze({
      id: t.id, windowId: t.windowId, sessionId: t.sessionId, createdAt: t.createdAt,
      title: t.title, faviconUrl: t.faviconUrl, type: t.type,
      pageIds: Object.freeze([...t.pageIds]),
      activePageIndex: t.activePageIndex, lifecycle: t.lifecycle,
      pendingNavigationId: t.pendingNavigationId,
    }));
  }

  getTab(tabId: TabId): Tab | undefined {
    const t = this.tabs.get(tabId);
    if (!t) return undefined;
    return Object.freeze({
      id: t.id, windowId: t.windowId, sessionId: t.sessionId, createdAt: t.createdAt,
      title: t.title, faviconUrl: t.faviconUrl, type: t.type,
      pageIds: Object.freeze([...t.pageIds]), activePageIndex: t.activePageIndex,
      lifecycle: t.lifecycle, pendingNavigationId: t.pendingNavigationId,
    });
  }

  getNavigation(navigationId: NavigationId): Navigation | undefined {
    const n = this.navigations.get(navigationId);
    if (!n) return undefined;
    return Object.freeze({
      id: n.id, tabId: n.tabId, commandId: n.commandId, targetUrl: n.targetUrl,
      targetKind: n.targetKind, targetView: n.targetView, state: n.state,
      createdAt: n.createdAt, startedAt: n.startedAt, committedAt: n.committedAt,
      completedAt: n.completedAt, failedAt: n.failedAt, cancelledAt: n.cancelledAt,
      failureReason: n.failureReason, finalUrl: n.finalUrl,
    });
  }

  getThreshold(tabId: TabId): Threshold | undefined {
    const t = this.thresholds.get(tabId);
    if (!t) return undefined;
    return Object.freeze({ tabId: t.tabId, state: t.state, pendingUrl: t.pendingUrl, openedAt: t.openedAt, openSince: t.openSince });
  }

  /** Effective capabilities for a session/tab (Article V / Shield). */
  getCapabilities(sessionId: SessionId, tabId?: TabId): EffectiveCapabilities {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`no such session: ${String(sessionId)}`);
    if (tabId) {
      const tab = this.tabs.get(tabId);
      if (!tab) throw new Error(`no such tab: ${String(tabId)}`);
      return this.capabilitiesFor(tab, session);
    }
    return CapabilityResolver.resolve({
      identity: this.identity!,
      sessionMode: session.mode,
      thresholdState: 'sealed',
      tabType: 'normal',
      browserState: this.browserState,
      sessionId,
      tabId: null,
    });
  }

  /**
   * S11 — Self-Knowledge: the engine-context view for a tab contains NO
   * identity record. Only effective capabilities, threshold state, and sandbox
   * configuration are exposed to the engine adapter.
   */
  getEngineContext(tabId: TabId): EngineContext | null {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;
    const session = this.sessions.get(tab.sessionId);
    if (!session) return null;
    const caps = this.capabilitiesFor(tab, session);
    const th = this.thresholds.get(tab.id) ?? this.defaultThreshold(tab.id);
    return {
      tabId: tab.id,
      windowId: tab.windowId,
      sessionId: tab.sessionId,
      effectiveCapabilities: [...caps.capabilities] as readonly Capability[],
      thresholdState: th.state,
      initialUrl: null,
      container: null,
      sandboxAttributes: tab.type === 'private' ? PRIVATE_SANDBOX : NORMAL_SANDBOX,
      tabType: tab.type,
      sessionMode: session.mode,
    };
  }

  /**
   * S11 — Self-Knowledge: a redacted state snapshot. The identity record
   * (charter, capabilities, family) is NOT exposed; only version/state/author.
   */
  getStateSnapshot(): CoreStateSnapshot {
    const firstSession = [...this.sessions.values()][0];
    let effective: EffectiveCapabilities | null = null;
    if (firstSession) {
      const firstTab = [...this.tabs.values()].find((t) => t.sessionId === firstSession.id);
      if (firstTab) effective = this.capabilitiesFor(firstTab, firstSession);
    }
    return {
      identity: {
        version: this.identity!.version,
        state: this.identity!.state as IdentityState,
        lastRatifiedBy: this.identity!.lastRatifiedBy,
      },
      browserState: this.browserState,
      sessions: this.getSessions(),
      windows: this.getWindows(),
      tabs: this.getTabs(),
      navigations: [...this.navigations.values()].map((n) => Object.freeze({
        id: n.id, tabId: n.tabId, commandId: n.commandId, targetUrl: n.targetUrl,
        targetKind: n.targetKind, targetView: n.targetView, state: n.state,
        createdAt: n.createdAt, startedAt: n.startedAt, committedAt: n.committedAt,
        completedAt: n.completedAt, failedAt: n.failedAt, cancelledAt: n.cancelledAt,
        failureReason: n.failureReason, finalUrl: n.finalUrl,
      })),
      thresholds: [...this.thresholds.values()].map((t) => Object.freeze({
        tabId: t.tabId, state: t.state, pendingUrl: t.pendingUrl, openedAt: t.openedAt, openSince: t.openSince,
      })),
      effectiveCapabilities: effective,
      eventCount: this.eventStream.length,
      lastCausality: this.causality,
    };
  }

  getLastCausality(): number {
    return this.causality;
  }

  /** Full event types emitted so far (for causal-integrity assertions). */
  getEventTypes(): readonly string[] {
    return this.eventStream.map((e) => e.type);
  }

  // ── Shutdown ─────────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    this.browserState = 'shutdown';
    if (this.engineUnsubscribe) {
      this.engineUnsubscribe();
      this.engineUnsubscribe = null;
    }
    this.adapter = null;
    this.identity = null;
  }
}
