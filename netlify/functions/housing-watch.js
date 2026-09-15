/**
 * HUGSLinks Housing Watch v2
 * netlify/functions/housing-watch.js
 *
 * Reads:
 *   /data/housing-sources.json
 *
 * Stores persistent state in Netlify Blobs.
 *
 * IMPORTANT:
 * A changed government webpage is NOT automatically
 * a verified housing-policy change.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");


/* =========================================================
   CONFIG
========================================================= */

const STORE_NAME = "hugs-housing-watch";

const STATE_KEY = "housing-state";
const HISTORY_KEY = "housing-history";

const REQUEST_TIMEOUT = 15000;
const MAX_TEXT_LENGTH = 250000;
const MAX_PREVIEW_LENGTH = 500;
const MAX_HISTORY = 200;

const USER_AGENT =
  "HUGSLinks-Housing-Watch/2.0 (+https://hugslinks.com)";


/* =========================================================
   RESPONSE
========================================================= */

function json(statusCode, payload) {
  return {
    statusCode,

    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    },

    body: JSON.stringify(payload, null, 2)
  };
}


/* =========================================================
   LOAD SOURCE REGISTRY
========================================================= */

function loadHousingSources() {

  const possiblePaths = [

    path.resolve(
      process.cwd(),
      "data",
      "housing-sources.json"
    ),

    path.resolve(
      __dirname,
      "..",
      "..",
      "data",
      "housing-sources.json"
    ),

    path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "data",
      "housing-sources.json"
    )

  ];


  for (const filePath of possiblePaths) {

    try {

      if (!fs.existsSync(filePath)) {
        continue;
      }


      const raw =
        fs.readFileSync(
          filePath,
          "utf8"
        );


      const registry =
        JSON.parse(raw);


      if (!Array.isArray(registry.sources)) {

        throw new Error(
          "housing-sources.json must contain a sources array."
        );

      }


      return registry;

    }

    catch (error) {

      console.error(
        "Registry read error:",
        filePath,
        error
      );

    }

  }


  throw new Error(
    "Unable to locate data/housing-sources.json."
  );
}


/* =========================================================
   HTML CLEANING
========================================================= */

function cleanHtml(html = "") {

  return html

    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      " "
    )

    .replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      " "
    )

    .replace(
      /<svg\b[^>]*>[\s\S]*?<\/svg>/gi,
      " "
    )

    .replace(
      /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
      " "
    )

    .replace(
      /<!--[\s\S]*?-->/g,
      " "
    )

    .replace(
      /<[^>]+>/g,
      " "
    )

    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")

    .replace(
      /&#(\d+);/g,
      (_, number) => {

        try {

          return String.fromCharCode(
            Number(number)
          );

        }

        catch {

          return " ";

        }

      }
    )

    .replace(/\s+/g, " ")

    .trim();
}


/* =========================================================
   NORMALIZE TEXT

   Removes some common site-wide noise before hashing.
========================================================= */

function normalizeForFingerprint(text = "") {

  return text

    .toLowerCase()

    .replace(
      /\bprivacy policy\b/gi,
      " "
    )

    .replace(
      /\bterms of use\b/gi,
      " "
    )

    .replace(
      /\baccessibility\b/gi,
      " "
    )

    .replace(
      /\bcopyright\b/gi,
      " "
    )

    .replace(
      /\blast updated\b[^.]{0,100}/gi,
      " "
    )

    .replace(/\s+/g, " ")

    .trim();
}


/* =========================================================
   FINGERPRINT
========================================================= */

function createFingerprint(text = "") {

  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");

}


/* =========================================================
   KEYWORD DETECTION
========================================================= */

function findKeywords(text, keywords = []) {

  const lowerText =
    String(text || "")
      .toLowerCase();


  return keywords.filter(keyword =>

    lowerText.includes(
      String(keyword)
        .toLowerCase()
    )

  );
}


/* =========================================================
   PREVIEW
========================================================= */

function createPreview(
  text,
  matchedKeywords = []
) {

  if (!text) {
    return "";
  }


  if (!matchedKeywords.length) {

    return text
      .slice(
        0,
        MAX_PREVIEW_LENGTH
      )
      .trim();

  }


  const lowerText =
    text.toLowerCase();


  let earliest = -1;


  for (const keyword of matchedKeywords) {

    const position =
      lowerText.indexOf(
        keyword.toLowerCase()
      );


    if (
      position >= 0 &&
      (
        earliest === -1 ||
        position < earliest
      )
    ) {

      earliest = position;

    }

  }


  if (earliest === -1) {

    return text
      .slice(
        0,
        MAX_PREVIEW_LENGTH
      )
      .trim();

  }


  const start =
    Math.max(
      0,
      earliest - 140
    );


  const end =
    Math.min(
      text.length,
      earliest + MAX_PREVIEW_LENGTH
    );


  let preview =
    text
      .slice(start, end)
      .trim();


  if (start > 0) {
    preview = "…" + preview;
  }


  if (end < text.length) {
    preview += "…";
  }


  return preview;
}


/* =========================================================
   FETCH WITH TIMEOUT
========================================================= */

async function fetchWithTimeout(url) {

  const controller =
    new AbortController();


  const timer =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );


  try {

    return await fetch(
      url,
      {
        method: "GET",

        redirect: "follow",

        headers: {

          "User-Agent":
            USER_AGENT,

          "Accept":
            "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"

        },

        signal:
          controller.signal
      }
    );

  }

  finally {

    clearTimeout(timer);

  }

}


/* =========================================================
   CHECK ONE SOURCE
========================================================= */

async function checkSource(source) {

  const checkedAt =
    new Date().toISOString();


  try {

    const response =
      await fetchWithTimeout(
        source.url
      );


    if (!response.ok) {

      return {

        id:
          source.id,

        name:
          source.name,

        agency:
          source.agency,

        category:
          source.category,

        priority:
          source.priority,

        source_url:
          source.url,

        final_url:
          response.url || source.url,

        checked_at:
          checkedAt,

        status:
          "source-error",

        http_status:
          response.status,

        relevant:
          false,

        matched_keywords:
          [],

        message:
          `Official source returned HTTP ${response.status}. ` +
          "This is not being treated as a housing-policy change."

      };

    }


    const contentType =
      response.headers.get(
        "content-type"
      ) || "";


    const raw =
      await response.text();


    let readableText;


    if (
      contentType.includes(
        "application/json"
      )
    ) {

      readableText =
        raw.replace(
          /\s+/g,
          " "
        );

    }

    else {

      readableText =
        cleanHtml(raw);

    }


    readableText =
      readableText.slice(
        0,
        MAX_TEXT_LENGTH
      );


    const matchedKeywords =
      findKeywords(
        readableText,
        source.keywords || []
      );


    const normalizedText =
      normalizeForFingerprint(
        readableText
      );


    const fingerprint =
      createFingerprint(
        normalizedText
      );


    return {

      id:
        source.id,

      name:
        source.name,

      agency:
        source.agency,

      category:
        source.category,

      priority:
        source.priority,

      source_url:
        source.url,

      final_url:
        response.url || source.url,

      checked_at:
        checkedAt,

      status:
        "checked",

      http_status:
        response.status,

      relevant:
        matchedKeywords.length > 0,

      matched_keywords:
        matchedKeywords,

      fingerprint,

      preview:
        createPreview(
          readableText,
          matchedKeywords
        ),

      text_length:
        readableText.length

    };

  }

  catch (error) {

    const timedOut =
      error?.name ===
      "AbortError";


    return {

      id:
        source.id,

      name:
        source.name,

      agency:
        source.agency,

      category:
        source.category,

      priority:
        source.priority,

      source_url:
        source.url,

      checked_at:
        checkedAt,

      status:
        timedOut
          ? "timeout"
          : "source-error",

      relevant:
        false,

      matched_keywords:
        [],

      message:
        timedOut

          ? "Official source timed out. No program change is being inferred."

          : "Official source could not be checked. No program change is being inferred.",

      error:
        error instanceof Error
          ? error.message
          : String(error)

    };

  }

}


/* =========================================================
   EMPTY STATE
========================================================= */

function createEmptyState() {

  return {

    version: 2,

    initialized_at: null,

    last_checked: null,

    sources: {}

  };

}


/* =========================================================
   EMPTY HISTORY
========================================================= */

function createEmptyHistory() {

  return {

    version: 2,

    last_checked: null,

    last_change: null,

    updates: []

  };

}


/* =========================================================
   RUN HOUSING WATCH
========================================================= */

async function runHousingWatch() {

  const registry =
    loadHousingSources();


  /*
   * Strong consistency is useful here because the watcher
   * reads state and then writes updated state during the
   * same monitoring operation.
   */

  const store =
    getStore({
      name: STORE_NAME,
      consistency: "strong"
    });


  const startedAt =
    new Date().toISOString();


  let state =
    await store.get(
      STATE_KEY,
      {
        type: "json",
        consistency: "strong"
      }
    );


  let history =
    await store.get(
      HISTORY_KEY,
      {
        type: "json",
        consistency: "strong"
      }
    );


  const firstRun =
    !state;


  if (!state) {
    state =
      createEmptyState();
  }


  if (!history) {
    history =
      createEmptyHistory();
  }


  if (!state.sources) {
    state.sources = {};
  }


  if (!Array.isArray(history.updates)) {
    history.updates = [];
  }


  const results = [];

  const detectedChanges = [];

  const errors = [];


  /* =======================================================
     CHECK SOURCES
  ======================================================= */

  for (const source of registry.sources) {

    console.log(
      `HUGS Housing Watch: ${source.name}`
    );


    const result =
      await checkSource(source);


    results.push(result);


    /*
     * Never replace a good fingerprint with an error.
     */

    if (result.status !== "checked") {

      errors.push(result);

      continue;

    }


    const previous =
      state.sources[source.id] || null;


    /*
     * FIRST TIME WE HAVE SEEN THIS SOURCE
     *
     * Establish baseline only.
     *
     * This is NOT an update.
     */

    if (
      !previous ||
      !previous.fingerprint
    ) {

      state.sources[source.id] = {

        id:
          source.id,

        name:
          source.name,

        agency:
          source.agency,

        category:
          source.category,

        priority:
          source.priority,

        source_url:
          source.url,

        final_url:
          result.final_url,

        fingerprint:
          result.fingerprint,

        first_seen:
          result.checked_at,

        last_checked:
          result.checked_at,

        last_changed:
          null,

        relevant:
          result.relevant,

        matched_keywords:
          result.matched_keywords

      };


      result.change_status =
        "baseline-created";


      continue;

    }


    /* =====================================================
       UNCHANGED
    ===================================================== */

    if (
      previous.fingerprint ===
      result.fingerprint
    ) {

      state.sources[source.id] = {

        ...previous,

        name:
          source.name,

        agency:
          source.agency,

        category:
          source.category,

        priority:
          source.priority,

        source_url:
          source.url,

        final_url:
          result.final_url,

        last_checked:
          result.checked_at,

        relevant:
          result.relevant,

        matched_keywords:
          result.matched_keywords

      };


      result.change_status =
        "unchanged";


      continue;

    }


    /* =====================================================
       SOURCE CHANGED
    ===================================================== */

    const update = {

      id:
        `${source.id}-${Date.now()}`,

      source_id:
        source.id,

      source:
        source.name,

      agency:
        source.agency,

      category:
        source.category,

      priority:
        source.priority,

      detected_at:
        result.checked_at,

      source_url:
        source.url,

      final_url:
        result.final_url,

      status:
        "source-changed",

      verification_status:
        "needs-review",

      relevant:
        result.relevant,

      matched_keywords:
        result.matched_keywords,

      preview:
        result.preview,

      previous_fingerprint:
        previous.fingerprint,

      current_fingerprint:
        result.fingerprint,

      explanation:
        result.relevant

          ? "HUGS Housing Watch detected a change on this official source containing monitored housing terms. Review the official source before describing this as a program or policy change."

          : "HUGS Housing Watch detected a webpage change, but the current page did not match the configured housing keywords. This may be a website or administrative change."

    };


    detectedChanges.push(update);


    /*
     * Newest update first.
     */

    history.updates.unshift(
      update
    );


    state.sources[source.id] = {

      ...previous,

      name:
        source.name,

      agency:
        source.agency,

      category:
        source.category,

      priority:
        source.priority,

      source_url:
        source.url,

      final_url:
        result.final_url,

      fingerprint:
        result.fingerprint,

      last_checked:
        result.checked_at,

      last_changed:
        result.checked_at,

      relevant:
        result.relevant,

      matched_keywords:
        result.matched_keywords

    };


    result.change_status =
      "source-changed";

  }


  /* =======================================================
     LIMIT HISTORY
  ======================================================= */

  history.updates =
    history.updates.slice(
      0,
      MAX_HISTORY
    );


  const completedAt =
    new Date().toISOString();


  /* =======================================================
     UPDATE STATE METADATA
  ======================================================= */

  if (!state.initialized_at) {

    state.initialized_at =
      startedAt;

  }


  state.version = 2;

  state.last_checked =
    completedAt;


  history.version = 2;

  history.last_checked =
    completedAt;


  if (detectedChanges.length > 0) {

    history.last_change =
      detectedChanges[0]
        .detected_at;

  }


  /* =======================================================
     SAVE PERSISTENT DATA
  ======================================================= */

  await store.setJSON(
    STATE_KEY,
    state
  );


  await store.setJSON(
    HISTORY_KEY,
    history
  );


  /* =======================================================
     SUMMARY
  ======================================================= */

  const checked =
    results.filter(
      item =>
        item.status === "checked"
    ).length;


  const relevant =
    results.filter(
      item =>
        item.status === "checked" &&
        item.relevant
    ).length;


  const baselineCreated =
    results.filter(
      item =>
        item.change_status ===
        "baseline-created"
    ).length;


  const unchanged =
    results.filter(
      item =>
        item.change_status ===
        "unchanged"
    ).length;


  return {

    service:
      "HUGS Housing Watch",

    version:
      2,

    mode:
      firstRun
        ? "baseline"
        : "monitoring",

    registry_version:
      registry.version,

    registry_last_manual_review:
      registry.last_manual_review,

    started_at:
      startedAt,

    completed_at:
      completedAt,

    summary: {

      configured_sources:
        registry.sources.length,

      checked,

      relevant,

      baseline_created:
        baselineCreated,

      unchanged,

      source_changes:
        detectedChanges.length,

      errors:
        errors.length

    },

    detected_changes:
      detectedChanges,

    errors:
      errors.map(item => ({

        id:
          item.id,

        name:
          item.name,

        status:
          item.status,

        message:
          item.message

      })),

    notice:

      firstRun

        ? "Housing Watch baseline established. Initial fingerprints were stored without reporting them as new housing updates."

        : detectedChanges.length

          ? "One or more official sources changed. These changes require verification before HUGSLinks describes them as policy or program changes."

          : "Housing Watch completed. No monitored source changes were detected."

  };

}


/* =========================================================
   NETLIFY HANDLER
========================================================= */

exports.handler =
  async function handler(event) {

    if (
      event?.httpMethod ===
      "OPTIONS"
    ) {

      return {

        statusCode: 204,

        headers: {

          "Access-Control-Allow-Origin":
            "*",

          "Access-Control-Allow-Headers":
            "Content-Type",

          "Access-Control-Allow-Methods":
            "GET, OPTIONS"

        },

        body: ""

      };

    }


    if (
      event?.httpMethod &&
      event.httpMethod !== "GET"
    ) {

      return json(
        405,
        {
          error:
            "Method not allowed."
        }
      );

    }


    try {

      const report =
        await runHousingWatch();


      return json(
        200,
        report
      );

    }

    catch (error) {

      console.error(
        "Housing Watch fatal error:",
        error
      );


      return json(
        500,
        {

          service:
            "HUGS Housing Watch",

          status:
            "error",

          message:
            "Housing Watch could not complete.",

          error:
            error instanceof Error
              ? error.message
              : String(error)

        }
      );

    }

  };


/* =========================================================
   EXPORT FOR FUTURE USE
========================================================= */

exports.runHousingWatch =
  runHousingWatch;

exports.checkSource =
  checkSource;
