(function () {
  "use strict";

  const PIXEL_URL = chrome.runtime.getURL("pixel.png");
  let blocklist = [];
  let blockAllShorts = false;

  async function loadSettings() {
    const data = await chrome.storage.sync.get({ blocklist: [], blockAllShorts: false });
    blocklist = data.blocklist;
    blockAllShorts = data.blockAllShorts;
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.blocklist) {
      blocklist = changes.blocklist.newValue || [];
    }
    if (changes.blockAllShorts) {
      blockAllShorts = changes.blockAllShorts.newValue || false;
    }
    if (changes.blocklist || changes.blockAllShorts) {
      scanAndBlock();
    }
  });

  function getChannelFromHref(href) {
    if (!href) return null;
    try {
      const url = new URL(href, window.location.origin);
      const match = url.pathname.match(/^\/(@[^\/]+|channel\/[^\/]+|c\/[^\/]+)/);
      return match ? match[1].toLowerCase() : null;
    } catch {
      return null;
    }
  }

  function isBlocked(channel) {
    if (!channel) return false;
    return blocklist.some(
      (blocked) => channel === blocked || channel.startsWith(blocked + "/")
    );
  }

  function replaceWithPixel(el) {
    if (el.dataset.ytlockBlocked) return;
    el.dataset.ytlockBlocked = "true";
    const img = document.createElement("img");
    img.src = PIXEL_URL;
    img.style.width = "1px";
    img.style.height = "1px";
    img.style.display = "block";
    el.replaceWith(img);
  }

  const VIDEO_SELECTORS = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-panel-video-renderer",
  ].join(", ");

  const SHORTS_ITEM_SELECTORS = [
    "ytd-reel-item-renderer",
    "ytm-shorts-lockup-view-model",
    "ytm-shorts-lockup-view-model-v2",
  ].join(", ");

  // Check if element has a channel link that's blocked (for regular videos)
  function hasBlockedChannelLink(el) {
    const channelLinks = el.querySelectorAll(
      'a[href*="/@"], a[href*="/channel/"], a[href*="/c/"]'
    );
    for (const link of channelLinks) {
      const channel = getChannelFromHref(link.href);
      if (isBlocked(channel)) return true;
    }
    return false;
  }

  // Broader check for Shorts which often lack <a> channel links
  function isShortsElementBlocked(el) {
    // Try links first
    if (hasBlockedChannelLink(el)) return true;

    // Try channel name text elements
    const channelNameEls = el.querySelectorAll(
      "ytd-channel-name, #channel-name, .ytd-channel-name"
    );
    for (const nameEl of channelNameEls) {
      const text = nameEl.textContent.trim().toLowerCase();
      if (text.length > 0) {
        const asHandle = text.startsWith("@") ? text : "@" + text;
        if (isBlocked(asHandle) || isBlocked(text)) return true;
      }
    }

    return false;
  }

  function scanAndBlock() {
    // 1. Block standard video elements (link-based matching only)
    const videoElements = document.querySelectorAll(VIDEO_SELECTORS);
    for (const el of videoElements) {
      if (el.dataset.ytlockBlocked) continue;
      if (hasBlockedChannelLink(el)) {
        replaceWithPixel(el);
      }
    }

    // 2. Block Shorts items
    const shortsItems = document.querySelectorAll(SHORTS_ITEM_SELECTORS);
    for (const el of shortsItems) {
      if (el.dataset.ytlockBlocked) continue;
      if (blockAllShorts || isShortsElementBlocked(el)) {
        replaceWithPixel(el);
      }
    }

    // 3. Block all Shorts shelves/grids if blockAllShorts is on
    if (blockAllShorts) {
      const shortsContainers = document.querySelectorAll(
        "ytd-reel-shelf-renderer, grid-shelf-view-model"
      );
      for (const container of shortsContainers) {
        replaceWithPixel(container);
      }
    }

    blockChannelPage();
    blockShortsPlayer();
  }

  function blockChannelPage() {
    const path = window.location.pathname.toLowerCase();
    const match = path.match(/^\/(@[^\/]+|channel\/[^\/]+|c\/[^\/]+)/);
    if (!match) return;

    const channel = match[1];
    if (!isBlocked(channel)) return;

    if (document.getElementById("ytlock-channel-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "ytlock-channel-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #0f0f0f;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      color: #aaa;
      font-family: 'YouTube Sans', 'Roboto', Arial, sans-serif;
    `;
    const img = document.createElement("img");
    img.src = PIXEL_URL;
    img.width = 1;
    img.height = 1;
    const p1 = document.createElement("p");
    p1.style.cssText = "font-size: 18px; margin-top: 20px;";
    p1.textContent = "This channel is blocked by YTLock";
    const p2 = document.createElement("p");
    p2.style.cssText = "font-size: 14px; color: #666;";
    p2.textContent = "Unblock it from the YTLock popup to view this page.";
    overlay.appendChild(img);
    overlay.appendChild(p1);
    overlay.appendChild(p2);
    document.body.appendChild(overlay);
  }

  // Block Shorts in the /shorts/ vertical player
  function blockShortsPlayer() {
    if (!window.location.pathname.startsWith("/shorts/")) return;

    // If blockAllShorts, overlay the entire page
    if (blockAllShorts) {
      if (document.getElementById("ytlock-channel-overlay")) return;
      const overlay = document.createElement("div");
      overlay.id = "ytlock-channel-overlay";
      overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: #0f0f0f;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        color: #aaa;
        font-family: 'YouTube Sans', 'Roboto', Arial, sans-serif;
      `;
      const p1 = document.createElement("p");
      p1.style.cssText = "font-size: 18px; margin-top: 20px;";
      p1.textContent = "Shorts are blocked by YTLock";
      overlay.appendChild(p1);
      document.body.appendChild(overlay);
      return;
    }

    // Otherwise block individual Shorts from blocked channels
    const reels = document.querySelectorAll("ytd-reel-video-renderer");
    for (const reel of reels) {
      if (reel.dataset.ytlockBlocked) continue;
      const channelLinks = reel.querySelectorAll(
        'a[href*="/@"], a[href*="/channel/"], a[href*="/c/"]'
      );
      for (const link of channelLinks) {
        const channel = getChannelFromHref(link.href);
        if (isBlocked(channel)) {
          reel.dataset.ytlockBlocked = "true";
          reel.style.visibility = "hidden";
          reel.style.height = "0";
          reel.style.overflow = "hidden";
          break;
        }
      }
    }
  }

  let scanTimeout = null;
  let lastUrl = location.href;

  const observer = new MutationObserver((mutations) => {
    // Check for SPA navigation
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const overlay = document.getElementById("ytlock-channel-overlay");
      if (overlay) overlay.remove();
      clearTimeout(scanTimeout);
      scanAndBlock();
      return;
    }

    // Check for added nodes, debounced
    let shouldScan = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) {
      clearTimeout(scanTimeout);
      scanTimeout = setTimeout(scanAndBlock, 100);
    }
  });

  loadSettings().then(() => {
    scanAndBlock();
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  });
})();
