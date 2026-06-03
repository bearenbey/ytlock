// Shared helpers for YTLock.
//
// This is a classic (non-module) script so the same file works everywhere:
// it is listed in the content_scripts of the manifest, pulled into the popup
// and options pages with a <script> tag, and loaded into the background
// service worker with importScripts(). In every context it attaches a single
// `YTLock` object to the global scope.
(function (global) {
  "use strict";

  // Matches the channel portion of a YouTube path: /@handle, /channel/ID, /c/NAME.
  const CHANNEL_PATH_RE = /^\/(@[^\/]+|channel\/[^\/]+|c\/[^\/]+)/;

  // The full set of synced settings, with their defaults. Pass this to
  // chrome.storage.sync.get() so callers never have to repeat the defaults.
  const DEFAULT_SETTINGS = {
    blocklist: [],
    blockAllShorts: false,
    blockLiveChat: false,
  };

  // Pull a normalized channel id from a URL. `base` lets callers resolve
  // relative hrefs (e.g. anchor links inside the content script). Returns
  // null for anything that isn't a channel URL.
  function channelFromUrl(href, base) {
    if (!href) return null;
    try {
      const url = base ? new URL(href, base) : new URL(href);
      const match = url.pathname.match(CHANNEL_PATH_RE);
      return match ? match[1].toLowerCase() : null;
    } catch {
      return null;
    }
  }

  // Parse free-form user input: a full URL, an @handle, or a bare channel name.
  function channelFromInput(raw) {
    const value = raw.trim();
    const fromUrl = channelFromUrl(value);
    if (fromUrl) return fromUrl;
    if (value.startsWith("@")) return value.toLowerCase();
    if (value.length > 0 && !value.includes("/")) return ("@" + value).toLowerCase();
    return null;
  }

  // Read all settings (with defaults applied) in one call.
  function getSettings() {
    return chrome.storage.sync.get(DEFAULT_SETTINGS);
  }

  // Briefly flash an element's border red to signal invalid input, then reset.
  function flashInvalid(el, { color = "rgba(255, 60, 60, 0.7)", duration = 1000 } = {}) {
    el.style.borderColor = color;
    setTimeout(() => {
      el.style.borderColor = "";
    }, duration);
  }

  // Wire up the shared "add a channel" UI: clicking the button (or pressing
  // Enter in the input) parses the value, blocks the channel, and clears the
  // field. Invalid input flashes the border instead. `onAdded` runs after a
  // successful add so each page can refresh its own view.
  function wireAddChannel(input, button, onAdded) {
    async function submit() {
      const channel = channelFromInput(input.value);
      if (!channel) {
        flashInvalid(input);
        return;
      }
      await chrome.runtime.sendMessage({ type: "block-channel", channel });
      input.value = "";
      if (onAdded) onAdded();
    }
    button.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  }

  global.YTLock = {
    CHANNEL_PATH_RE,
    DEFAULT_SETTINGS,
    channelFromUrl,
    channelFromInput,
    getSettings,
    flashInvalid,
    wireAddChannel,
  };
})(typeof self !== "undefined" ? self : globalThis);
