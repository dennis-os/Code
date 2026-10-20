/* XML Node Inspector - action popup */
'use strict';

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const url = tab.url || '';
  const actions = document.getElementById('actions');
  const desc = document.getElementById('desc');
  const info = document.getElementById('info');
  const badge = document.getElementById('badge');
  const spin = document.getElementById('spin');

  const looksXmlByPath =
    /\.(xml|xsd|xsl|xslt|rss|atom|kml|gpx|wsdl|opml|rdf|sch|xbrl)([\?&#]|$)/i.test(url);
  const looksXmlByQuery =
    /[?&](type|format|output|mode|content[-_]?type|mediatype|mime)=xml/i.test(url) ||
    /[?&]xml(?:=|&|$)/i.test(url);
  const isBrowser = /^(chrome|chrome-extension|edge):\/\//.test(url) || url.startsWith('about:');

  let liveState = null;
  if (!isBrowser) {
    try {
      liveState = await chrome.tabs.sendMessage(tab.id, { type: 'XNI_STATE_QUERY' });
    } catch (_) {}
  }

  const alreadyRunning = liveState?.running === true;
  const autoload = liveState?.autoload === true;
  const maybeXml = liveState?.maybeXml ?? (looksXmlByPath || looksXmlByQuery);

  function btn(icon, label, sub, cls, onclick) {
    const button = document.createElement('button');
    button.className = cls;
    const iconSpan = document.createElement('span');
    iconSpan.className = 'ico';
    iconSpan.textContent = icon;
    const labelSpan = document.createElement('span');
    labelSpan.className = 'lbl';
    const mainLabel = document.createElement('span');
    mainLabel.textContent = label;
    labelSpan.append(mainLabel);
    if (sub) {
      const subLabel = document.createElement('span');
      subLabel.className = 'sub';
      subLabel.textContent = sub;
      labelSpan.append(subLabel);
    }
    button.append(iconSpan, labelSpan);
    button.addEventListener('click', onclick);
    return button;
  }

  function openViewer() {
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
    window.close();
  }

  function openSourceInViewer() {
    spin.style.display = 'block';
    spin.textContent = 'XML wird im Viewer geladen \u2026';
    const viewerUrl = chrome.runtime.getURL('viewer.html') +
      '?sourceTabId=' + encodeURIComponent(tab.id);
    chrome.tabs.create({ url: viewerUrl })
      .then(() => window.close())
      .catch(error => {
        spin.textContent = 'Viewer konnte nicht ge\u00f6ffnet werden: ' + String(error);
      });
  }

  if (isBrowser) {
    desc.textContent = 'Auf Browser-internen Seiten nicht verf\u00fcgbar.';
    actions.append(btn('XML', 'Viewer \u00f6ffnen', 'Datei laden oder XML einf\u00fcgen', 'secondary', openViewer));
    return;
  }

  if (alreadyRunning) {
    badge.textContent = 'XML erkannt';
    badge.className = 'badge badge-xml';
    badge.style.display = '';
    desc.textContent = 'Der XML-Viewer wurde in einem neuen Tab ge\u00f6ffnet.';
    actions.append(btn('XML', 'XML erneut \u00f6ffnen', 'Viewer in einem weiteren Tab \u00f6ffnen', 'secondary', openSourceInViewer));
    info.textContent = url;
    return;
  }

  if (autoload || maybeXml) {
    const reason = autoload
      ? 'Diese Seite wurde anhand ihres Content-Type als XML erkannt.'
      : looksXmlByPath
        ? 'Die URL endet auf eine XML-Dateiendung.'
        : 'Die URL enth\u00e4lt einen XML-Parameter.';
    badge.textContent = autoload ? 'XML' : '?XML';
    badge.className = 'badge ' + (autoload ? 'badge-xml' : 'badge-maybe');
    badge.style.display = '';
    desc.textContent = reason + ' Im Erweiterungs-Viewer \u00f6ffnen?';
    actions.append(btn('XML', 'Als XML \u00f6ffnen', 'L\u00e4dt die Quelle in einem eigenen Tab', 'primary', openSourceInViewer));
    actions.append(btn('+', 'Leeren Viewer \u00f6ffnen', 'Datei laden oder XML einf\u00fcgen', 'secondary', openViewer));
    info.textContent = url;
    return;
  }

  desc.textContent = 'Diese Seite wurde nicht als XML erkannt. Du kannst ihren Quelltext trotzdem pr\u00fcfen oder eine XML-Datei \u00f6ffnen.';
  actions.append(btn('+', 'Viewer \u00f6ffnen', 'Datei laden oder XML einf\u00fcgen', 'primary', openViewer));
  actions.append(btn('?', 'Seitenquelle versuchen', 'L\u00e4dt den Quelltext und versucht ihn als XML zu lesen.', 'secondary', openSourceInViewer));
})();
