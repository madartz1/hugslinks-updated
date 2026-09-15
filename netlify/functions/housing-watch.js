/**
 * HUGSLinks Housing Watch
 * netlify/functions/housing-watch.js
 *
 * PURPOSE
 * ------------------------------------------------------------
 * Reads the official housing sources defined in:
 *
 *   /data/housing-sources.json
 *
 * Checks each source, follows redirects, extracts readable text,
 * looks for HUGS Housing Watch keywords, and creates a fingerprint
 * that can later be compared with stored history.
 *
 * IMPORTANT
 * ------------------------------------------------------------
 * This function DOES NOT automatically claim that a policy changed.
 *
 * A changed fingerprint means:
 *   "The monitored source changed."
 *
 * It does NOT necessarily mean:
 *   "CityFHEPS rules changed."
 *
 * Persistent history will be added separately.
 */


const fs = require("fs");
const path = require("path");
const crypto = require("crypto");


/* ============================================================
   SETTINGS
============================================================ */

const USER_AGENT =
  "HUGSLinks-Housing-Watch/1.0 (+https://hugslinks.com)";

const REQUEST_TIMEOUT = 15000;

const MAX_TEXT_LENGTH = 250000;

const MAX_PREVIEW_LENGTH = 420;


/* ============================================================
   JSON RESPONSE
============================================================ */

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


/* ============================================================
   LOAD HOUSING SOURCE REGISTRY
============================================================ */

function loadHousingSources() {
  const possiblePaths = [
    path.resolve(process.cwd(), "data", "housing-sources.json"),

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
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf8");

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed.sources)) {
          throw new Error(
            "housing-sources.json does not contain a sources array."
          );
        }

        return parsed;
      }
    } catch (error) {
      console.error(
        "Housing source registry error:",
        filePath,
        error
      );
    }
  }


  throw new Error(
    "Unable to locate data/housing-sources.json."
  );
}


/* ============================================================
   CLEAN HTML
============================================================ */

function cleanHtml(html = "") {
  return html

    /* Remove scripts */
    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      " "
    )

    /* Remove CSS */
    .replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      " "
    )

    /* Remove SVG */
    .replace(
      /<svg\b[^>]*>[\s\S]*?<\/svg>/gi,
      " "
    )

    /* Remove HTML comments */
    .replace(
      /<!--[\s\S]*?-->/g,
      " "
    )

    /* Remove tags */
    .replace(
      /<[^>]+>/g,
      " "
    )

    /* Common HTML entities */
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")

    /* Numeric entities */
    .replace(
      /&#(\d+);/g,
      (_, number) => {
        try {
          return String.fromCharCode(
            Number(number)
          );
        } catch {
          return " ";
        }
      }
    )

    /* Normalize whitespace */
    .replace(/\s+/g, " ")

    .trim();
}


/* ============================================================
   REMOVE COMMON WEBSITE NOISE

   This helps prevent navigation/footer/template edits from
   dominating the fingerprint.
============================================================ */

function normalizeForFingerprint(text = "") {
  return text
    .toLowerCase()

    .replace(
      /\b(last updated|updated|modified)\b[^.]{0,80}/gi,
      " "
    )

    .replace(
      /\bprivacy policy\b/gi,
      " "
    )

    .replace(
      /\baccessibility\b/gi,
      " "
    )

    .replace(
      /\bterms of use\b/gi,
      " "
    )

    .replace(
      /\bcopyright\b/gi,
      " "
    )

    .replace(/\s+/g, " ")

    .trim();
}


/* ============================================================
   HASH / FINGERPRINT
============================================================ */

function createFingerprint(text = "") {
  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");
}


/* ============================================================
   FIND KEYWORDS
============================================================ */

function findKeywords(text, keywords = []) {
  const lowerText =
    String(text || "").toLowerCase();

  return keywords.filter(keyword =>
    lowerText.includes(
      String(keyword).toLowerCase()
    )
  );
}


/* ============================================================
   CREATE RELEVANT PREVIEW

   Attempts to show text surrounding the first matching keyword.
============================================================ */

function createPreview(
  text,
  matchedKeywords = []
) {
  if (!text) {
    return "";
  }


  if (!matchedKeywords.length) {
    return text
      .slice(0, MAX_PREVIEW_LENGTH)
      .trim();
  }


  const lower =
    text.toLowerCase();

  const firstKeyword =
    matchedKeywords[0].toLowerCase();

  const position =
    lower.indexOf(firstKeyword);


  if (position === -1) {
    return text
      .slice(0, MAX_PREVIEW_LENGTH)
      .trim();
  }


  const start =
    Math.max(
      0,
      position - 130
    );


  const end =
    Math.min(
      text.length,
      position + MAX_PREVIEW_LENGTH
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


/* ============================================================
   FETCH WITH TIMEOUT
============================================================ */

async function fetchWithTimeout(url) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );


  try {
    const response =
      await fetch(url, {
        method: "GET",

        redirect: "follow",

        headers: {
          "User-Agent": USER_AGENT,

          Accept:
            "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"
        },

        signal: controller.signal
      });


    return response;
  }

  finally {
    clearTimeout(timer);
  }
}


/* ============================================================
   CHECK ONE HOUSING SOURCE
============================================================ */

async function checkSource(source) {
  const checkedAt =
    new Date().toISOString();


  try {
    const response =
      await fetchWithTimeout(
        source.url
      );


    /*
     * A redirect is allowed because fetch()
     * follows redirects.
     *
     * The final URL is returned so HUGS can identify
     * pages that government agencies move.
     */


    if (!response.ok) {
      return {
        id: source.id,

        name: source.name,

        agency: source.agency,

        category: source.category,

        priority: source.priority,

        source_url: source.url,

        final_url: response.url || source.url,

        checked_at: checkedAt,

        status: "source-error",

        http_status: response.status,

        relevant: false,

        matched_keywords: [],

        message:
          `Source returned HTTP ${response.status}. ` +
          "This does not mean the housing program changed."
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
        raw.replace(/\s+/g, " ");
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


    const relevant =
      matchedKeywords.length > 0;


    const normalized =
      normalizeForFingerprint(
        readableText
      );


    const fingerprint =
      createFingerprint(
        normalized
      );


    const preview =
      createPreview(
        readableText,
        matchedKeywords
      );


    return {
      id: source.id,

      name: source.name,

      agency: source.agency,

      category: source.category,

      priority: source.priority,

      source_url: source.url,

      final_url:
        response.url || source.url,

      checked_at: checkedAt,

      status: "checked",

      http_status:
        response.status,

      relevant,

      matched_keywords:
        matchedKeywords,

      fingerprint,

      preview,

      text_length:
        readableText.length,

      message:
        relevant
          ? "Housing-related terms were found on this official source."
          : "Source checked successfully, but no configured housing keywords were found."
    };
  }

  catch (error) {
    const timeout =
      error &&
      error.name === "AbortError";


    return {
      id: source.id,

      name: source.name,

      agency: source.agency,

      category: source.category,

      priority: source.priority,

      source_url: source.url,

      checked_at: checkedAt,

      status:
        timeout
          ? "timeout"
          : "source-error",

      relevant: false,

      matched_keywords: [],

      message:
        timeout
          ? "Source timed out. This does not indicate a housing-program change."
          : "Source could not be checked. This does not indicate a housing-program change.",

      error:
        error instanceof Error
          ? error.message
          : String(error)
    };
  }
}


/* ============================================================
   RUN WATCHER

   Checks sources sequentially.

   This is intentionally conservative so HUGSLinks does not
   hammer government websites with simultaneous requests.
============================================================ */

async function runHousingWatch() {
  const registry =
    loadHousingSources();


  const startedAt =
    new Date().toISOString();


  const results = [];


  for (
    const source of registry.sources
  ) {
    console.log(
      `HUGS Housing Watch checking: ${source.name}`
    );


    const result =
      await checkSource(source);


    results.push(result);
  }


  const completedAt =
    new Date().toISOString();


  const successful =
    results.filter(
      item =>
        item.status === "checked"
    );


  const relevant =
    successful.filter(
      item =>
        item.relevant
    );


  const errors =
    results.filter(
      item =>
        item.status !== "checked"
    );


  return {
    service:
      "HUGS Housing Watch",

    version:
      registry.version || 1,

    registry_title:
      registry.title,

    registry_last_manual_review:
      registry.last_manual_review,

    started_at:
      startedAt,

    completed_at:
      completedAt,

    summary: {
      sources:
        registry.sources.length,

      checked:
        successful.length,

      relevant:
        relevant.length,

      errors:
        errors.length
    },

    notice:
      "A detected webpage change is not automatically a verified housing-policy change. HUGSLinks should verify meaningful changes against the official source before presenting them as policy updates.",

    results
  };
}


/* ============================================================
   NETLIFY FUNCTION
============================================================ */

exports.handler =
  async function handler(event) {

    /*
     * Optional browser preflight support.
     */

    if (
      event &&
      event.httpMethod === "OPTIONS"
    ) {
      return {
        statusCode: 204,

        headers: {
          "Access-Control-Allow-Origin": "*",

          "Access-Control-Allow-Headers":
            "Content-Type",

          "Access-Control-Allow-Methods":
            "GET, OPTIONS"
        },

        body: ""
      };
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
        "HUGS Housing Watch fatal error:",
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
            "Housing Watch could not run.",

          error:
            error instanceof Error
              ? error.message
              : String(error)
        }
      );
    }
  };


/* ============================================================
   EXPORTS FOR FUTURE HISTORY FUNCTION
============================================================ */

exports.runHousingWatch =
  runHousingWatch;

exports.checkSource =
  checkSource;
