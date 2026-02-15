// Register context menu on install
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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "ytlock-block-channel") {
    const url = info.linkUrl;
    const channel = extractChannel(url);
    if (channel) {
      await addToBlocklist(channel);
      // storage.onChanged in content script handles the rescan
    }
  }
});

// Handle messages from content script and popup
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

function extractChannel(url) {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const match = path.match(/^\/(@[^\/]+|channel\/[^\/]+|c\/[^\/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function getBlocklist() {
  const data = await chrome.storage.sync.get({ blocklist: [] });
  return data.blocklist;
}

async function addToBlocklist(channel) {
  const list = await getBlocklist();
  const normalized = channel.toLowerCase();
  if (!list.includes(normalized)) {
    list.push(normalized);
    await chrome.storage.sync.set({ blocklist: list });
  }
}

async function removeFromBlocklist(channel) {
  let list = await getBlocklist();
  const normalized = channel.toLowerCase();
  list = list.filter((c) => c !== normalized);
  await chrome.storage.sync.set({ blocklist: list });
}
