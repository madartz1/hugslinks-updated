(() => {
  "use strict";
  const liveOrigin = "https://hugslinks.com";
  const storageKey = "hugslinks-owner-card-test";
  const pages = {
    "/app/birthday-hugs": "birthday", "/app/gen-z-holiday-hugs": "gen-z-holiday-hugs",
    "/app/thinking-of-you": "thinking-of-you", "/christmas": "christmas",
    "/thanksgiving": "thanksgiving", "/anniversary-motion": "motion",
    "/nyc-ride-hugs-card": "motion", "/free-911-hugs-card": "memorial"
  };
  const paths = href => href.pathname.replace(/\.html$/, "");
  const trusted = url => {
    if (url.origin === liveOrigin) return url.pathname.startsWith("/app/") || url.pathname === "/app" || Boolean(pages[paths(url)]);
    if (url.origin === "https://hugslinks-card-app.netlify.app") {
      return ["/christmas", "/thanksgiving"].includes(paths(url));
    }
    return false;
  };
  if (!trusted(new URL(location.href))) return;

  const hash = new URLSearchParams(location.hash.slice(1));
  const fromLink = hash.get("owner-test");
  let token = fromLink;
  try {
    if (location.origin === liveOrigin) {
      if (fromLink) sessionStorage.setItem(storageKey, fromLink);
      token ||= sessionStorage.getItem(storageKey);
    }
  } catch {}
  if (fromLink) {
    const oldHash = hash.get("show");
    history.replaceState(null, "", location.pathname + location.search + (oldHash ? "#" + oldHash : ""));
  }

  let grant;
  try {
    const encoded = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    grant = JSON.parse(atob(encoded));
  } catch { return; }
  if (typeof grant?.email !== "string" || !Number.isFinite(grant.exp) || grant.exp <= Date.now()) return;

  function clearTest() {
    try { sessionStorage.removeItem(storageKey); } catch {}
  }

  document.addEventListener("click", event => {
    const anchor = event.target.closest("a[href]");
    if (!anchor || grant.exp <= Date.now()) return;
    const destination = new URL(anchor.href);
    if (!trusted(destination) || destination.origin === location.origin) return;
    const selected = new URLSearchParams({ "owner-test": token });
    if (destination.hash) selected.set("show", destination.hash.slice(1));
    destination.hash = selected.toString();
    anchor.href = destination.href;
  }, true);

  const hint = document.createElement("p");
  const returnLink = document.createElement("a");
  returnLink.textContent = "Exit test mode";
  returnLink.href = liveOrigin + "/hugs-admin";
  returnLink.addEventListener("click", clearTest);
  hint.textContent = "Owner test mode · No payment · ";
  hint.append(returnLink);
  hint.style.cssText = "margin:0;padding:10px 16px;text-align:center;color:#0b2345;background:#d5eeff;font:600 14px/1.4 system-ui";
  document.body.prepend(hint);
  document.documentElement.dataset.ownerCardTest = "";
  const css = document.createElement("style");
  css.textContent = "[data-owner-card-test] #checkout,[data-owner-card-test] #send-hug,[data-owner-card-test] .product a[href^='https://buy.stripe.com']{display:none!important}";
  document.head.append(css);

  const get = id => document.getElementById(id);
  function control(form, label, field) {
    const element = document.createElement("label");
    element.append(label, field);
    element.style.display = "block";
    form.append(element);
    return field;
  }
  window.HugsCardOwnerTest = {
    mount({ collection, selected, host = "personalize", standalone = false, anniversary = false }) {
      const parent = get(host);
      if (!parent) return;
      const form = document.createElement("form");
      form.style.cssText = "margin:18px 0;padding:14px;border:1px solid #6faed2;border-radius:12px";
      const email = document.createElement("input");
      email.type = "email";
      email.value = grant.email;
      email.readOnly = true;
      control(form, "Test recipient email", email);
      const fields = {};
      if (standalone) {
        for (const [name, label, max] of [["recipient","Recipient name",80],["sender","From",80],["message","Personal note",600]]) {
          const field = document.createElement(name === "message" ? "textarea" : "input");
          field.maxLength = max;
          fields[name] = control(form, label, field);
        }
        fields.sender.value = "HUGSLinks";
      } else if (anniversary) {
        for (const name of ["recipient","sender","message"]) fields[name] = document.querySelector("#personalization [name='" + name + "']");
      } else {
        for (const name of ["recipient","sender","message","color"]) fields[name] = get(name);
      }
      const send = document.createElement("button");
      send.type = "submit";
      send.textContent = "Send test without payment";
      const status = document.createElement("p");
      status.setAttribute("role", "status");
      const link = document.createElement("a");
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open sent card";
      link.hidden = true;
      form.append(send, status, link);
      parent.append(form);
      let requestId, previousPayload;
      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (send.disabled) return;
        const card = selected();
        if (!Number.isInteger(card)) { status.textContent = "Choose a card first."; return; }
        if (grant.exp <= Date.now()) { status.textContent = "This test session expired. Start another from Owner Workspace."; return; }
        const values = Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field?.value || ""]));
        const payload = { color: "navy", ...values, collection, card, email: grant.email };
        const fingerprint = JSON.stringify(payload);
        if (previousPayload !== fingerprint) {
          requestId = crypto.randomUUID();
          previousPayload = fingerprint;
        }
        send.disabled = true;
        link.hidden = true;
        status.textContent = "Sending the selected card…";
        try {
          const response = await fetch(liveOrigin + "/.netlify/functions/admin-send-birthday-hug", {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify({ ...payload, id: requestId }), cache: "no-store"
          });
          const result = await response.json();
          if (!response.ok || !result.ok) throw new Error(result.error || "Email delivery could not be confirmed.");
          link.href = result.link;
          link.hidden = false;
          status.textContent = "Email accepted for sending. No payment was taken.";
        } catch (error) {
          status.textContent = error.message;
        } finally {
          send.disabled = false;
        }
      });
    }
  };
})();
