"use strict";

const find = id => document.getElementById(id);
const statusLabel = find("gift-status");
const recipientPath = "/app/open-hug.html";

function parseCardLink(value) {
  try {
    const url = new URL(value);
    if (url.origin !== location.origin || ![recipientPath, "/app/open-hug"].includes(url.pathname)) return null;
    const match = /^#((?:MOTION|ANNIVERSARY)-\d{4}-[A-F0-9]{12})\.([a-f0-9]{64})$/.exec(url.hash);
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

async function openGift(reference) {
  find("paste-gift").hidden = true;
  const fullCard = find("full-gift");
  fullCard.hidden = true;
  statusLabel.textContent = "Finding your HUG…";
  try {
    const endpoint = reference.order_id.startsWith("ANNIVERSARY-")
      ? "https://hugslinks-card-app.netlify.app/.netlify/functions/anniversary-live"
      : "/.netlify/functions/motion-hug-access";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...reference, action: "open", mode: "app" })
    });
    const result = await response.json();
    if (!response.ok || result.slug !== "anniversary-motion") {
      throw new Error(result.error || "This card link couldn’t be opened.");
    }
    const note = result.personalization;
    if (!note) throw new Error("Couldn’t load the personal message.");
    await loadStory();
    find("gift-heading").textContent = (note.sender_name || "Someone special") + " sent you a HUG.";
    mountAnniversaryStory(fullCard, {
      recipient: note.recipient_name,
      sender: note.sender_name,
      message: note.message
    });
    fullCard.hidden = false;
    statusLabel.textContent = "";
  } catch (error) {
    statusLabel.textContent = error.message || "Try opening the card link again.";
    find("paste-gift").hidden = false;
  }
}

find("paste-gift").onsubmit = event => {
  event.preventDefault();
  const link = find("pasted-link").value.trim();
  const reference = parseCardLink(link);
  if (!reference) {
    statusLabel.textContent = "Paste the HUGSLinks card link you received.";
    return;
  }
  history.replaceState(null, "", link);
  openGift(reference);
};

const reference = parseCardLink(location.href);
if (reference) {
  openGift(reference);
} else {
  find("paste-gift").hidden = false;
}
