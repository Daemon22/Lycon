/**
 * Lycon Browser — Settings modal
 * Theme, accent, search engine, shields, startup page, private-by-default.
 */
(function () {
  'use strict';

  const modalHost = document.getElementById('modal-host');
  const modalContent = document.getElementById('modal-content');

  const { state, on: _on, emit } = window.LyconState;

  async function set(patch) {
    if (window.lycon) {
      const s = await window.lycon.settings.set(patch);
      Object.assign(state.settings, s);
    } else {
      Object.assign(state.settings, patch);
    }
    applyTheme();
    emit('settings:changed', state.settings);
  }

  function applyTheme() {
    const html = document.documentElement;
    const s = state.settings;
    let effective = s.theme;
    if (s.theme === 'system') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    html.dataset.theme = effective;
    html.dataset.accent = s.accent || 'orange';
  }

  function open() {
    modalContent.innerHTML = `
      <h2>⚙ Settings</h2>

      <h3>Appearance</h3>
      <div class="modal-row">
        <div>
          <label>Theme</label>
          <div class="desc">Dark, light, or follow your system</div>
        </div>
        <div class="chip-row" id="theme-chips">
          <button class="chip" data-theme="dark">🌙 Dark</button>
          <button class="chip" data-theme="light">☀️ Light</button>
          <button class="chip" data-theme="system">💻 System</button>
        </div>
      </div>
      <div class="modal-row">
        <div>
          <label>Accent color</label>
          <div class="desc">Highlights for buttons, active tab, URL bar focus</div>
        </div>
        <div class="chip-row" id="accent-chips">
          <button class="chip" data-accent="orange"><span class="swatch" style="background:#FB542B"></span>Wolf Orange</button>
          <button class="chip" data-accent="purple"><span class="swatch" style="background:#7B2FE3"></span>Night Purple</button>
          <button class="chip" data-accent="pink"><span class="swatch" style="background:#E84393"></span>Fox Pink</button>
        </div>
      </div>

      <h3>Search</h3>
      <div class="modal-row">
        <div>
          <label>Default search engine</label>
          <div class="desc">Used when you type a query in the URL bar</div>
        </div>
        <select id="search-engine-select" class="chip" style="min-width:160px;">
          ${Object.entries(state.searchEngines).map(([k, v]) =>
            `<option value="${k}" ${state.settings.searchEngine === k ? 'selected' : ''}>${v.name}</option>`
          ).join('')}
        </select>
      </div>

      <h3>Privacy & Shields</h3>
      <div class="modal-row">
        <div>
          <label>Lycon Shields</label>
          <div class="desc">Block ads, trackers, and fingerprinting scripts</div>
        </div>
        <label class="switch" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="shields-toggle" ${state.settings.shieldsEnabled ? 'checked' : ''} />
          <span style="font-size:12px;color:var(--fg-secondary);">${state.settings.shieldsEnabled ? 'On' : 'Off'}</span>
        </label>
      </div>
      <div class="modal-row">
        <div>
          <label>Open new tabs in Private mode by default</label>
          <div class="desc">New tabs use a no-history partition (always-on private)</div>
        </div>
        <label class="switch" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="private-default-toggle" ${state.settings.privateTabDefault ? 'checked' : ''} />
          <span style="font-size:12px;color:var(--fg-secondary);">${state.settings.privateTabDefault ? 'On' : 'Off'}</span>
        </label>
      </div>
      <div class="modal-row">
        <div>
          <label>HTTPS-Only Mode</label>
          <div class="desc">Automatically upgrade insecure HTTP requests to HTTPS (localhost exempt)</div>
        </div>
        <label class="switch" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="https-only-toggle" ${state.settings.httpsOnly !== false ? 'checked' : ''} />
          <span style="font-size:12px;color:var(--fg-secondary);">${state.settings.httpsOnly !== false ? 'On' : 'Off'}</span>
        </label>
      </div>

      <h3>Startup</h3>
      <div class="modal-row">
        <div>
          <label>When Lycon opens a new tab</label>
          <div class="desc">Show the Lycon start page or open a specific URL</div>
        </div>
        <select id="startup-select" class="chip" style="min-width:160px;">
          <option value="startpage" ${state.settings.startupPage === 'startpage' ? 'selected' : ''}>Lycon Start Page</option>
          <option value="blank" ${state.settings.startupPage === 'blank' ? 'selected' : ''}>Blank Page</option>
        </select>
      </div>

      <h3>About</h3>
      <div class="modal-row">
        <div>
          <label>Lycon Browser v1.0.0</label>
          <div class="desc">A privacy-first web browser with a wolf soul.<br/>Electron ${window.lycon.versions.electron} · Chromium ${window.lycon.versions.chrome}</div>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-primary" id="settings-done">Done</button>
      </div>
    `;

    // Wire up chips
    const refreshChips = () => {
      modalContent.querySelectorAll('#theme-chips .chip').forEach(c => {
        c.classList.toggle('active', c.dataset.theme === state.settings.theme);
      });
      modalContent.querySelectorAll('#accent-chips .chip').forEach(c => {
        c.classList.toggle('active', c.dataset.accent === state.settings.accent);
      });
    };
    refreshChips();

    modalContent.querySelectorAll('#theme-chips .chip').forEach(c => {
      c.addEventListener('click', () => set({ theme: c.dataset.theme }).then(refreshChips));
    });
    modalContent.querySelectorAll('#accent-chips .chip').forEach(c => {
      c.addEventListener('click', () => set({ accent: c.dataset.accent }).then(refreshChips));
    });

    modalContent.querySelector('#search-engine-select').addEventListener('change', (e) => {
      set({ searchEngine: e.target.value });
    });
    modalContent.querySelector('#shields-toggle').addEventListener('change', (e) => {
      window.lycon.shields.toggle(e.target.checked).then(s => {
        Object.assign(state.settings, s);
        applyTheme();
        if (window.LyconShields) window.LyconShields.refresh();
      });
    });
    modalContent.querySelector('#private-default-toggle').addEventListener('change', (e) => {
      set({ privateTabDefault: e.target.checked });
    });
    modalContent.querySelector('#https-only-toggle').addEventListener('change', (e) => {
      set({ httpsOnly: e.target.checked });
    });
    modalContent.querySelector('#startup-select').addEventListener('change', (e) => {
      set({ startupPage: e.target.value });
    });
    modalContent.querySelector('#settings-done').addEventListener('click', close);

    modalHost.classList.remove('hidden');
  }

  function close() { modalHost.classList.add('hidden'); }

  modalHost.addEventListener('click', (e) => {
    if (e.target === modalHost) close();
  });

  // Listen to settings changes from other windows / IPC
  if (window.lycon && window.lycon.settings) {
    window.lycon.settings.onChanged((s) => {
      Object.assign(state.settings, s);
      applyTheme();
      emit('settings:changed', state.settings);
    });
  }

  // System theme watcher
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  applyTheme();

  window.LyconSettings = { open, close, applyTheme, set };
})();
