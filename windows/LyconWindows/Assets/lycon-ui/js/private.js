/**
 * Lycon Browser — Private Mode
 * Creates tabs in a separate 'private' partition. No persistence.
 */
(function () {
  'use strict';

  const { state: _state } = window.LyconState;

  function createPrivateTab(url) {
    if (!window.LyconTabs) return;
    window.LyconTabs.createTab({ private: true, url });
  }

  document.getElementById('act-private').addEventListener('click', () => {
    createPrivateTab();
  });

  window.LyconPrivate = { createPrivateTab };
})();
