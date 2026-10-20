(function () {
  'use strict';
  const drop = document.getElementById('drop');
  const host = document.getElementById('host');
  const ta = document.getElementById('ta');
  const file = document.getElementById('file');
  const status = document.getElementById('status');

  function start(text, name) {
    if (!text || !text.trim()) {
      ta.focus();
      throw new Error('Die geladene Quelle ist leer.');
    }
    drop.remove();
    window.XNI.mount(host, text, { name: name || 'Eingef\u00fcgtes XML' });
  }

  async function openSourceTab(tabId) {
    status.style.display = 'block';
    status.textContent = 'XML-Quelle wird geladen \u2026';

    let tab = null;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch (_) {}

    let source = null;
    let name = tab && tab.title ? tab.title : 'Dokument';

    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'XNI_GET_SOURCE' });
      if (response && response.ok && response.text) {
        source = response.text;
        name = response.name || name;
      }
    } catch (_) {}

    // A content script may not run on a browser-rendered XML page.
    // Host permissions allow this extension page to fetch ordinary web URLs.
    if (!source && tab && /^https?:\/\//i.test(tab.url || '')) {
      const response = await fetch(tab.url, { credentials: 'include' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      source = await response.text();
      try {
        name = decodeURIComponent(new URL(tab.url).pathname.split('/').pop() || name);
      } catch (_) {}
    }

    if (!source && tab && /^file:\/\//i.test(tab.url || '')) {
      throw new Error('Die lokale Datei konnte nicht gelesen werden. Aktiviere in den Erweiterungsdetails den Zugriff auf Datei-URLs.');
    }
    if (!source) {
      throw new Error('Die Quelle ist nicht erreichbar. Pr\u00fcfe, ob die Erweiterung Zugriff auf diese Seite hat.');
    }

    start(source, name);
  }

  document.getElementById('go').addEventListener('click', () => {
    try {
      start(ta.value, 'Eingef\u00fcgtes XML');
    } catch (error) {
      status.style.display = 'block';
      status.textContent = error.message;
    }
  });
  file.addEventListener('change', () => {
    const selected = file.files && file.files[0];
    if (selected) selected.text().then(text => start(text, selected.name)).catch(error => {
      status.style.display = 'block';
      status.textContent = error.message;
    });
  });
  ['dragenter', 'dragover'].forEach(eventName =>
    drop.addEventListener(eventName, event => {
      event.preventDefault();
      drop.classList.add('dragover');
    }));
  ['dragleave', 'drop'].forEach(eventName =>
    drop.addEventListener(eventName, () => drop.classList.remove('dragover')));
  drop.addEventListener('drop', event => {
    event.preventDefault();
    const selected = event.dataTransfer.files && event.dataTransfer.files[0];
    if (selected) selected.text().then(text => start(text, selected.name)).catch(error => {
      status.style.display = 'block';
      status.textContent = error.message;
    });
  });

  const params = new URLSearchParams(location.search);
  const sourceTabId = Number(params.get('sourceTabId'));
  if (Number.isInteger(sourceTabId) && sourceTabId > 0) {
    openSourceTab(sourceTabId).catch(error => {
      status.style.display = 'block';
      status.textContent = 'XML konnte nicht geladen werden: ' + error.message;
    });
  }
})();
