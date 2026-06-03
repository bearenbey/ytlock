(function () {
  "use strict";

  let blocklist = [];
  let blockAllShorts = false;
  let blockLiveChat = false;

  async function loadSettings() {
    const data = await YTLock.getSettings();
    blocklist = data.blocklist;
    blockAllShorts = data.blockAllShorts;
    blockLiveChat = data.blockLiveChat;
  }

  // keep local state in sync when settings change from popup/tab
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    if (changes.blocklist) {
      blocklist = changes.blocklist.newValue || [];
    }
    if (changes.blockAllShorts) {
      blockAllShorts = changes.blockAllShorts.newValue || false;
    }
    if (changes.blockLiveChat) {
      blockLiveChat = changes.blockLiveChat.newValue || false;
      toggleLiveChat();
    }
    if (changes.blocklist || changes.blockAllShorts) {
      scanAndBlock();
    }
  });

  // pull the channel handle or id from a youtube url (relative hrefs allowed)
  function getChannelFromHref(href) {
    return YTLock.channelFromUrl(href, window.location.origin);
  }

  function isBlocked(channel) {
    if (!channel) return false;
    return blocklist.some(
      (blocked) => channel === blocked || channel.startsWith(blocked + "/")
    );
  }

  // we tag hidden elements so we can restore them later if needed;
  // the [data-ytlock-blocked] rule in content.css does the actual hiding
  function hideElement(el) {
    el.dataset.ytlockBlocked = "true";
  }

  function unhideElement(el) {
    delete el.dataset.ytlockBlocked;
  }

  // all the different video card types youtube uses
  const VIDEO_SELECTORS = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-panel-video-renderer",
    "yt-lockup-view-model",
  ].join(", ");

  const SHORTS_ITEM_SELECTORS = [
    "ytd-reel-item-renderer",
    "ytm-shorts-lockup-view-model",
    "ytm-shorts-lockup-view-model-v2",
  ].join(", ");

  const SHORTS_CONTAINER_SELECTORS = "ytd-reel-shelf-renderer, grid-shelf-view-model";

  // everything scanAndBlock considers hiding in its main sweep
  const BLOCKABLE_SELECTORS = [VIDEO_SELECTORS, SHORTS_ITEM_SELECTORS, SHORTS_CONTAINER_SELECTORS].join(", ");

  // anchors that point at a channel (handle, id, or legacy /c/ name)
  const CHANNEL_LINK_SELECTOR = 'a[href*="/@"], a[href*="/channel/"], a[href*="/c/"]';

  // ids of the full-page overlays we inject
  const CHANNEL_OVERLAY_ID = "ytlock-channel-overlay";
  const SHORTS_OVERLAY_ID = "ytlock-shorts-overlay";

  // check if any channel link inside this element is on the blocklist
  function hasBlockedChannelLink(el) {
    const channelLinks = el.querySelectorAll(CHANNEL_LINK_SELECTOR);
    for (const link of channelLinks) {
      const channel = getChannelFromHref(link.href);
      if (isBlocked(channel)) return true;
    }
    return false;
  }

  // fallback: match by displayed channel name text
  function hasBlockedChannelName(el) {
    const channelNameEls = el.querySelectorAll(
      "ytd-channel-name, #channel-name, .ytd-channel-name, .yt-content-metadata-view-model__metadata-text"
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

  function isElementBlocked(el) {
    return hasBlockedChannelLink(el) || hasBlockedChannelName(el);
  }

  // single source of truth for whether a feed element should be hidden:
  // whole Shorts shelves go when Shorts are globally blocked; individual
  // Shorts go on the global toggle or a blocked channel; everything else
  // goes only on a blocked channel.
  function shouldBlock(el) {
    if (el.matches(SHORTS_CONTAINER_SELECTORS)) return blockAllShorts;
    if (el.matches(SHORTS_ITEM_SELECTORS) || el.matches("ytd-reel-video-renderer")) {
      return blockAllShorts || isElementBlocked(el);
    }
    return isElementBlocked(el);
  }

  function scanAndBlock() {
    // re-check anything we previously hid, unhide if no longer blocked
    for (const el of document.querySelectorAll("[data-ytlock-blocked]")) {
      if (!shouldBlock(el)) unhideElement(el);
    }

    // hide newly-appeared matches
    for (const el of document.querySelectorAll(BLOCKABLE_SELECTORS)) {
      if (!el.dataset.ytlockBlocked && shouldBlock(el)) hideElement(el);
    }

    blockChannelPage();
    blockShortsPlayer();
    skipBlockedVideo();
    toggleLiveChat();
  }

  let skipping = false;

  // if autoplay lands on a blocked channel, skip to next video
  function skipBlockedVideo() {
    if (skipping) return;
    if (!window.location.pathname.startsWith("/watch")) return;

    const ownerLink = document.querySelector("#owner")?.querySelector(CHANNEL_LINK_SELECTOR);
    if (!ownerLink) return;

    const channel = getChannelFromHref(ownerLink.href);
    if (channel && isBlocked(channel)) {
      skipping = true;
      const nextBtn = document.querySelector(".ytp-next-button");
      if (nextBtn) {
        nextBtn.click();
      } else {
        createOverlay(
          CHANNEL_OVERLAY_ID,
          "This video is from a channel blocked by YTLock",
          "Go back or navigate to another video."
        );
        skipping = false;
      }
    }
  }

  function toggleLiveChat() {
    // set the property (with !important) when blocking, clear it otherwise
    const apply = (el, prop, value) => {
      if (blockLiveChat) {
        el.style.setProperty(prop, value, "important");
      } else {
        el.style.removeProperty(prop);
      }
    };

    // hide all chat-related containers
    const targets = document.querySelectorAll(
      "ytd-live-chat-frame, #chat-container, #chat, #panels-full-bleed-container"
    );
    for (const el of targets) {
      apply(el, "display", "none");
    }

    // youtube reserves sidebar space for chat even when hidden,
    // so we need to override a few layout properties to reclaim it
    const layoutOverrides = [
      ["#columns.ytd-watch-flexy", "padding-right", "0"],
      ["#description.ytd-watch-metadata", "min-width", "0"],
      ["#bottom-row.ytd-watch-metadata", "display", "block"],
    ];
    for (const [selector, prop, value] of layoutOverrides) {
      const el = document.querySelector(selector);
      if (el) apply(el, prop, value);
    }

    // also hide the "Live chat" carousel card if it shows up
    const carousels = document.querySelectorAll("yt-video-metadata-carousel-view-model");
    for (const el of carousels) {
      if (el.querySelector("h2.ytCarouselTitleViewModelTitle")?.textContent.trim() === "Live chat") {
        apply(el, "display", "none");
      }
    }
  }

  function createOverlay(id, message, submessage) {
    if (document.getElementById(id)) return;
    const overlay = document.createElement("div");
    overlay.id = id;
    overlay.className = "ytlock-overlay";
    const p1 = document.createElement("p");
    p1.className = "ytlock-overlay__message";
    p1.textContent = message;
    overlay.appendChild(p1);
    if (submessage) {
      const p2 = document.createElement("p");
      p2.className = "ytlock-overlay__submessage";
      p2.textContent = submessage;
      overlay.appendChild(p2);
    }
    document.body.appendChild(overlay);
  }

  function removeOverlays() {
    const channel = document.getElementById(CHANNEL_OVERLAY_ID);
    if (channel) channel.remove();
    const shorts = document.getElementById(SHORTS_OVERLAY_ID);
    if (shorts) shorts.remove();
  }

  // cover the entire page if we're on a blocked channel's page
  function blockChannelPage() {
    const path = window.location.pathname.toLowerCase();
    const match = path.match(YTLock.CHANNEL_PATH_RE);
    if (!match) return;

    const channel = match[1];
    if (!isBlocked(channel)) {
      const overlay = document.getElementById(CHANNEL_OVERLAY_ID);
      if (overlay) overlay.remove();
      return;
    }

    createOverlay(
      CHANNEL_OVERLAY_ID,
      "This channel is blocked by YTLock",
      "Unblock it from the YTLock popup to view this page."
    );
  }

  function blockShortsPlayer() {
    if (!window.location.pathname.startsWith("/shorts/")) return;

    if (blockAllShorts) {
      createOverlay(SHORTS_OVERLAY_ID, "Shorts are blocked by YTLock");
      return;
    }

    // clean up overlay if shorts were just re-enabled
    const shortsOverlay = document.getElementById(SHORTS_OVERLAY_ID);
    if (shortsOverlay) shortsOverlay.remove();

    const reels = document.querySelectorAll("ytd-reel-video-renderer");
    for (const reel of reels) {
      if (reel.dataset.ytlockBlocked) continue;
      if (isElementBlocked(reel)) {
        hideElement(reel);
      }
    }
  }

  let scanTimeout = null;
  let rescanTimeout = null;
  let lastUrl = location.href;

  // youtube is a SPA so we watch for dom changes to catch new content and navigation
  const observer = new MutationObserver((mutations) => {
    // detect SPA navigation
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      skipping = false;
      removeOverlays();
      clearTimeout(scanTimeout);
      clearTimeout(rescanTimeout);
      scanAndBlock();
      // watch pages load the owner info a bit late
      if (location.pathname.startsWith("/watch")) {
        rescanTimeout = setTimeout(scanAndBlock, 800);
      }
      return;
    }

    // debounce scans when new nodes are added (infinite scroll, etc.)
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
    if (location.pathname.startsWith("/watch")) {
      rescanTimeout = setTimeout(scanAndBlock, 800);
    }
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  });
})();
