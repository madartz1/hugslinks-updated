import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

/*
 * HUGSLinks
 * Secure Helper Route Access + Mapbox Routing
 *
 * FILE:
 * netlify/functions/get-hug-route.mjs
 *
 * PRIVACY FLOW
 * ------------
 *
 * Accepted
 *   -> Helper -> Pickup
 *
 * At Pickup
 *   -> Helper -> Pickup
 *
 * Items Received
 *   -> Helper -> Destination
 *
 * On the Way
 *   -> Helper -> Destination
 *
 * Delivered
 *   -> Private route closed
 *
 * SECURITY
 * --------
 *
 * - Requires mission_id + temporary helper_token.
 * - Plaintext Helper token is never stored.
 * - Token hash is compared safely.
 * - Session must be active and unexpired.
 * - Session must belong to this exact Mission.
 * - Session Helper must still be assigned.
 * - Helper must still be Approved.
 * - Only a fresh, actively shared location is used.
 * - Destination is never returned before
 *   "Items Received".
 * - MAPBOX_ACCESS_TOKEN remains server-side.
 */


/* ==========================================
   STORES
========================================== */

const HELPER_STORE_NAME =
  "hugs-help-helpers";

const SESSION_STORE_NAME =
  "hugs-help-mission-sessions";

const MISSION_STORE_NAME =
  "hugs-help-missions";

const ROUTE_STORE_NAME =
  "hugs-help-private-routes";

const LOCATION_STORE_NAME =
  "hugs-help-live-locations";


/* ==========================================
   KEYS
========================================== */

const HELPERS_KEY =
  "helpers";

const SESSIONS_KEY =
  "sessions";

const MISSIONS_KEY =
  "missions";

const ROUTES_KEY =
  "routes";

/*
 * IMPORTANT:
 *
 * This MUST match
 * update-hug-helper-location.mjs.
 */
const LOCATIONS_KEY =
  "active-locations";


/* ==========================================
   CONSTANTS
========================================== */

const LOCATION_MAX_AGE_MS =
  2 * 60 * 1000;


const ACTIVE_STATUSES =
  new Set([
    "Accepted",
    "At Pickup",
    "Items Received",
    "On the Way"
  ]);


/* ==========================================
   HEADERS
========================================== */

const headers = {

  "Content-Type":
    "application/json; charset=utf-8",

  "Cache-Control":
    "no-store, no-cache, must-revalidate",

  "Pragma":
    "no-cache",

  "Expires":
    "0",

  "X-Content-Type-Options":
    "nosniff",

  "Referrer-Policy":
    "no-referrer"

};


/* ==========================================
   RESPONSE
========================================== */

function jsonResponse(
  body,
  status = 200
){

  return new Response(
    JSON.stringify(body),
    {
      status,
      headers
    }
  );

}


/* ==========================================
   CLEAN INPUT
========================================== */

function cleanText(
  value,
  max = 250
){

  if(
    typeof value !== "string"
  ){

    return "";

  }


  return value
    .trim()
    .replace(
      /[\u0000-\u001F\u007F]/g,
      ""
    )
    .slice(
      0,
      max
    );

}


function cleanToken(value){

  if(
    typeof value !== "string"
  ){

    return "";

  }


  return value
    .trim()
    .slice(
      0,
      256
    );

}


/* ==========================================
   VALIDATION
========================================== */

function validMissionId(
  missionId
){

  return /^HUG-\d{4}-[A-Za-z0-9-]{4,40}$/
    .test(missionId);

}


function validHelperId(
  helperId
){

  return /^
