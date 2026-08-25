/**
 * Lycon Browser — Optional intelligence surface
 *
 * This module is deliberately complete when no connector exists. It never
 * starts background work; every request begins with an explicit user action
 * and an on-screen context confirmation.
 */
(function () {
  'use strict';

  const panel = document.getElementById('agent-panel');
  const panelBody = document.getElementById('agent-panel-body');
  const modalHost = document.getElementById('modal-host');
  const modalContent = document.getElementById('modal-content');
  const { state, on, getActive } = window.LyconState;
  const ui = { connectorId: '', scope: 'selection', prompt: '', answer: '', status: '', busy: false };

  const scopeInfo = {
    none: { label: 'Prompt only', detail: 'Nothing from the page is shared.' },
    selection: { label: 'Selected text', detail: 'Only text you selected on the active page.' },
    page: { label: 'Current page', detail: 'The page title, URL, and readable text.' },
    localFile: { label: 'Local file', detail: 'Readable content from an explicitly opened local page.' },
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  }

  function connectorById(id) { return state.connectors.find((c) => c.id === id) || null; }

  function ensureConnector() {
    if (!state.connectors.length) return;
    if (!connectorById(ui.connectorId)) ui.connectorId = state.settings.agentDefaultConnectorId || state.connectors[0].id;
  }

  async function refresh() {
    if (!window.lycon || !window.lycon.agents) return;
    try {
      state.connectors = await window.lycon.agents.list();
      state.agentAudit = await window.lycon.agents.audit();
      ensureConnector();
      render();
    } catch (error) {
      ui.status = `Could not load intelligence connections: ${error.message}`;
      render();
    }
  }

  function open() {
    panel.classList.remove('hidden');
    ensureConnector();
    render();
  }

  function close() { panel.classList.add('hidden'); }

  function renderNoConnector() {
    panelBody.innerHTML = `
      <div class="agent-empty">
        <div class="agent-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0-6 6v2a6 6 0 0 0 12 0V9a6 6 0 0 0-6-6Z"/><path d="M3 11a9 9 0 0 0 18 0M12 20v1M8 21h8"/></svg></div>
        <h3>Connect intelligence when you choose</h3>
        <p>Lycon is fully usable without an agent. Add a local model, self-hosted endpoint, cloud provider, or another compatible service only when you want one.</p>
        <button class="btn btn-primary" id="agent-connect-first">Add an optional connection</button>
        <div class="agent-principles">
          <div><strong>Explicit context</strong><span>Choose prompt-only, selection, page, or local-file context.</span></div>
          <div><strong>Visible destination</strong><span>See where a request will go before it leaves this device.</span></div>
          <div><strong>No background agent</strong><span>Lycon never starts an intelligence request on its own.</span></div>
        </div>
      </div>
    `;
    document.getElementById('agent-connect-first').addEventListener('click', openManager);
  }

  function renderConnected() {
    ensureConnector();
    const connector = connectorById(ui.connectorId);
    const safeConnector = connector || state.connectors[0];
    const scope = scopeInfo[ui.scope] || scopeInfo.selection;
    panelBody.innerHTML = `
      <div class="agent-panel-intro">
        <span class="agent-status-dot" aria-hidden="true"></span>
        <div><strong>Optional intelligence</strong><span>Nothing is sent until you confirm a request.</span></div>
      </div>
      <label class="field-label" for="agent-connector">Connection</label>
      <div class="agent-select-row">
        <select id="agent-connector" class="chip" aria-label="Choose intelligence connection">
          ${state.connectors.map((item) => `<option value="${esc(item.id)}" ${item.id === safeConnector.id ? 'selected' : ''}>${esc(item.name)} · ${esc(item.location)}</option>`).join('')}
        </select>
        <button class="btn btn-subtle" id="agent-manage">Manage</button>
      </div>
      <div class="agent-destination"><span>Destination</span><strong>${esc(safeConnector.endpoint)}</strong><small>${esc(safeConnector.model || 'Provider decides the model')}</small></div>
      <label class="field-label">Context to share</label>
      <div class="agent-scope-grid" role="radiogroup" aria-label="Context scope">
        ${Object.entries(scopeInfo).map(([key, value]) => `<button type="button" class="agent-scope ${key === ui.scope ? 'active' : ''}" data-scope="${key}" role="radio" aria-checked="${key === ui.scope}"><strong>${esc(value.label)}</strong><span>${esc(value.detail)}</span></button>`).join('')}
      </div>
      <label class="field-label" for="agent-prompt">What should Lycon ask?</label>
      <textarea id="agent-prompt" class="agent-prompt" rows="5" placeholder="Summarize, explain, compare, or help me inspect this page…">${esc(ui.prompt)}</textarea>
      <div class="agent-preview"><span class="preview-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H10l2 2h7.5A2.5 2.5 0 0 1 22 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 4 16.5v-11Z"/><path d="M8 12h8M8 15h5"/></svg></span><span><strong>Before sending</strong><small>${esc(scope.label)} · ${esc(scope.detail)}</small></span></div>
      <label class="agent-confirm"><input id="agent-confirm" type="checkbox" /> <span>I understand that this selected context will be sent to <strong>${esc(safeConnector.endpoint)}</strong>.</span></label>
      <button class="btn btn-primary agent-ask" id="agent-ask" ${ui.busy ? 'disabled' : ''}>${ui.busy ? 'Working…' : 'Ask this connection'}</button>
      <button class="agent-link" id="agent-audit">View local request history</button>
      ${ui.status ? `<div class="agent-status-message" role="status">${esc(ui.status)}</div>` : ''}
      ${ui.answer ? `<div class="agent-answer"><div class="agent-answer-label">Response</div><div>${esc(ui.answer).replace(/\n/g, '<br>')}</div></div>` : ''}
    `;

    document.getElementById('agent-connector').addEventListener('change', (event) => { ui.connectorId = event.target.value; ui.answer = ''; ui.status = ''; render(); });
    document.getElementById('agent-manage').addEventListener('click', openManager);
    document.querySelectorAll('.agent-scope').forEach((button) => button.addEventListener('click', () => { ui.scope = button.dataset.scope; ui.status = ''; render(); }));
    document.getElementById('agent-prompt').addEventListener('input', (event) => { ui.prompt = event.target.value; });
    document.getElementById('agent-ask').addEventListener('click', ask);
    document.getElementById('agent-audit').addEventListener('click', renderAudit);
  }

  function renderAudit() {
    const rows = (state.agentAudit || []).slice(0, 30);
    panelBody.innerHTML = `
      <div class="agent-subhead"><button class="icon-button" id="agent-back" aria-label="Back to intelligence request"><svg class="icon" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button><div><strong>Local request history</strong><span>Only metadata is kept by default; prompts and page contents are not stored.</span></div></div>
      <div class="agent-audit-list">${rows.length ? rows.map((row) => `<div class="agent-audit-row"><div><strong>${esc(row.connectorName || 'Connection')}</strong><span>${esc(row.scope || 'none')} · ${esc(row.destination || '')}</span></div><em class="audit-${esc(row.state)}">${esc(row.state)}</em><time>${new Date(row.createdAt).toLocaleString()}</time></div>`).join('') : '<div class="agent-audit-empty">No intelligence requests have been made.</div>'}</div>
      <button class="btn btn-subtle" id="agent-clear-audit">Clear local request history</button>
    `;
    document.getElementById('agent-back').addEventListener('click', render);
    document.getElementById('agent-clear-audit').addEventListener('click', async () => { await window.lycon.agents.clearAudit(); state.agentAudit = []; renderAudit(); });
  }

  async function ask() {
    const connector = connectorById(ui.connectorId);
    const confirm = document.getElementById('agent-confirm');
    if (!connector) return;
    if (!ui.prompt.trim()) { ui.status = 'Write a prompt first.'; render(); return; }
    if (!confirm.checked) { ui.status = 'Review the destination and confirm the context before sending.'; render(); return; }
    ui.busy = true; ui.status = ''; ui.answer = ''; render();
    try {
      const active = getActive();
      let contextText = '';
      if (ui.scope !== 'none') {
        if (!active || !active.webview) throw new Error('There is no active page to share.');
        const script = ui.scope === 'selection'
          ? 'window.getSelection ? window.getSelection().toString() : ""'
          : 'document.body ? (document.body.innerText || "").slice(0, 16000) : ""';
        contextText = await active.webview.executeJavaScript(script, true);
        if (ui.scope === 'selection' && !String(contextText || '').trim()) throw new Error('Select some text on the active page first, or choose another context scope.');
        if (!String(contextText || '').trim()) throw new Error('The active page has no readable text to share.');
      }
      const result = await window.lycon.agents.request({
        connectorId: connector.id,
        prompt: ui.prompt.trim(),
        scope: ui.scope,
        contextText: String(contextText || '').slice(0, 16000),
        page: { url: active ? active.url : '', title: active ? active.title : '' },
        confirmed: true,
      });
      ui.answer = result && result.text ? result.text : 'The connection completed without a readable response.';
      ui.status = 'Request completed. The request metadata was recorded locally.';
      state.agentAudit = await window.lycon.agents.audit();
    } catch (error) {
      ui.status = error.message || 'The request could not be completed.';
    } finally {
      ui.busy = false;
      render();
    }
  }

  function openManager() {
    const current = connectorById(ui.connectorId);
    modalContent.innerHTML = `
      <div class="modal-heading"><div><h2 id="modal-title">Intelligence connections</h2><p class="modal-lead">Optional allies for explicit, user-ordered work. Lycon remains complete with this list empty.</p></div><button class="icon-button" id="agent-manager-close" aria-label="Close intelligence connections"><svg class="icon" viewBox="0 0 24 24"><path d="M6 6 18 18M18 6 6 18"/></svg></button></div>
      <div class="agent-form-grid">
        <label>Name<input id="agent-name" class="text-input" value="${esc(current ? current.name : '')}" placeholder="Local model or provider name" /></label>
        <label>Runs at
          <select id="agent-location" class="text-input"><option value="local" ${!current || current.location === 'local' ? 'selected' : ''}>On this device / local network</option><option value="remote" ${current && current.location === 'remote' ? 'selected' : ''}>Remote / cloud endpoint</option></select>
        </label>
        <label class="agent-form-wide">OpenAI-compatible chat endpoint<input id="agent-endpoint" class="text-input" value="${esc(current ? current.endpoint : 'http://127.0.0.1:11434/v1/chat/completions')}" placeholder="https://provider.example/v1/chat/completions" /></label>
        <label>Model<input id="agent-model" class="text-input" value="${esc(current ? current.model : '')}" placeholder="Model name (optional)" /></label>
        <label>API key <span class="optional">optional</span><input id="agent-api-key" class="text-input" type="password" placeholder="Stored in protected native storage" autocomplete="off" /></label>
      </div>
      <div class="agent-form-note"><strong>What is sent?</strong><span>Only the prompt and context scope you confirm in the intelligence panel. Secrets stay in the native host and are never exposed to page scripts.</span></div>
      <div class="modal-actions"><button class="btn btn-subtle" id="agent-test">Test endpoint</button><button class="btn btn-primary" id="agent-save">${current ? 'Save connection' : 'Add connection'}</button></div>
      ${state.connectors.length ? `<div class="agent-manager-list"><h3>Saved connections</h3>${state.connectors.map((item) => `<div class="agent-manager-row"><div><strong>${esc(item.name)}</strong><span>${esc(item.location)} · ${esc(item.endpoint)}</span></div><button class="btn btn-subtle agent-edit" data-id="${esc(item.id)}">Edit</button><button class="btn btn-danger agent-remove" data-id="${esc(item.id)}">Remove</button></div>`).join('')}</div>` : ''}
      <div class="agent-form-status" id="agent-form-status" role="status"></div>
    `;
    modalHost.classList.remove('hidden');
    document.getElementById('agent-manager-close').addEventListener('click', () => modalHost.classList.add('hidden'));
    document.getElementById('agent-save').addEventListener('click', saveConnection);
    document.getElementById('agent-test').addEventListener('click', testConnection);
    modalContent.querySelectorAll('.agent-edit').forEach((button) => button.addEventListener('click', () => { ui.connectorId = button.dataset.id; openManager(); }));
    modalContent.querySelectorAll('.agent-remove').forEach((button) => button.addEventListener('click', async () => {
      if (!window.confirm('Remove this intelligence connection?')) return;
      await window.lycon.agents.remove(button.dataset.id);
      await refresh();
      openManager();
    }));
  }

  function formValue(id) { return document.getElementById(id).value.trim(); }
  function formData() {
    return { id: connectorById(ui.connectorId)?.id || '', name: formValue('agent-name'), location: formValue('agent-location'), endpoint: formValue('agent-endpoint'), model: formValue('agent-model'), apiKey: formValue('agent-api-key') };
  }
  function setFormStatus(message) { const target = document.getElementById('agent-form-status'); if (target) target.textContent = message; }

  async function saveConnection() {
    const data = formData();
    if (!data.name || !data.endpoint) return setFormStatus('Name and endpoint are required.');
    try {
      const saved = await window.lycon.agents.save(data);
      state.connectors = await window.lycon.agents.list();
      ui.connectorId = saved.id;
      modalHost.classList.add('hidden');
      ui.status = 'Connection saved locally. Review its destination before your first request.';
      open();
    } catch (error) { setFormStatus(error.message || 'Could not save this connection.'); }
  }

  async function testConnection() {
    const data = formData();
    if (!data.endpoint) return setFormStatus('Enter an endpoint first.');
    setFormStatus('Testing only because you asked; no page context is included.');
    try {
      const result = await window.lycon.agents.test(data);
      setFormStatus(result && result.ok ? `Endpoint responded (${result.status}).` : `Endpoint responded with status ${result.status || 'unknown'}.`);
    } catch (error) { setFormStatus(error.message || 'Endpoint test failed.'); }
  }

  function render() {
    if (!panel || panel.classList.contains('hidden')) return;
    if (!state.connectors.length) renderNoConnector(); else renderConnected();
  }

  document.getElementById('act-agent').addEventListener('click', () => { if (panel.classList.contains('hidden')) open(); else close(); });
  document.getElementById('agent-panel-close').addEventListener('click', close);
  on('tab:active', () => { if (!panel.classList.contains('hidden')) render(); });
  if (window.lycon && window.lycon.agents) {
    window.lycon.agents.onAuditChanged(async () => { state.agentAudit = await window.lycon.agents.audit(); if (!panel.classList.contains('hidden')) render(); });
    window.lycon.agents.onOpenRequested(() => open());
  }

  state.connectors = [];
  state.agentAudit = [];
  refresh();
  window.LyconAgents = { open, close, refresh, openManager };
})();
