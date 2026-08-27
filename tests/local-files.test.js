const path = require('path');

module.exports = {
  name: 'local-files',
  description: 'Resolve and open local files through the native bridge and URL bar',
  async run(api) {
    let pass = 0;
    let fail = 0;
    const details = [];
    const check = (name, ok, message = '') => {
      if (ok) pass++; else fail++;
      details.push({ name, ok, message });
    };

    const localPath = path.join(__dirname, '..', 'src', 'startpage.html');
    const localUrl = await api.exec(`window.lycon.local.resolvePath(${JSON.stringify(localPath)})`);
    check('Native bridge resolves a local path', typeof localUrl === 'string' && localUrl.startsWith('file://'), `url=${localUrl}`);

    await api.openNewTab(localUrl);
    await api.waitForTabLoad(20000);
    let active = await api.activeTab();
    check('Local file opens in a new tab', active && active.url.startsWith('file://'), `url=${active && active.url}`);
    await api.screenshot('startpage-quality-v2');

    await api.exec(`(function(){
      const urlbar = document.getElementById('urlbar');
      urlbar.focus();
      urlbar.value = ${JSON.stringify(localPath)};
      return window.LyconNav.commit();
    })()`);
    await api.wait(900);
    active = await api.activeTab();
    check('URL bar accepts an absolute local path', active && active.url.startsWith('file://'), `url=${active && active.url}`);

    return { pass, fail, details };
  },
};
