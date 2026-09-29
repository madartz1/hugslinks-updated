const BENEFITS_DATASET = "kvhd-5fmu";
const BENEFITS_PAGE = "https://access.nyc.gov/programs/";
const COUNCIL_FEED = "https://council.nyc.gov/press/feed/";
const COUNCIL_LEGISLATION = "https://legistar.council.nyc.gov/Legislation.aspx";
const NOTIFY_NYC = "https://a858-nycnotify.nyc.gov/notifynyc/";

const NEWS_FEEDS = [
  { name: "Gothamist", url: "https://gothamist.com/feed", homepage: "https://gothamist.com/" },
  { name: "THE CITY", url: "https://www.thecity.nyc/feed/", homepage: "https://www.thecity.nyc/" },
  { name: "NY1", url: "https://www.ny1.com/services/contentfeed.nyc%7Call-boroughs%7Cnews.landing.rss", homepage: "https://ny1.com/nyc/all-boroughs" },
  { name: "QNS", url: "https://qns.com/feed/", homepage: "https://qns.com/" }
];

const TYPE_ORDER = { alert: 0, council: 1, news: 2, program: 3 };

function json(data, status = 200, maxAge = 900) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=3600`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function decodeEntities(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value = "") {
  return decodeEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(value, length = 260) {
  const text = stripHtml(value);
  if (text.length <= length) return text;
  const shortened = text.slice(0, length + 1).replace(/\s+\S*$/, "").trim();
  return `${shortened || text.slice(0, length).trim()}…`;
}

function safeUrl(value, fallback = "") {
  if (!value || /^(null|undefined)$/i.test(String(value).trim())) return fallback;
  try {
    const url = new URL(String(value).trim());
    return /^https?:$/.test(url.protocol) ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function tagValue(xml, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(xml).match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function parseDate(value) {
  const date = new Date(value || 0);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function parseNycDate(value) {
  const match = String(value || "").match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return parseDate(value);
  const [, month, day, year, hour, minute, second] = match;
  const numericMonth = Number(month);
  const offset = numericMonth >= 3 && numericMonth <= 11 ? "-04:00" : "-05:00";
  return parseDate(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`);
}

function detectBoroughs(value = "") {
  const text = String(value).toLowerCase();
  const boroughs = [];
  if (/\bqueens\b|\bqn(?:\.|\b)/i.test(text)) boroughs.push("Queens");
  if (/\bbrooklyn\b|\bbk(?:\.|\b)/i.test(text)) boroughs.push("Brooklyn");
  if (/\bbronx\b|\bbx(?:\.|\b)/i.test(text)) boroughs.push("Bronx");
  if (/\bmanhattan\b|\bmn(?:\.|\b)/i.test(text)) boroughs.push("Manhattan");
  if (/\bstaten island\b|\bsi(?:\.|\b)/i.test(text)) boroughs.push("Staten Island");
  return boroughs.length ? boroughs : ["Citywide"];
}

function classifyTopic(value = "") {
  const text = String(value).toLowerCase();
  if (/snap|food|meal|pantr|grocery|nutrition|wic|hunger/.test(text)) return "Food";
  if (/housing|rent|tenant|shelter|homeless|eviction|apartment|cityfheps|nycha/.test(text)) return "Housing";
  if (/medicaid|health|hospital|clinic|disability|caregiver|mental health|public health/.test(text)) return "Health & Disability";
  if (/subway|bus|mta|transit|traffic|road|bridge|ferry|airport/.test(text)) return "Transportation";
  if (/storm|flood|weather|fire|police activity|emergency|outage|advisory|warning/.test(text)) return "Safety & Weather";
  if (/school|student|education|college|university|child care|childcare/.test(text)) return "Education & Families";
  if (/benefit|cash assistance|tax credit|fair fares|heap|assistance|income/.test(text)) return "Benefits";
  if (/bill|law|council|mayor|budget|hearing|committee|election|government/.test(text)) return "Government";
  return "Community";
}

async function fetchText(url, timeout = 10000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: {
      Accept: "text/html, application/rss+xml, application/xml;q=0.9, */*;q=0.8",
      "User-Agent": "HUGSLinks-NYC-Updates/1.0"
    }
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} responded ${response.status}`);
  return response.text();
}

function parseRss(xml, source, type, limit = 16) {
  const blocks = String(xml).match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  return blocks.slice(0, limit).map((block, index) => {
    const title = stripHtml(tagValue(block, "title"));
    const description = tagValue(block, "description") || tagValue(block, "content:encoded");
    const link = safeUrl(tagValue(block, "link"), source.homepage || source.url);
    const publishedAt = parseDate(tagValue(block, "pubDate") || tagValue(block, "dc:date"));
    const combined = `${title} ${stripHtml(description)}`;
    return {
      id: `${type}-${source.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}-${publishedAt || title}`,
      type,
      title: title || `${source.name} update`,
      summary: excerpt(description),
      source: source.name,
      source_url: link,
      published_at: publishedAt,
      updated_at: publishedAt,
      boroughs: detectBoroughs(combined),
      topic: classifyTopic(combined),
      official: type === "council"
    };
  }).filter(item => item.title && item.source_url);
}

async function loadPrograms() {
  const url = new URL(`https://data.cityofnewyork.us/resource/${BENEFITS_DATASET}.json`);
  url.searchParams.set("$select", [
    "unique_id_number", "program_code", "program_name", "program_acronym", "page_type",
    "program_category", "government_agency", "population_served", "plain_language_program_name",
    "brief_excerpt", "heads_up", "url_of_online_application", "office_locations_url", "updated_at"
  ].join(","));
  url.searchParams.set("$where", "language='English'");
  url.searchParams.set("$order", "updated_at DESC");
  url.searchParams.set("$limit", "150");

  const headers = {
    Accept: "application/json",
    "User-Agent": "HUGSLinks-NYC-Updates/1.0"
  };
  if (process.env.NYC_OPEN_DATA_APP_TOKEN) headers["X-App-Token"] = process.env.NYC_OPEN_DATA_APP_TOKEN;

  const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers });
  if (!response.ok) throw new Error(`NYC Open Data responded ${response.status}`);
  const rows = await response.json();
  const seen = new Set();

  return rows.map(row => {
    const code = String(row.program_code || row.unique_id_number || "").trim();
    if (!code || seen.has(code)) return null;
    seen.add(code);
    const title = stripHtml(row.plain_language_program_name || row.program_name || "NYC benefit program");
    const details = `${title} ${row.program_name || ""} ${row.program_category || ""} ${row.brief_excerpt || ""}`;
    const application = safeUrl(row.url_of_online_application);
    const location = safeUrl(row.office_locations_url);
    const updatedAt = parseDate(row.updated_at);
    return {
      id: `program-${code}`,
      type: "program",
      title,
      formal_name: stripHtml(row.program_name || ""),
      summary: excerpt(row.brief_excerpt || row.heads_up || title),
      source: "ACCESS NYC / NYC Open Data",
      source_url: application || location || BENEFITS_PAGE,
      directory_url: BENEFITS_PAGE,
      published_at: updatedAt,
      updated_at: updatedAt,
      boroughs: ["Citywide"],
      topic: classifyTopic(details),
      category: stripHtml(row.program_category || row.page_type || "Benefit program"),
      agency: stripHtml(row.government_agency || "City of New York"),
      population: stripHtml(row.population_served || ""),
      official: true
    };
  }).filter(Boolean);
}

async function loadCouncilFeed() {
  const xml = await fetchText(COUNCIL_FEED, 15000);
  return parseRss(xml, { name: "NYC Council", url: COUNCIL_FEED, homepage: "https://council.nyc.gov/press/" }, "council", 20);
}

async function loadLegistarMatters() {
  const token = process.env.NYC_COUNCIL_LEGISTAR_TOKEN || process.env.NYC_LEGISTAR_TOKEN;
  if (!token) return [];
  const url = new URL("https://webapi.legistar.com/v1/nyc/matters");
  url.searchParams.set("$top", "30");
  url.searchParams.set("$orderby", "MatterLastModifiedUtc desc");
  url.searchParams.set("token", token);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: "application/json", "User-Agent": "HUGSLinks-NYC-Updates/1.0" }
  });
  if (!response.ok) throw new Error(`NYC Legistar responded ${response.status}`);
  const matters = await response.json();
  return (Array.isArray(matters) ? matters : []).map(matter => {
    const title = stripHtml(matter.MatterTitle || matter.MatterName || "NYC Council legislative item");
    const file = stripHtml(matter.MatterFile || "");
    const status = stripHtml(matter.MatterStatusName || matter.MatterTypeName || "Legislative item");
    const updatedAt = parseDate(matter.MatterLastModifiedUtc || matter.MatterIntroDate);
    const detailUrl = matter.MatterId
      ? `https://legistar.council.nyc.gov/LegislationDetail.aspx?ID=${encodeURIComponent(matter.MatterId)}&GUID=${encodeURIComponent(matter.MatterGuid || "")}&Options=&Search=`
      : COUNCIL_LEGISLATION;
    return {
      id: `matter-${matter.MatterId || matter.MatterGuid || file}`,
      type: "council",
      title: file ? `${file}: ${title}` : title,
      summary: excerpt([status, matter.MatterBodyName, matter.MatterSponsorName].filter(Boolean).join(" • ")),
      source: "NYC Council Legistar",
      source_url: detailUrl,
      published_at: parseDate(matter.MatterIntroDate) || updatedAt,
      updated_at: updatedAt,
      boroughs: detectBoroughs(title),
      topic: classifyTopic(title),
      category: status,
      official: true
    };
  }).filter(item => item.title);
}

async function loadNotifyNyc() {
  const html = await fetchText(NOTIFY_NYC, 12000);
  const cards = html.match(/<div class="card-body" id="recentMessage\d+">[\s\S]*?<\/div>/gi) || [];
  return cards.slice(0, 12).map((card, index) => {
    const publishedText = stripHtml(tagValue(card, "p"));
    const titleMatch = card.match(/<h3[^>]*id="title"[^>]*>([\s\S]*?)<\/h3>/i);
    const messageMatch = card.match(/<p[^>]*id="message"[^>]*>([\s\S]*?)<\/p>/i);
    const title = stripHtml(titleMatch?.[1] || "Notify NYC alert");
    const summary = excerpt(messageMatch?.[1] || "", 300);
    const publishedAt = parseNycDate(publishedText);
    return {
      id: `notify-${index}-${publishedAt || title}`,
      type: "alert",
      title: title.replace(/^Notify NYC\s*-\s*/i, ""),
      summary,
      source: "Notify NYC",
      source_url: NOTIFY_NYC,
      published_at: publishedAt,
      updated_at: publishedAt,
      boroughs: detectBoroughs(`${title} ${summary}`),
      topic: classifyTopic(`${title} ${summary}`),
      official: true
    };
  }).filter(item => item.title);
}

async function loadNews() {
  const results = await Promise.allSettled(NEWS_FEEDS.map(async source => {
    const xml = await fetchText(source.url, 12000);
    return parseRss(xml, source, "news", 12);
  }));
  const items = [];
  const errors = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") items.push(...result.value);
    else errors.push(`${NEWS_FEEDS[index].name}: ${result.reason?.message || "unavailable"}`);
  });
  return { items: deduplicate(items).sort(sortItems).slice(0, 42), errors };
}

function deduplicate(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = String(item.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortItems(a, b) {
  const aTime = new Date(a.updated_at || a.published_at || 0).getTime() || 0;
  const bTime = new Date(b.updated_at || b.published_at || 0).getTime() || 0;
  if (bTime !== aTime) return bTime - aTime;
  return (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9);
}

function resultError(result, label) {
  return result.status === "rejected" ? `${label}: ${result.reason?.message || "unavailable"}` : "";
}

export default async request => {
  if (request.method !== "GET") return json({ ok: false, error: "Method not allowed." }, 405, 0);

  const [programResult, councilResult, legistarResult, alertResult, newsResult] = await Promise.allSettled([
    loadPrograms(),
    loadCouncilFeed(),
    loadLegistarMatters(),
    loadNotifyNyc(),
    loadNews()
  ]);

  const programs = programResult.status === "fulfilled" ? programResult.value : [];
  const councilFeed = councilResult.status === "fulfilled" ? councilResult.value : [];
  const legislation = legistarResult.status === "fulfilled" ? legistarResult.value : [];
  const council = deduplicate([...legislation, ...councilFeed]).sort(sortItems).slice(0, 35);
  const alerts = alertResult.status === "fulfilled" ? alertResult.value.sort(sortItems) : [];
  const newsPayload = newsResult.status === "fulfilled" ? newsResult.value : { items: [], errors: [] };
  const news = newsPayload.items;

  const errors = [
    resultError(programResult, "Benefits"),
    resultError(councilResult, "NYC Council"),
    resultError(legistarResult, "Legislation"),
    resultError(alertResult, "Notify NYC"),
    resultError(newsResult, "Local news"),
    ...newsPayload.errors
  ].filter(Boolean);

  const activeGroups = [programs, council, alerts, news].filter(group => group.length).length;
  const highlights = [alerts[0], council[0], news[0]].filter(Boolean);
  const generatedAt = new Date().toISOString();
  const requestUrl = new URL(request.url);
  const homeOnly = requestUrl.searchParams.get("scope") === "home";

  const payload = {
    ok: activeGroups > 0,
    generated_at: generatedAt,
    live_status: activeGroups === 4 && errors.length === 0 ? "live" : activeGroups > 0 ? "partial" : "unavailable",
    errors,
    counts: {
      programs: programs.length,
      council: council.length,
      alerts: alerts.length,
      news: news.length
    },
    highlights,
    source_links: {
      programs: BENEFITS_PAGE,
      legislation: COUNCIL_LEGISLATION,
      alerts: NOTIFY_NYC,
      news: NEWS_FEEDS.map(({ name, homepage }) => ({ name, url: homepage }))
    },
    notice: "HUGSLinks connects visitors to original sources. Confirm urgent information with the issuing agency. Call 911 for immediate emergencies."
  };

  if (!homeOnly) Object.assign(payload, { programs, council, alerts, news });
  return json(payload, activeGroups > 0 ? 200 : 503);
};
