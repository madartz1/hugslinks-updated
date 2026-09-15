/**
 * HUGSLinks Housing Watch
 * Public Housing Update Feed
 *
 * netlify/functions/housing-updates.js
 */

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "hugs-housing-watch";
const HISTORY_KEY = "housing-history";


function response(statusCode, payload) {
  return {
    statusCode,

    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*"
    },

    body: JSON.stringify(payload, null, 2)
  };
}


function emptyFeed() {
  return {
    service: "HUGS Housing Watch",
    status: "ready",
    last_checked: null,
    last_change: null,
    update_count: 0,
    updates: [],
    message:
      "Housing Watch is active. No verified source changes have been recorded yet."
  };
}


exports.handler = async function handler(event) {

  if (event?.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,

      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      },

      body: ""
    };
  }


  if (event?.httpMethod && event.httpMethod !== "GET") {
    return response(405, {
      error: "Method not allowed."
    });
  }


  try {

    const store = getStore(STORE_NAME);

    const history = await store.get(
      HISTORY_KEY,
      {
        type: "json"
      }
    );


    if (!history) {
      return response(
        200,
        emptyFeed()
      );
    }


    const updates =
      Array.isArray(history.updates)
        ? history.updates
        : [];


    return response(200, {

      service:
        "HUGS Housing Watch",

      status:
        "active",

      last_checked:
        history.last_checked || null,

      last_change:
        history.last_change || null,

      update_count:
        updates.length,

      updates:
        updates.slice(0, 50),

      notice:
        "HUGSLinks provides housing information for navigation and education. Always confirm eligibility, deadlines and program requirements with the official agency."

    });

  }

  catch (error) {

    console.error(
      "Housing Updates error:",
      error
    );


    return response(500, {

      service:
        "HUGS Housing Watch",

      status:
        "error",

      message:
        "Housing updates are temporarily unavailable."

    });

  }

};
