"use strict";

const find = id => document.getElementById(id);
const statusLabel = find("gift-status");
const installed = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const recipientPath = "/app/open-hug.html";
let installPrompt;

if ("serviceWorker" in navigator && !installed) {
  navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" }).catch(() => {});
}
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
});

function parseCardLink(value) {
  try {
    const url = new URL(value);
    if (url.origin !== location.origin || ![recipientPath, "/app/open-hug"].includes(url.pathname)) return null;
    const match = /^#(MOTION-\d{4}-[A-F0-9]{12})\.([a-f0-9]{64})$/.exec(url.hash);
    return match ? { order_id: match[1], access_key: match[2] } : null;
  } catch {
    return null;
  }
}

function loadStory() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/anniversary-story.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Couldn’t load the card. Try opening the link again."));
    document.head.append(script);
  });
}

async function openGift(link) {
  find("paste-gift").hidden = true;
  find("gift-install").hidden = installed;
  if (!installed) {
    find("copy-gift").hidden = false;
    find("gift-link").value = link;
  }
  statusLabel.textContent = "Finding your HUG…";
  try {
    const response = await fetch("/.netlify/functions/motion-hug-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...parseCardLink(link), mode: installed ? "app" : "preview" })
    });
    const result = await response.json();
    if (!response.ok || result.slug !== "anniversary-motion") {
      throw new Error(result.error || "This card link couldn’t be opened.");
    }
    if (installed) {
      const note = result.personalization;
      if (!note) throw new Error("Couldn’t load the personal message.");
      await loadStory();
      find("gift-heading").textContent = (note.sender_name || "Someone special") + " sent you a HUG.";
      const fullCard = find("full-gift");
      mountAnniversaryStory(fullCard, {
        recipient: note.recipient_name,
        sender: note.sender_name,
        message: note.message
      });
      fullCard.hidden = false;
    } else {
      const preview = result.preview;
      find("gift-heading").textContent = preview.sender_name + " sent you a HUG.";
      find("gift-preview-title").textContent = preview.title;
      if (preview.cover_url) {
        find("gift-cover").src = preview.cover_url;
        find("gift-cover").hidden = false;
      }
      find("gift-preview").hidden = false;
    }
    statusLabel.textContent = "";
  } catch (error) {
    statusLabel.textContent = error.message || "Try opening the card link again.";
    if (installed) find("paste-gift").hidden = false;
  }
}

find("install-hugs").onclick = async () => {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = undefined;
    await prompt.prompt();
  }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const help = find("install-help");
  help.textContent = ios
    ? "In Safari, tap Share, then Add to Home Screen. Turn on Open as Web App if Safari shows that option."
    : "Use Install app or Add to Home screen in your browser’s menu if the install prompt doesn’t appear.";
  help.hidden = false;
};

find("copy-gift").onclick = async () => {
  try {
    await navigator.clipboard.writeText(find("gift-link").value);
    statusLabel.textContent = "Card link copied. Paste it in the installed app.";
  } catch {
    find("manual-gift").hidden = false;
    find("gift-link").select();
    statusLabel.textContent = "Copy the selected link, then paste it in the installed app.";
  }
};

find("paste-gift").onsubmit = event => {
  event.preventDefault();
  const link = find("pasted-link").value.trim();
  if (!parseCardLink(link)) {
    statusLabel.textContent = "Paste the HUGSLinks card link you received.";
    return;
  }
  history.replaceState(null, "", link);
  openGift(link);
};

if (parseCardLink(location.href)) {
  openGift(location.href);
} else if (installed) {
  find("paste-gift").hidden = false;
} else {
  find("gift-install").hidden = false;
}
