const input = document.getElementById("channel-input");
const blockBtn = document.getElementById("block-btn");
const countNumEl = document.getElementById("count-num");
const manageLink = document.getElementById("manage-link");
const blockShortsCheckbox = document.getElementById("block-shorts");
const blockLiveChatCheckbox = document.getElementById("block-live-chat");

async function updateCount() {
  const response = await chrome.runtime.sendMessage({ type: "get-blocklist" });
  const list = response.blocklist || [];
  countNumEl.textContent = list.length;
}

// Load a checkbox's state from storage and persist changes back to it.
async function bindToggle(checkbox, key) {
  const data = await chrome.storage.sync.get({ [key]: false });
  checkbox.checked = data[key];
  checkbox.addEventListener("change", () => {
    chrome.storage.sync.set({ [key]: checkbox.checked });
  });
}

YTLock.wireAddChannel(input, blockBtn, () => {
  updateCount();
  // brief press animation on the button
  blockBtn.style.transform = "scale(0.9)";
  setTimeout(() => { blockBtn.style.transform = ""; }, 150);
});

manageLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("tab.html") });
  window.close();
});

updateCount();
bindToggle(blockShortsCheckbox, "blockAllShorts");
bindToggle(blockLiveChatCheckbox, "blockLiveChat");
