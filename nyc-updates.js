(() => {
  const ENDPOINT = "/api/nyc-updates";
  const TYPE_CONFIG = {
    alert: { label: "Official Alert", icon: "!", action: "Open Notify NYC" },
    council: { label: "Council & Law", icon: "⚖", action: "Open Council source" },
    program: { label: "Program", icon: "✓", action: "View program" },
    news: { label: "Local News", icon: "●", action: "Read at source" }
  };

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  const compactDateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  function validDate(value) {
    const date = new Date(value || 0);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function formatDate(value, compact = false) {
    const date = validDate(value);
    if (!date) return "Date not supplied";
    return (compact ? compactDateFormatter : dateFormatter).format(date);
  }

  function safeHref(value, fallback = "#") {
    try {
      const url = new URL(value, location.origin);
      return /^https?:$/.test(url.protocol) ? url.href : fallback;
    } catch {
      return fallback;
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function itemSearchText(item) {
    return [
      item.title, item.formal_name, item.summary, item.source, item.topic,
      item.category, item.agency, item.population, ...(item.boroughs || [])
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function itemTime(item) {
    return validDate(item.updated_at || item.published_at)?.getTime() || 0;
  }

  function sourceLine(item) {
    if (item.type === "program") return `Program data updated ${formatDate(item.updated_at, true)}`;
    if (item.type === "alert") return `Issued ${formatDate(item.published_at, true)}`;
    return `Published ${formatDate(item.published_at, true)}`;
  }

  function createUpdateCard(item) {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.news;
    const card = el("article", "nycu-card");
    card.dataset.type = item.type || "news";

    const top = el("div", "nycu-card-top");
    const typeBadge = el("span", "nycu-type-badge", `${config.icon} ${config.label}`);
    top.appendChild(typeBadge);
    if (item.official) top.appendChild(el("span", "nycu-official", "✓ Official source"));
    card.appendChild(top);

    card.appendChild(el("h3", "", item.title || "NYC update"));
    card.appendChild(el("p", "nycu-card-summary", item.summary || "Open the original source for the complete update."));

    const tags = el("div", "nycu-tags");
    if (item.topic) tags.appendChild(el("span", "nycu-tag", item.topic));
    const boroughs = Array.isArray(item.boroughs) ? item.boroughs.slice(0, 2) : [];
    boroughs.forEach(borough => tags.appendChild(el("span", "nycu-tag", borough)));
    if (item.category && item.category !== item.topic) tags.appendChild(el("span", "nycu-tag", item.category));
    if (tags.children.length) card.appendChild(tags);

    const footer = el("div", "nycu-card-footer");
    const source = el("div", "nycu-source");
    source.appendChild(el("strong", "", item.source || "Original source"));
    source.appendChild(document.createTextNode(sourceLine(item)));

    const link = el("a", "nycu-source-link", `${config.action} →`);
    link.href = safeHref(item.source_url);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `${config.action}: ${item.title || "NYC update"}`);

    footer.append(source, link);
    card.appendChild(footer);
    return card;
  }

  function createHomeItem(item) {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.news;
    const link = el("a", "nycu-home-item");
    link.href = safeHref(item.source_url, "nyc-updates.html");
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.appendChild(el("span", "nycu-home-item-type", `${config.icon} ${config.label}`));
    link.appendChild(el("h3", "", item.title || "NYC update"));
    link.appendChild(el("p", "", item.summary || "Open the source for the full update."));
    link.appendChild(el("div", "nycu-home-item-meta", `${item.source || "Source"} • ${formatDate(item.published_at || item.updated_at, true)}`));
    return link;
  }

  async function requestUpdates(homeOnly = false, force = false) {
    const suffix = homeOnly ? "?scope=home" : force ? `?refresh=${Date.now()}` : "";
    const response = await fetch(`${ENDPOINT}${suffix}`, {
      headers: { Accept: "application/json" },
      cache: force ? "no-store" : "default"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "Live NYC updates are temporarily unavailable.");
    return data;
  }

  function fallbackHomeItems() {
    return [
      { type: "alert", title: "Official NYC alerts", summary: "Review current emergency and City-service notifications.", source: "Notify NYC", source_url: "https://a858-nycnotify.nyc.gov/notifynyc/" },
      { type: "council", title: "NYC Council legislation", summary: "Search bills, local laws, hearings, and Council activity.", source: "NYC Council", source_url: "https://legistar.council.nyc.gov/Legislation.aspx" },
      { type: "program", title: "Benefits and programs", summary: "Find official food, cash, housing, health, and family support programs.", source: "ACCESS NYC", source_url: "https://access.nyc.gov/programs/" }
    ];
  }

  async function initHomePanel() {
    const feed = document.getElementById("nycu-home-feed");
    if (!feed) return;
    const status = document.getElementById("nycu-home-status");
    try {
      const data = await requestUpdates(true);
      feed.replaceChildren(...(data.highlights?.length ? data.highlights : fallbackHomeItems()).slice(0, 3).map(createHomeItem));
      if (status) status.textContent = data.live_status === "live" ? "Live sources connected" : "Live sources connected • some feeds delayed";
    } catch {
      feed.replaceChildren(...fallbackHomeItems().map(createHomeItem));
      if (status) status.textContent = "Official source links available";
    }
  }

  function initDashboard() {
    const feed = document.getElementById("nycu-feed");
    if (!feed) return;

    const state = {
      data: null,
      items: [],
      type: "all",
      query: "",
      topic: "all",
      borough: "all",
      limit: 24
    };

    const search = document.getElementById("nycu-search");
    const topic = document.getElementById("nycu-topic");
    const borough = document.getElementById("nycu-borough");
    const count = document.getElementById("nycu-result-count");
    const health = document.getElementById("nycu-source-health");
    const status = document.getElementById("nycu-live-status");
    const refresh = document.getElementById("nycu-refresh");
    const loadMore = document.getElementById("nycu-load-more");
    const tabs = [...document.querySelectorAll("[data-nycu-type]")];

    const params = new URLSearchParams(location.search);
    if (search && params.get("q")) {
      search.value = params.get("q").slice(0, 120);
      state.query = search.value.toLowerCase().trim();
    }
    if (params.get("type") && ["program", "council", "alert", "news"].includes(params.get("type"))) state.type = params.get("type");

    function filteredItems() {
      return state.items.filter(item => {
        if (state.type !== "all" && item.type !== state.type) return false;
        if (state.topic !== "all" && item.topic !== state.topic) return false;
        if (state.borough !== "all" && !(item.boroughs || []).includes(state.borough)) return false;
        if (state.query && !itemSearchText(item).includes(state.query)) return false;
        return true;
      });
    }

    function syncTabs() {
      tabs.forEach(tab => tab.setAttribute("aria-pressed", String(tab.dataset.nycuType === state.type)));
    }

    function render() {
      syncTabs();
      const filtered = filteredItems();
      const visible = filtered.slice(0, state.limit);
      feed.replaceChildren();
      if (!visible.length) {
        const empty = el("div", "nycu-empty");
        empty.appendChild(el("strong", "", "No matching updates found."));
        empty.appendChild(document.createTextNode("Try a broader search, another borough, or the All Updates filter."));
        feed.appendChild(empty);
      } else {
        const fragment = document.createDocumentFragment();
        visible.forEach(item => fragment.appendChild(createUpdateCard(item)));
        feed.appendChild(fragment);
      }
      if (count) count.innerHTML = `Showing <strong>${visible.length}</strong> of <strong>${filtered.length}</strong> matching updates`;
      if (loadMore) loadMore.hidden = visible.length >= filtered.length;
    }

    function updateHealth(data) {
      const delayed = data.live_status !== "live" || (data.errors || []).length > 0;
      if (health) {
        health.classList.toggle("partial", delayed);
        const healthText = health.querySelector("span");
        if (healthText) healthText.textContent = delayed ? "Some sources are delayed; available results are shown." : "All source groups connected.";
      }
      if (status) {
        status.dataset.state = delayed ? "partial" : "live";
        status.textContent = delayed
          ? `Updated ${formatDate(data.generated_at, true)} • Some sources temporarily delayed`
          : `Updated ${formatDate(data.generated_at, true)} • Official and local sources connected`;
      }
    }

    async function load(force = false) {
      if (refresh) {
        refresh.disabled = true;
        refresh.textContent = "Refreshing…";
      }
      if (status) {
        status.dataset.state = "loading";
        status.textContent = "Connecting to NYC sources…";
      }
      try {
        const data = await requestUpdates(false, force);
        state.data = data;
        state.items = [
          ...(data.alerts || []),
          ...(data.council || []),
          ...(data.news || []),
          ...(data.programs || [])
        ].sort((a, b) => itemTime(b) - itemTime(a));
        updateHealth(data);
        feed.setAttribute("aria-busy", "false");
        render();
      } catch (error) {
        feed.replaceChildren();
        const empty = el("div", "nycu-empty");
        empty.appendChild(el("strong", "", "Live updates could not load right now."));
        empty.appendChild(document.createTextNode("Use the official source buttons above while the connection recovers."));
        feed.appendChild(empty);
        if (count) count.textContent = "Official source links remain available";
        if (health) {
          health.classList.add("partial");
          const healthText = health.querySelector("span");
          if (healthText) healthText.textContent = "Connection temporarily unavailable.";
        }
        if (status) {
          status.dataset.state = "error";
          status.textContent = error.message;
        }
      } finally {
        if (refresh) {
          refresh.disabled = false;
          refresh.textContent = "↻ Refresh updates";
        }
      }
    }

    tabs.forEach(tab => tab.addEventListener("click", () => {
      state.type = tab.dataset.nycuType;
      state.limit = 24;
      render();
    }));

    let searchTimer;
    search?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = search.value.toLowerCase().trim();
        state.limit = 24;
        render();
      }, 120);
    });

    topic?.addEventListener("change", () => {
      state.topic = topic.value;
      state.limit = 24;
      render();
    });

    borough?.addEventListener("change", () => {
      state.borough = borough.value;
      state.limit = 24;
      render();
    });

    loadMore?.addEventListener("click", () => {
      state.limit += 24;
      render();
    });

    refresh?.addEventListener("click", () => load(true));
    syncTabs();
    load();
  }

  initHomePanel();
  initDashboard();
})();
