/* =========================================================
   HUGSLINKS HOUSING WATCH
   Netlify Function

   Purpose:
   - Read the HUGS housing source configuration
   - Visit official housing/government sources
   - Detect relevant housing information
   - Return a clean JSON feed for housing-help.html

   No API key required.
========================================================= */


const SOURCES = [

  {
    id: "cityfheps",
    name: "NYC HRA — CityFHEPS",
    agency: "NYC Human Resources Administration",
    url:
      "https://www.nyc.gov/site/hra/help/cityfheps.page",
    category: "rental-assistance",
    priority: "high",
    keywords: [
      "cityfheps",
      "rental assistance",
      "shopping letter",
      "voucher",
      "eligibility",
      "renewal"
    ]
  },


  {
    id: "hra-rental-assistance",
    name: "NYC HRA — Rental Assistance",
    agency: "NYC Human Resources Administration",
    url:
      "https://www.nyc.gov/site/hra/help/rental-assistance.page",
    category: "rental-assistance",
    priority: "high",
    keywords: [
      "cityfheps",
      "fheps",
      "pathway home",
      "sota",
      "hud-vash",
      "rental assistance"
    ]
  },


  {
    id: "homebase",
    name: "NYC DHS — Homebase",
    agency: "NYC Department of Homeless Services",
    url:
      "https://www.nyc.gov/site/dhs/prevention/homebase.page",
    category: "homelessness-prevention",
    priority: "high",
    keywords: [
      "homebase",
      "eviction",
      "homelessness",
      "rent arrears",
      "prevention",
      "relocation"
    ]
  },


  {
    id: "nycha-section8",
    name: "NYCHA — Section 8",
    agency: "New York City Housing Authority",
    url:
      "https://www.nyc.gov/site/nycha/section-8/applicants.page",
    category: "voucher",
    priority: "high",
    keywords: [
      "section 8",
      "waitlist",
      "waiting list",
      "voucher",
      "emergency housing voucher",
      "ehv"
    ]
  },


  {
    id: "nycha-news",
    name: "NYCHA News",
    agency: "New York City Housing Authority",
    url:
      "https://www.nyc.gov/site/nycha/about/news.page",
    category: "public-housing",
    priority: "medium",
    keywords: [
      "housing",
      "section 8",
      "resident",
      "voucher",
      "rent",
      "transfer"
    ]
  },


  {
    id: "hpd-news",
    name: "NYC HPD Housing News",
    agency:
      "NYC Housing Preservation and Development",
    url:
      "https://www.nyc.gov/site/hpd/news/news.page",
    category: "affordable-housing",
    priority: "high",
    keywords: [
      "affordable housing",
      "housing connect",
      "rental",
      "apartment",
      "tenant",
      "homeless",
      "housing"
    ]
  },


  {
    id: "mitchell-lama",
    name: "Mitchell-Lama",
    agency:
      "NYC Housing Preservation and Development",
    url:
      "https://www.nyc.gov/site/hpd/services-and-information/mitchell-lama-program.page",
    category: "affordable-housing",
    priority: "medium",
    keywords: [
      "mitchell-lama",
      "lottery",
      "waiting list",
      "housing connect"
    ]
  },


  {
    id: "nyc-council",
    name: "NYC Council Housing Policy",
    agency: "New York City Council",
    url:
      "https://council.nyc.gov/press/",
    category: "policy",
    priority: "medium",
    keywords: [
      "cityfheps",
      "housing",
      "homeless",
      "rent",
      "tenant",
      "eviction",
      "voucher"
    ]
  },


  {
    id: "hud-news",
    name: "U.S. HUD Housing News",
    agency:
      "U.S. Department of Housing and Urban Development",
    url:
      "https://www.hud.gov/news",
    category: "federal",
    priority: "medium",
    keywords: [
      "homelessness",
      "section 8",
      "housing voucher",
      "public housing",
      "fair housing",
      "affordable housing",
      "rental assistance"
    ]
  }

];



/* =========================================================
   BASIC HTML CLEANER
========================================================= */

function decodeEntities(text = "") {

  return text

    .replace(/&nbsp;/gi, " ")

    .replace(/&amp;/gi, "&")

    .replace(/&quot;/gi, "\"")

    .replace(/&#39;/gi, "'")

    .replace(/&apos;/gi, "'")

    .replace(/&lt;/gi, "<")

    .replace(/&gt;/gi, ">");

}



function stripHtml(html = "") {

  return decodeEntities(

    html

      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )

      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      )

      .replace(
        /<noscript[\s\S]*?<\/noscript>/gi,
        " "
      )

      .replace(
        /<[^>]+>/g,
        " "
      )

      .replace(
        /\s+/g,
        " "
      )

      .trim()

  );

}



/* =========================================================
   EXTRACT PAGE TITLE
========================================================= */

function getTitle(html = "") {

  const match =
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );


  if(!match){

    return "";

  }


  return stripHtml(
    match[1]
  );

}



/* =========================================================
   BUILD ABSOLUTE URL
========================================================= */

function absoluteUrl(
  href,
  base
){

  if(!href){

    return null;

  }


  if(
    href.startsWith(
      "javascript:"
    )
  ){

    return null;

  }


  if(
    href.startsWith(
      "#"
    )
  ){

    return null;

  }


  try{

    return new URL(
      href,
      base
    ).href;

  }catch(error){

    return null;

  }

}



/* =========================================================
   EXTRACT LINKS
========================================================= */

function extractLinks(
  html,
  source
){

  const links = [];


  const regex =
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;


  let match;


  while(
    (
      match =
        regex.exec(html)
    )
  ){

    const href =
      absoluteUrl(
        match[1],
        source.url
      );


    const text =
      stripHtml(
        match[2]
      );


    if(
      !href ||
      !text ||
      text.length < 12
    ){

      continue;

    }


    if(
      text.length > 260
    ){

      continue;

    }


    const lower =
      text.toLowerCase();


    let score = 0;


    source.keywords.forEach(
      keyword => {

        if(
          lower.includes(
            keyword.toLowerCase()
          )
        ){

          score++;

        }

      }
    );


    if(score === 0){

      continue;

    }


    links.push({

      title:
        text,

      url:
        href,

      score:
        score,

      source_id:
        source.id,

      source:
        source.name,

      agency:
        source.agency,

      category:
        source.category,

      priority:
        source.priority

    });

  }


  return links;

}



/* =========================================================
   REMOVE DUPLICATES
========================================================= */

function dedupeItems(
  items
){

  const seen =
    new Set();


  return items.filter(
    item => {

      const key =
        (
          item.title +
          "|" +
          item.url
        )
        .toLowerCase();


      if(
        seen.has(key)
      ){

        return false;

      }


      seen.add(key);


      return true;

    }
  );

}



/* =========================================================
   CREATE PAGE FINGERPRINT
========================================================= */

async function createFingerprint(
  text
){

  const bytes =
    new TextEncoder()
      .encode(text);


  const buffer =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );


  return Array.from(
    new Uint8Array(buffer)
  )

    .map(
      byte =>
        byte
          .toString(16)
          .padStart(2,"0")
    )

    .join("");

}



/* =========================================================
   READ ONE OFFICIAL SOURCE
========================================================= */

async function inspectSource(
  source
){

  try{


    const controller =
      new AbortController();


    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        9000
      );


    const response =
      await fetch(
        source.url,
        {

          headers:{

            "User-Agent":
              "HUGSLinks-Housing-Watch/1.0",

            "Accept":
              "text/html,application/xhtml+xml"

          },

          signal:
            controller.signal

        }
      );


    clearTimeout(
      timeout
    );


    if(
      !response.ok
    ){

      throw new Error(
        "HTTP " +
        response.status
      );

    }


    const html =
      await response.text();


    const text =
      stripHtml(html);


    const fingerprint =
      await createFingerprint(
        text.slice(
          0,
          150000
        )
      );


    const links =
      extractLinks(
        html,
        source
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

      official_url:
        source.url,

      page_title:
        getTitle(html),

      fingerprint:
        fingerprint,

      status:
        "ok",

      items:
        links

          .sort(
            (
              a,
              b
            ) =>
              b.score -
              a.score
          )

          .slice(
            0,
            5
          )

    };


  }catch(error){


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

      official_url:
        source.url,

      status:
        "unavailable",

      error:
        error.message,

      items:
        []

    };

  }

}



/* =========================================================
   NETLIFY HANDLER
========================================================= */

export default async function(){

  const checkedAt =
    new Date()
      .toISOString();


  const results =
    await Promise.all(
      SOURCES.map(
        inspectSource
      )
    );


  const available =
    results.filter(
      source =>
        source.status === "ok"
    );


  const unavailable =
    results.filter(
      source =>
        source.status !== "ok"
    );


  const items =
    dedupeItems(

      available
        .flatMap(
          source =>
            source.items
        )

    )

      .sort(
        (
          a,
          b
        ) => {

          const priorityWeight = {

            high:3,

            medium:2,

            low:1

          };


          const aPriority =
            priorityWeight[
              a.priority
            ] || 0;


          const bPriority =
            priorityWeight[
              b.priority
            ] || 0;


          if(
            aPriority !==
            bPriority
          ){

            return (
              bPriority -
              aPriority
            );

          }


          return (
            b.score -
            a.score
          );

        }
      )

      .slice(
        0,
        20
      );


  return Response.json(
    {

      success:
        true,

      service:
        "HUGS Housing Watch",

      checked_at:
        checkedAt,

      source_count:
        SOURCES.length,

      sources_available:
        available.length,

      sources_unavailable:
        unavailable.length,

      items:
        items,

      sources:
        results.map(
          source => ({

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

            official_url:
              source.official_url,

            page_title:
              source.page_title || null,

            fingerprint:
              source.fingerprint || null,

            status:
              source.status

          })
        ),

      notice:
        "HUGSLinks automatically checks official public sources. Housing rules and eligibility must always be confirmed with the responsible agency."

    },
    {

      headers:{

        "Cache-Control":
          "public, max-age=1800, s-maxage=21600",

        "Netlify-CDN-Cache-Control":
          "public, durable, s-maxage=21600"

      }

    }
  );

}
