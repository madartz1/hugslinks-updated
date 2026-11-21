"use strict";

const get = id => document.getElementById(id);
const functions = "/.netlify/functions/";
const slug = "anniversary-motion";
const sections = ["choose", "personalization", "preview", "delivery", "recipient-gift"];
const form = get("details");
const status = get("status");
const draftKey = "anniversary-preview-draft";
const sample = {
  recipient: "My Love",
  sender: "Your Love",
  message: "Through every season, every challenge, and every beautiful memory, my heart continues to choose you.\n\nIf I could live my life all over again, I would still choose you.\n\nHappy Anniversary, My Love."
};

let draft;
let cardURL;

function show(section) {
  for (const id of sections) get(id).hidden = id !== section;
  get(section).querySelector("h1[tabindex]")?.focus();
}

function preview(card) {
  get("preview-label").textContent = draft ? "Your recipient’s preview" : "Sample card preview";
  get("preview-title").textContent = card.sender + " sent you a HUG.";
  get("preview-edit").textContent = draft ? "Edit My Message" : "Make It Yours";
  mountAnniversaryStory(get("preview-story"), card);
  get("checkout").hidden = !draft;
  status.textContent = "";
  show("preview");
}

async function post(endpoint, payload) {
  const response = await fetch(functions + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || "Please try again.");
    error.pending = result.pending === true;
    throw error;
  }
  return result;
}

function storeDraft() {
  try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); }
  catch { /* Checkout still has its own copy of the draft. */ }
}

get("preview-card").onclick = () => {
  draft = undefined;
  preview(sample);
};
get("personalize").onclick = get("preview-edit").onclick = () => show("personalization");
form.onsubmit = event => {
  event.preventDefault();
  draft = Object.fromEntries(new FormData(form).entries());
  for (const name of Object.keys(draft)) draft[name] = draft[name].trim();
  if (Object.values(draft).some(value => !value)) {
    status.textContent = "Please add a name in each field and write a message.";
    return;
  }
  storeDraft();
  preview(draft);
};

get("checkout").onclick = async () => {
  const button = get("checkout");
  button.disabled = true;
  status.textContent = "Opening secure checkout…";
  try {
    const result = await post("create-motion-hug-checkout", {
      card_slug: slug, recipient_name: draft.recipient, sender_name: draft.sender, message: draft.message
    });
    const destination = new URL(result.checkout_url);
    if (destination.origin !== "https://checkout.stripe.com") throw new Error("Unable to open checkout.");
    location.assign(destination.href);
  } catch (error) {
    status.textContent = error.message || "Unable to open checkout.";
    button.disabled = false;
  }
};

const query = new URLSearchParams(location.search);
const orderId = query.get("order");
const accessKey = query.get("access");
const sessionId = query.get("session_id");

async function openPurchasedCard() {
  const isBuyer = Boolean(sessionId);
  get("retry").hidden = true;
  status.textContent = isBuyer ? "Confirming your payment…" : "Opening your HUG…";
  try {
    const result = await post("motion-hug-access", {
      order_id: orderId, access_key: accessKey, session_id: sessionId
    });
    if (result.slug !== slug) throw new Error("This link does not belong to an Anniversary HUG.");
    if (!isBuyer) {
      location.replace(result.share_path);
      return;
    }

    const url = new URL(result.share_path, location.origin);
    if (url.origin !== location.origin || url.pathname !== "/app/open-hug.html") {
      throw new Error("Unable to open the card.");
    }
    cardURL = url.href;
    get("view").href = cardURL;
    get("view").setAttribute("aria-label", "Preview the recipient link in a new tab");
    get("share-link").value = cardURL;
    const subject = (result.preview?.sender_name || "Someone special") + " sent you an Anniversary HUG";
    const message = "An Anniversary HUG is waiting for you. Open it here: " + cardURL;
    get("email-share").href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(message);
    get("delivery-title").textContent = "Your HUG is ready!";
    get("delivery-note").textContent = "Share the preview link. Your recipient opens the full card in the HUGS Cards app.";
    get("delivery-actions").hidden = false;
    status.textContent = "";
    try { sessionStorage.removeItem(draftKey); } catch { /* The card is saved online. */ }
  } catch (error) {
    status.textContent = error.message;
    if (isBuyer) get("retry").hidden = false;
    else get("recipient-title").textContent = "We couldn’t open this HUG.";
  }
}

async function copyCard() {
  try {
    await navigator.clipboard.writeText(cardURL);
    status.textContent = "Card link copied. Paste it into a message to send your HUG.";
  } catch {
    get("manual-copy").hidden = false;
    get("share-link").select();
    status.textContent = "Copy the selected address to send your HUG.";
  }
}

get("copy").onclick = copyCard;
get("share").onclick = async () => {
  if (navigator.share) {
    try {
      await navigator.share({ title: "An Anniversary HUG for you", url: cardURL });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  await copyCard();
};

if (orderId || accessKey || sessionId) {
  show(sessionId ? "delivery" : "recipient-gift");
  get("retry").onclick = openPurchasedCard;
  openPurchasedCard();
} else if (query.get("checkout") === "cancelled") {
  try {
    const saved = JSON.parse(sessionStorage.getItem(draftKey));
    if (saved) {
      for (const name of ["recipient", "sender", "message"]) {
        form.elements.namedItem(name).value = saved[name] || "";
      }
      draft = saved;
    }
  } catch { /* The buyer can still enter a new message. */ }
  if (draft) preview(draft);
  status.textContent = "Checkout was canceled. You can make changes or try again.";
}
