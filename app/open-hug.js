"use strict";

const find = id => document.getElementById(id);
const statusLabel = find("gift-status");
const recipientPath = "/app/open-hug.html";
const anniversaryApi = "https://hugslinks-card-app.netlify.app/.netlify/functions/anniversary-live";
const accountLink = /^#saved\.(received|sent)\.(ANNIVERSARY-\d{4}-[A-F0-9]{12})$/;

function sessionToken() {
  try { return JSON.parse(sessionStorage.getItem("hugs-card-sender"))?.session; }
  catch { return null; }
}

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

async function openGift(reference, direction) {
  find("paste-gift").hidden = true;
  const fullCard = find("full-gift");
  fullCard.hidden = true;
  find("gift-library").hidden = true;
  statusLabel.textContent = "Finding your HUG…";
  try {
    const isAnniversary = reference.order_id.startsWith("ANNIVERSARY-");
    const endpoint = isAnniversary ? anniversaryApi : "/.netlify/functions/motion-hug-access";
    const headers = { "Content-Type": "application/json" };
    if (direction) {
      const session = sessionToken();
      if (!session) throw new Error("Sign in to My Cards to open your saved card.");
      headers.Authorization = "Bearer " + session;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(direction
        ? { ...reference, action: "library-open", direction }
        : { ...reference, action: "open", mode: "app" })
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
    if (isAnniversary) {
      find("gift-library").hidden = false;
      find("save-gift").hidden = Boolean(direction);
      if (!direction) find("save-gift").onclick = () => saveGift(reference);
    }
    statusLabel.textContent = "";
  } catch (error) {
    statusLabel.textContent = error.message || "Try opening the card link again.";
    find("paste-gift").hidden = Boolean(direction);
    find("gift-library").hidden = !direction;
    find("save-gift").hidden = true;
  }
}

async function saveGift(reference) {
  const button = find("save-gift");
  button.disabled = true;
  const session = sessionToken();
  try {
    if (session) {
      const response = await fetch(anniversaryApi, {
        method: "POST",
        headers: { Authorization: "Bearer " + session, "Content-Type": "application/json" },
        body: JSON.stringify({ ...reference, action: "library-claim" })
      });
      if (response.ok) {
        button.textContent = "Saved to My Cards";
        return;
      }
      if (response.status !== 401) throw new Error((await response.json()).error || "Couldn’t save this card.");
    }
    sessionStorage.setItem("hugs-pending-anniversary", JSON.stringify(reference));
    location.assign("/app/#account");
  } catch (error) {
    button.disabled = false;
    statusLabel.textContent = error.message || "Couldn’t save this card. Try again.";
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
const savedCard = accountLink.exec(location.hash);
if (reference) {
  openGift(reference);
} else if (savedCard) {
  openGift({ order_id: savedCard[2] }, savedCard[1]);
} else {
  find("paste-gift").hidden = false;
}
