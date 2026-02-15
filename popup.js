const input = document.getElementById("channel-input");
const blockBtn = document.getElementById("block-btn");
const countNumEl = document.getElementById("count-num");
const manageLink = document.getElementById("manage-link");
const blockShortsCheckbox = document.getElementById("block-shorts");

function extractChannel(raw) {
  let value = raw.trim();
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/(@[^\/]+|channel\/[^\/]+|c\/[^\/]+)/);
    if (match) return match[1].toLowerCase();
  } catch {}
  if (value.startsWith("@")) return value.toLowerCase();
  if (value.length > 0 && !value.includes("/")) return ("@" + value).toLowerCase();
  return null;
}

async function updateCount() {
  const response = await chrome.runtime.sendMessage({ type: "get-blocklist" });
  const list = response.blocklist || [];
  countNumEl.textContent = list.length;
}

async function loadShortsToggle() {
  const data = await chrome.storage.sync.get({ blockAllShorts: false });
  blockShortsCheckbox.checked = data.blockAllShorts;
}

blockShortsCheckbox.addEventListener("change", () => {
  chrome.storage.sync.set({ blockAllShorts: blockShortsCheckbox.checked });
});

blockBtn.addEventListener("click", async () => {
  const channel = extractChannel(input.value);
  if (!channel) return;
  await chrome.runtime.sendMessage({ type: "block-channel", channel });
  input.value = "";
  updateCount();
  // Quick flash feedback
  blockBtn.style.transform = "scale(0.9)";
  setTimeout(() => { blockBtn.style.transform = ""; }, 150);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") blockBtn.click();
});

manageLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("tab.html") });
  window.close();
});

updateCount();
loadShortsToggle();
