/**
 * Lycon Browser — History
 * Track browsing history. Stored in main process JSON.
 */
(function () {
  'use strict';

  const { state, emit } = window.LyconState;

  async function refresh() {
    if (!window.lycon) return;
    state.history = await window.lycon.history.list();
    emit('history:changed', state.history);
  }

  async function add(entry) {
    if (!window.lycon) return;
    state.history = await window.lycon.history.add(entry);
    emit('history:changed', state.history);
  }

  async function remove(id) {
    if (!window.lycon) return;
    state.history = await window.lycon.history.remove(id);
    emit('history:changed', state.history);
  }

  async function clear() {
    if (!window.lycon) return;
    state.history = await window.lycon.history.clear();
    emit('history:changed', state.history);
  }

  window.LyconHistory = { refresh, add, remove, clear };
})();
