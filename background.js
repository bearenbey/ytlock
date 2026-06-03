importScripts("lib/ytlock-shared.js");

// right-click menu on channel links
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ytlock-block-channel",
    title: "YTLock: Block this channel",
    contexts: ["link"],
    targetUrlPatterns: [
      "*://*.youtube.com/channel/*",
      "*://*.youtube.com/@*",
      "*://*.youtube.com/c/*"
    ]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "ytlock-block-channel") {
    const channel = YTLock.channelFromUrl(info.linkUrl);
    if (channel) {
      await addToBlocklist(channel);
    }
  }
});

// handle messages from popup and tab pages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "block-channel") {
    addToBlocklist(msg.channel).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "get-blocklist") {
    getBlocklist().then((list) => sendResponse({ blocklist: list }));
    return true;
  }
  if (msg.type === "unblock-channel") {
    removeFromBlocklist(msg.channel).then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function getBlocklist() {
  const data = await chrome.storage.sync.get({ blocklist: [] });
  return data.blocklist;
}

// serialize storage writes so rapid clicks don't cause race conditions
let storageQueue = Promise.resolve();

async function addToBlocklist(channel) {
  storageQueue = storageQueue.then(async () => {
    try {
      const list = await getBlocklist();
      const normalized = channel.toLowerCase();
      if (!list.includes(normalized)) {
        list.push(normalized);
        await chrome.storage.sync.set({ blocklist: list });
      }
    } catch (e) {
      console.error("YTLock: failed to update blocklist", e);
    }
  });
  return storageQueue;
}

async function removeFromBlocklist(channel) {
  storageQueue = storageQueue.then(async () => {
    try {
      let list = await getBlocklist();
      const normalized = channel.toLowerCase();
      list = list.filter((c) => c !== normalized);
      await chrome.storage.sync.set({ blocklist: list });
    } catch (e) {
      console.error("YTLock: failed to update blocklist", e);
    }
  });
  return storageQueue;
}
