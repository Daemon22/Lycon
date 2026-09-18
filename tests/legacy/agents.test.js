/**
 * Test: optional intelligence and hunting posture
 * Verifies that Lycon remains usable without a connector and that the new
 * optional surfaces are discoverable without sending a request.
 */
module.exports = {
  name: 'agents',
  description: 'No-agent usability, optional intelligence panel, and visible security posture',
  async run(api) {
    let pass = 0;
    let fail = 0;
    const details = [];
    const check = (label, condition, extra = '') => {
      if (condition) { pass++; details.push({ label, ok: true, extra }); console.log(`    ✓ ${label}${extra ? ` — ${extra}` : ''}`); }
      else { fail++; details.push({ label, ok: false, extra }); console.log(`    ✗ ${label}${extra ? ` — ${extra}` : ''}`); }
    };

    const connectors = await api.exec('window.lycon.agents.list()');
    check('Optional connector API is available', Array.isArray(connectors));
    check('Connector records do not expose API keys', Array.isArray(connectors) && connectors.every((item) => !Object.prototype.hasOwnProperty.call(item, 'apiKey') && !Object.prototype.hasOwnProperty.call(item, 'encryptedApiKey')));

    const settings = await api.exec('window.lycon.settings.get()');
    check('Security sensitivity has an explicit posture', ['hardened', 'balanced', 'permissive'].includes(settings.sensitivity), `sensitivity=${settings.sensitivity}`);
    const rejection = await api.exec("window.lycon.agents.request({ connectorId: 'missing', prompt: 'test', scope: 'none', confirmed: false }).then(() => false).catch(() => true)");
    check('Unconfirmed intelligence requests are rejected', rejection === true);

    await api.exec("document.getElementById('act-agent').click()");
    await api.wait(250);
    const panelState = await api.exec("({ hidden: document.getElementById('agent-panel').classList.contains('hidden'), text: document.getElementById('agent-panel-body').innerText })");
    check('Optional intelligence panel opens without a request', panelState && !panelState.hidden && /optional intelligence|connect intelligence/i.test(panelState.text || ''));
    check('Security posture is visible in the browser chrome', await api.exec("document.getElementById('posture-label').textContent") === 'Balanced');
    await api.screenshot('optional-intelligence');

    const testId = `lycon-test-agent-${Date.now()}`;
    const saved = await api.exec(`window.lycon.agents.save(${JSON.stringify({ id: testId, name: 'Local test connection', location: 'local', endpoint: 'http://127.0.0.1:18923/agent', model: 'test-model' })})`);
    check('A local connector can be saved without exposing credentials', saved && saved.id === testId && !Object.prototype.hasOwnProperty.call(saved, 'apiKey'));
    const response = await api.exec(`window.lycon.agents.request(${JSON.stringify({ connectorId: testId, prompt: 'Confirm this local test request.', scope: 'none', confirmed: true })})`);
    check('An explicit local connector request returns a response', response && /accepted the explicit test request/i.test(response.text || ''));
    const audit = await api.exec('window.lycon.agents.audit()');
    check('The local audit records the completed request', Array.isArray(audit) && audit.some((row) => row.connectorId === testId && row.state === 'completed'));
    await api.exec(`window.lycon.agents.remove(${JSON.stringify(testId)})`);

    await api.exec("document.getElementById('agent-panel-close').click()");
    await api.exec("document.getElementById('posture-btn').click()");
    await api.wait(150);
    const modalText = await api.exec("document.getElementById('modal-content').innerText");
    check('Hunting posture is available in Settings', /Hunting posture/i.test(modalText || ''), `modal=${String(modalText || '').slice(0, 180)}`);
    check('Settings explains that intelligence is optional', /No connection is required/i.test(modalText || ''));
    await api.exec("document.getElementById('settings-done').click()");

    return { pass, fail, details };
  },
};
