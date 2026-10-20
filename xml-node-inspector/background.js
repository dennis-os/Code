/* XML Node Inspector - service worker */
'use strict';

const autoOpenedTabs = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;

  if (message.type === 'XNI_TAB_INFO' && tabId !== undefined) {
    updateBadge(tabId, message.autoload, message.maybeXml);
    sendResponse({ ok: true });
    return false;
  }

  if ((message.type === 'XNI_AUTOOPEN_VIEWER' || message.type === 'XNI_OPEN_VIEWER') &&
      tabId !== undefined) {
    const isAutomatic = message.type === 'XNI_AUTOOPEN_VIEWER';
    if (isAutomatic && autoOpenedTabs.has(tabId)) {
      sendResponse({ ok: true, alreadyOpened: true });
      return false;
    }
    if (isAutomatic) autoOpenedTabs.add(tabId);

    const viewerUrl = chrome.runtime.getURL('viewer.html') +
      '?sourceTabId=' + encodeURIComponent(tabId);
    chrome.tabs.create({ url: viewerUrl, active: true })
      .then(() => sendResponse({ ok: true }))
      .catch(error => {
        if (isAutomatic) autoOpenedTabs.delete(tabId);
        sendResponse({ ok: false, error: String(error) });
      });
    return true;
  }

  return false;
});

function updateBadge(tabId, autoload, maybeXml) {
  if (autoload) {
    chrome.action.setBadgeText({ tabId, text: 'XML' }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#0b5fa5' }).catch(() => {});
    chrome.action.setTitle({ tabId, title: 'XML Node Inspector - XML erkannt' }).catch(() => {});
  } else if (maybeXml) {
    chrome.action.setBadgeText({ tabId, text: '?' }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#e07b00' }).catch(() => {});
    chrome.action.setTitle({ tabId, title: 'XML Node Inspector - XML-URL erkannt' }).catch(() => {});
  } else {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    chrome.action.setTitle({ tabId, title: 'XML Node Inspector - Viewer oeffnen' }).catch(() => {});
  }
}

chrome.tabs.onRemoved.addListener(tabId => {
  autoOpenedTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    autoOpenedTabs.delete(tabId);
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  }
});
