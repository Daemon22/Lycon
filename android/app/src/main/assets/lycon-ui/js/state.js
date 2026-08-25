/**
 * Lycon Browser — Central State
 * Single source of truth for tabs, settings, shields counters, etc.
 */
(function (global) {
  'use strict';

  const state = {
    tabs: [],            // [{ id, webview, title, url, favicon, loading, private, history, historyIdx }]
    activeId: null,
    settings: {
      theme: 'dark',
      accent: 'orange',
      searchEngine: 'duckduckgo',
      shieldsEnabled: true,
      startupPage: 'startpage',
      privateTabDefault: false,
      httpsOnly: true,
    },
    searchEngines: {},
    shieldsBlocked: 0,        // global counter for active tab display
    shieldsPerTab: new Map(), // tabId -> count
    bookmarks: [],
    history: [],
    downloads: [],
  };

  let nextId = 1;
  function genId() { return 't' + (nextId++); }

  const listeners = new Map(); // event -> Set<fn>
  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  }
  function emit(event, payload) {
    if (listeners.has(event)) {
      for (const fn of listeners.get(event)) {
        try { fn(payload); } catch (e) { console.error('[Lycon state]', event, e); }
      }
    }
  }

  // Tab operations
  function addTab(tab) {
    const t = {
      id: genId(),
      title: 'New Tab',
      url: '',
      favicon: '',
      loading: false,
      private: false,
      history: [],
      historyIdx: -1,
      ...tab,
    };
    state.tabs.push(t);
    emit('tab:added', t);
    setActive(t.id);
    return t;
  }

  function removeTab(id) {
    const idx = state.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    const [removed] = state.tabs.splice(idx, 1);
    state.shieldsPerTab.delete(id);
    emit('tab:removed', removed);
    if (state.activeId === id) {
      const next = state.tabs[idx] || state.tabs[idx - 1] || null;
      if (next) setActive(next.id);
      else emit('tabs:empty');
    }
  }

  function getTab(id) {
    return state.tabs.find(t => t.id === id);
  }
  function getActive() {
    return state.tabs.find(t => t.id === state.activeId);
  }
  function setActive(id) {
    if (state.activeId === id) return;
    state.activeId = id;
    emit('tab:active', getTab(id));
  }

  function updateTab(id, patch) {
    const t = getTab(id);
    if (!t) return;
    Object.assign(t, patch);
    emit('tab:updated', t);
  }

  function reorderTab(fromId, toId) {
    const from = state.tabs.findIndex(t => t.id === fromId);
    const to = state.tabs.findIndex(t => t.id === toId);
    if (from === -1 || to === -1 || from === to) return;
    const [moved] = state.tabs.splice(from, 1);
    state.tabs.splice(to, 0, moved);
    emit('tabs:reordered', { fromId, toId });
  }

  global.LyconState = {
    state,
    on, emit,
    addTab, removeTab, getTab, getActive, setActive, updateTab, reorderTab,
  };
})(window);
