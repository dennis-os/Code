/* XML Node Inspector - content script v1.3 */
(function () {
  'use strict';
  if (window.__xniLoaded) return;
  window.__xniLoaded = true;

  const ct = (document.contentType || '').toLowerCase();
  const url = location.href;
  const isDefiniteXml = /(^|\/|\+)xml$/.test(ct) ||
    ct === 'text/xml' || ct === 'application/xml';
  const looksXmlByPath =
    /\.(xml|xsd|xsl|xslt|rss|atom|kml|gpx|wsdl|opml|rdf|sch|xbrl)([\?&#]|$)/i.test(url);
  const looksXmlByQuery =
    /[?&](type|format|output|mode|content[-_]?type|mediatype|mime)=xml/i.test(url) ||
    /[?&]xml(?:=|&|$)/i.test(url);
  const isSvg = ct === 'image/svg+xml';
  const isHtmlDocument = ct === 'text/html' || ct === 'application/xhtml+xml';
  const autoload = isDefiniteXml && !isSvg;
  const maybeXml = (looksXmlByPath || looksXmlByQuery) && !isDefiniteXml && !isSvg;
  const alwaysButton = looksXmlByPath || looksXmlByQuery;
  let viewerRequested = false;

  function rawSource() {
    const pre = document.querySelector('body > pre');
    if (pre) {
      const text = pre.textContent.trim();
      if (text.startsWith('<')) return text;
    }
    try {
      const serialized = new XMLSerializer().serializeToString(document);
      if (serialized.trim().startsWith('<')) return serialized;
    } catch (_) {}
    return null;
  }

  function sourceName() {
    try {
      return decodeURIComponent(location.pathname.split('/').pop() || 'Dokument');
    } catch (_) {
      return location.pathname.split('/').pop() || 'Dokument';
    }
  }

  function showLauncher() {
    // XML pages use the extension action popup; this button is only for HTML pages.
    if (!isHtmlDocument || document.getElementById('xni-launch-btn')) return;

    const button = document.createElement('button');
    button.id = 'xni-launch-btn';
    button.type = 'button';
    button.textContent = 'Als XML \u00f6ffnen';
    Object.assign(button.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '2147483000',
      font: '600 13px/1 -apple-system, "Segoe UI", system-ui, sans-serif',
      padding: '11px 15px',
      border: '0',
      borderRadius: '8px',
      background: '#12283d',
      color: '#fff',
      cursor: 'pointer',
      boxShadow: '0 6px 20px rgba(12,32,52,.35)',
      letterSpacing: '.01em',
    });
    button.addEventListener('click', () => {
      button.disabled = true;
      button.textContent = 'Viewer wird ge\u00f6ffnet ...';
      chrome.runtime.sendMessage({ type: 'XNI_OPEN_VIEWER' }).then(result => {
        if (!result || !result.ok) throw new Error('Viewer konnte nicht geoeffnet werden');
      }).catch(() => {
        button.disabled = false;
        button.textContent = 'Als XML \u00f6ffnen';
      });
    });
    (document.body || document.documentElement).append(button);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'XNI_STATE_QUERY') {
      sendResponse({ running: viewerRequested, autoload, maybeXml, alwaysButton, url });
      return false;
    }

    if (message.type === 'XNI_GET_SOURCE') {
      (async () => {
        // Prefer the original response; use the serialized DOM for local files
        // and browser XML views when a fetch is unavailable.
        try {
          const response = await fetch(url, { credentials: 'same-origin' });
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const text = await response.text();
          if (text.trim().startsWith('<')) {
            sendResponse({ ok: true, text, name: sourceName() });
            return;
          }
        } catch (_) {}

        const text = rawSource();
        if (text) sendResponse({ ok: true, text, name: sourceName() });
        else sendResponse({ ok: false, error: 'The XML source could not be read.' });
      })();
      return true;
    }

    return false;
  });

  function reportState() {
    chrome.runtime.sendMessage({ type: 'XNI_TAB_INFO', autoload, maybeXml, url }).catch(() => {});
  }

  function run() {
    reportState();
    if (autoload) {
      viewerRequested = true;
      chrome.runtime.sendMessage({ type: 'XNI_AUTOOPEN_VIEWER' }).then(result => {
        if (!result || !result.ok) viewerRequested = false;
      }).catch(() => {
        viewerRequested = false;
      });
    } else if (alwaysButton) {
      showLauncher();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
