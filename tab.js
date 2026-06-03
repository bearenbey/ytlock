const input = document.getElementById("channel-input");
const blockBtn = document.getElementById("block-btn");
const listEl = document.getElementById("blocklist");
const countNumEl = document.getElementById("count-num");
const listCountEl = document.getElementById("list-count");
const emptyEl = document.getElementById("empty");
const blockShortsCheckbox = document.getElementById("block-shorts");
const blockLiveChatCheckbox = document.getElementById("block-live-chat");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");
const unblockAllBtn = document.getElementById("unblock-all-btn");

function getInitial(channel) {
  const name = channel.startsWith("@") ? channel.slice(1) : channel;
  return name.charAt(0).toUpperCase();
}

async function render() {
  const response = await chrome.runtime.sendMessage({ type: "get-blocklist" });
  const list = response.blocklist || [];

  countNumEl.textContent = list.length;
  listCountEl.textContent = list.length > 0 ? `${list.length} total` : "";
  emptyEl.style.display = list.length === 0 ? "flex" : "none";
  listEl.innerHTML = "";

  for (let i = 0; i < list.length; i++) {
    const channel = list[i];
    const li = document.createElement("li");
    li.style.animationDelay = `${Math.min(i * 0.03, 0.3)}s`;

    const nameContainer = document.createElement("div");
    nameContainer.className = "channel-name";

    const avatar = document.createElement("div");
    avatar.className = "channel-avatar";
    avatar.textContent = getInitial(channel);

    const nameSpan = document.createElement("span");
    nameSpan.textContent = channel;

    nameContainer.appendChild(avatar);
    nameContainer.appendChild(nameSpan);

    const btn = document.createElement("button");
    btn.textContent = "Unblock";
    btn.addEventListener("click", async () => {
      // fade out before removing
      li.style.transition = "opacity 0.2s, transform 0.2s";
      li.style.opacity = "0";
      li.style.transform = "translateX(8px)";
      setTimeout(async () => {
        await chrome.runtime.sendMessage({ type: "unblock-channel", channel });
        render();
      }, 200);
    });

    li.appendChild(nameContainer);
    li.appendChild(btn);
    listEl.appendChild(li);
  }
}

YTLock.wireAddChannel(input, blockBtn, render);

// Reflect a setting's stored value onto its checkbox.
async function loadToggle(checkbox, key) {
  const data = await chrome.storage.sync.get({ [key]: false });
  checkbox.checked = data[key];
}

blockShortsCheckbox.addEventListener("change", () => {
  chrome.storage.sync.set({ blockAllShorts: blockShortsCheckbox.checked });
});

blockLiveChatCheckbox.addEventListener("change", () => {
  chrome.storage.sync.set({ blockLiveChat: blockLiveChatCheckbox.checked });
});

// save everything as json so the user can back up or move their blocklist
exportBtn.addEventListener("click", async () => {
  const data = await YTLock.getSettings();
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    blockAllShorts: data.blockAllShorts,
    blockLiveChat: data.blockLiveChat,
    blocklist: data.blocklist,
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ytlock-blocklist-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => {
  importFile.click();
});

// merge imported channels into the existing blocklist (no duplicates)
importFile.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const imported = Array.isArray(data.blocklist) ? data.blocklist : Array.isArray(data) ? data : null;
    if (!imported) throw new Error("Invalid format");

    const validEntries = imported
      .filter((c) => typeof c === "string" && c.length > 0 && c.length < 200)
      .map((c) => c.toLowerCase());

    const existing = await chrome.runtime.sendMessage({ type: "get-blocklist" });
    const currentList = existing.blocklist || [];
    const merged = [...new Set([...currentList, ...validEntries])];
    await chrome.storage.sync.set({ blocklist: merged });

    if (typeof data.blockAllShorts === "boolean") {
      await chrome.storage.sync.set({ blockAllShorts: data.blockAllShorts });
      loadToggle(blockShortsCheckbox, "blockAllShorts");
    }
    if (typeof data.blockLiveChat === "boolean") {
      await chrome.storage.sync.set({ blockLiveChat: data.blockLiveChat });
      loadToggle(blockLiveChatCheckbox, "blockLiveChat");
    }

    render();
  } catch {
    const original = importBtn.innerHTML;
    YTLock.flashInvalid(importBtn, { color: "rgba(255, 60, 60, 0.5)", duration: 2000 });
    importBtn.innerHTML = '<span style="color: var(--accent);">Invalid file</span>';
    setTimeout(() => {
      importBtn.innerHTML = original;
    }, 2000);
  }
  importFile.value = "";
});

// two clicks to clear - first shows "Confirm?", second actually wipes the list
let clearConfirmPending = false;
unblockAllBtn.addEventListener("click", async () => {
  if (!clearConfirmPending) {
    clearConfirmPending = true;
    unblockAllBtn.querySelector("span").textContent = "Confirm?";
    unblockAllBtn.style.borderColor = "rgba(255, 60, 60, 0.5)";
    unblockAllBtn.style.color = "var(--accent)";
    setTimeout(() => {
      if (clearConfirmPending) {
        clearConfirmPending = false;
        unblockAllBtn.querySelector("span").textContent = "Clear all";
        unblockAllBtn.style.borderColor = "";
        unblockAllBtn.style.color = "";
      }
    }, 3000);
    return;
  }
  clearConfirmPending = false;
  await chrome.storage.sync.set({ blocklist: [] });
  unblockAllBtn.querySelector("span").textContent = "Clear all";
  unblockAllBtn.style.borderColor = "";
  unblockAllBtn.style.color = "";
  render();
});

// stay in sync if another tab or the popup changes something
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  if (changes.blocklist) render();
  if (changes.blockAllShorts) loadToggle(blockShortsCheckbox, "blockAllShorts");
  if (changes.blockLiveChat) loadToggle(blockLiveChatCheckbox, "blockLiveChat");
});

render();
loadToggle(blockShortsCheckbox, "blockAllShorts");
loadToggle(blockLiveChatCheckbox, "blockLiveChat");
