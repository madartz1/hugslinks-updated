import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

/*
 * HUGSLinks
 * Protected Recipient Live Tracking
 *
 * File:
 * netlify/functions/get-hug-live-tracking.mjs
 *
 * SECURITY
 * --------
 * - POST only.
 * - Requires private recipient tracking token.
 * - Plaintext token is never stored.
 * - Verifies SHA-256 token hash against an
 *   active HUG mission session.
 * - Never returns Helper identity.
 * - Never returns requester identity.
 * - Never returns pickup/destination addresses.
 * - Never returns route history.
 * - Returns only the current Helper location.
 * - Location must be fresh.
 * - Coordinates are reduced in precision before
 *   being returned to the recipient.
 * - Delivered missions return no coordinates.
 */


const SESSION_STORE_NAME =
  "hugs-help-mission-sessions";

const MISSION_STORE_NAME =
  "hugs-help-missions";

const LOCATION_STORE_NAME =
  "hugs-help-live-locations";


const SESSIONS_KEY =
  "sessions";

const MISSIONS_KEY =
  "missions";

/*
 * This matches the exact storage key used by
 * update-hug-helper-location.mjs.
 */
const LOCATIONS_KEY =
  "active-locations";


/*
 * Recipient location data older than this
 * is considered stale and is not displayed.
 */
const LOCATION_MAX_AGE_MS =
  2 * 60 * 1000;


const ACTIVE_STATUSES =
  new Set([
    "Accepted",
    "At Pickup",
    "Items Received",
    "On the Way"
  ]);


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
   TOKEN
========================================== */

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


function hashToken(token){

  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

}


function safeHashEqual(
  suppliedHash,
  storedHash
){

  if(
    typeof suppliedHash !== "string" ||
    typeof storedHash !== "string"
  ){
    return false;
  }


  const supplied =
    Buffer.from(
      suppliedHash,
      "utf8"
    );


  const stored =
    Buffer.from(
      storedHash,
      "utf8"
    );


  if(
    supplied.length !==
    stored.length
  ){
    return false;
  }


  return crypto.timingSafeEqual(
    supplied,
    stored
  );

}


/* ==========================================
   COLLECTION READER
========================================== */

async function readCollection(
  store,
  key,
  property
){

  const stored =
    await store.get(
      key,
      {
        type:"json",
        consistency:"strong"
      }
    );


  if(!stored){
    return [];
  }


  if(
    Array.isArray(
      stored[property]
    )
  ){
    return stored[property];
  }


  if(
    Array.isArray(stored)
  ){
    return stored;
  }


  return [];

}


/* ==========================================
   SAFE MISSION
========================================== */

function safeMission(mission){

  return {

    id:
      mission.id,

    type:
      mission.type || "",

    area:
      mission.area || "",

    city:
      mission.city || "",

    timing:
      mission.timing || "",

    status:
      mission.status || ""

  };

}


/* ==========================================
   COORDINATES
========================================== */

function validLatitude(value){

  return (
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  );

}


function validLongitude(value){

  return (
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );

}


/*
 * Recipient tracking does not need the same
 * coordinate precision used internally for
 * navigation.
 *
 * Four decimal places is approximately
 * neighborhood/block-level precision rather
 * than exposing unnecessary GPS precision.
 */
function reduceCoordinatePrecision(value){

  return Number(
    Number(value)
      .toFixed(4)
  );

}


/* ==========================================
   SAFE LOCATION
========================================== */

function safeLocation(location){

  const latitude =
    Number(
      location.latitude
    );


  const longitude =
    Number(
      location.longitude
    );


  if(
    !validLatitude(latitude) ||
    !validLongitude(longitude)
  ){
    return null;
  }


  const safe = {

    latitude:
      reduceCoordinatePrecision(
        latitude
      ),

    longitude:
      reduceCoordinatePrecision(
        longitude
      ),

    updated_at:
      location.updated_at

  };


  const heading =
    Number(
      location.heading
    );


  if(
    Number.isFinite(heading) &&
    heading >= 0 &&
    heading <= 360
  ){

    safe.heading =
      Math.round(
        heading
      );

  }


  const speed =
    Number(
      location.speed
    );


  if(
    Number.isFinite(speed) &&
    speed >= 0 &&
    speed <= 100
  ){

    safe.speed =
      Number(
        speed.toFixed(1)
      );

  }


  return safe;

}


/* ==========================================
   MAIN
========================================== */

export default async (
  request,
  context
) => {


  /* ======================================
     POST ONLY
  ====================================== */

  if(
    request.method !== "POST"
  ){

    return jsonResponse(
      {
        ok:false,
        error:"Method not allowed."
      },
      405
    );

  }


  try{


    /* ======================================
       REQUEST BODY
    ====================================== */

    let body;


    try{

      body =
        await request.json();

    }
    catch{

      return jsonResponse(
        {
          ok:false,
          error:"Invalid tracking request."
        },
        400
      );

    }


    const trackingToken =
      cleanToken(
        body?.tracking_token
      );


    if(!trackingToken){

      return jsonResponse(
        {
          ok:false,
          error:"Private tracking code required."
        },
        400
      );

    }


    /*
     * Current tracking credentials are
     * generated as 32 random bytes encoded
     * as 64 hexadecimal characters.
     */

    if(
      !/^[a-fA-F0-9]{64}$/
        .test(trackingToken)
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Invalid private tracking code."
        },
        401
      );

    }


    const suppliedHash =
      hashToken(
        trackingToken
      );


    /* ======================================
       FIND TRACKING SESSION
    ====================================== */

    const sessionStore =
      getStore(
        SESSION_STORE_NAME
      );


    const sessions =
      await readCollection(
        sessionStore,
        SESSIONS_KEY,
        "sessions"
      );


    let session =
      null;


    /*
     * Compare hashes using constant-time
     * comparison rather than a normal
     * string equality check.
     */

    for(
      const candidate
      of sessions
    ){

      if(
        candidate?.active !== true
      ){
        continue;
      }


      if(
        !candidate
          ?.tracking_token_hash
      ){
        continue;
      }


      if(
        safeHashEqual(
          suppliedHash,
          candidate.tracking_token_hash
        )
      ){

        session =
          candidate;

        break;

      }

    }


    if(!session){

      return jsonResponse(
        {
          ok:false,
          error:"Tracking access is invalid or no longer active."
        },
        401
      );

    }


    /* ======================================
       SESSION EXPIRATION
    ====================================== */

    const now =
      Date.now();


    const expiresAt =
      new Date(
        session.expires_at
      )
      .getTime();


    if(
      !Number.isFinite(
        expiresAt
      ) ||
      expiresAt <= now
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Tracking access has expired."
        },
        401
      );

    }


    /* ======================================
       LOAD MISSION
    ====================================== */

    const missionStore =
      getStore(
        MISSION_STORE_NAME
      );


    const missions =
      await readCollection(
        missionStore,
        MISSIONS_KEY,
        "missions"
      );


    const mission =
      missions.find(
        item =>
          String(
            item?.id || ""
          ) ===
          String(
            session.mission_id || ""
          )
      );


    if(!mission){

      return jsonResponse(
        {
          ok:false,
          error:"HUG Mission is unavailable."
        },
        404
      );

    }


    const missionSafe =
      safeMission(
        mission
      );


    /* ======================================
       DELIVERED
    ====================================== */

    if(
      mission.status ===
      "Delivered"
    ){

      /*
       * Deliberately return NO historical
       * Helper coordinates.
       */

      return jsonResponse(
        {

          ok:true,

          mission:
            missionSafe,

          live:false,

          location:null,

          completed:true

        }
      );

    }


    /* ======================================
       ACTIVE STATUS CHECK
    ====================================== */

    if(
      !ACTIVE_STATUSES.has(
        mission.status
      )
    ){

      return jsonResponse(
        {

          ok:true,

          mission:
            missionSafe,

          live:false,

          location:null,

          completed:false

        }
      );

    }


    /* ======================================
       ASSIGNMENT CHECK
    ====================================== */

    const assignedHelper =
      String(
        mission.assigned_helper_id || ""
      )
      .trim()
      .toUpperCase();


    const sessionHelper =
      String(
        session.helper_id || ""
      )
      .trim()
      .toUpperCase();


    if(
      !assignedHelper ||
      !sessionHelper ||
      assignedHelper !==
        sessionHelper
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Tracking session is no longer valid for this mission."
        },
        403
      );

    }


    /* ======================================
       LOAD CURRENT LOCATION
    ====================================== */

    const locationStore =
      getStore(
        LOCATION_STORE_NAME
      );


    const locations =
      await readCollection(
        locationStore,
        LOCATIONS_KEY,
        "locations"
      );


    const location =
      locations.find(
        item => {

          const sameMission =
            String(
              item?.mission_id || ""
            ) ===
            String(
              mission.id || ""
            );


          const sameHelper =
            String(
              item?.helper_id || ""
            )
            .trim()
            .toUpperCase()
            ===
            sessionHelper;


          return (
            sameMission &&
            sameHelper &&
            item?.sharing === true
          );

        }
      );


    if(!location){

      return jsonResponse(
        {

          ok:true,

          mission:
            missionSafe,

          live:false,

          location:null,

          completed:false

        }
      );

    }


    /* ======================================
       LOCATION FRESHNESS
    ====================================== */

    const locationTime =
      new Date(
        location.updated_at
      )
      .getTime();


    if(
      !Number.isFinite(
        locationTime
      ) ||
      now -
      locationTime >
      LOCATION_MAX_AGE_MS
    ){

      /*
       * Never return stale coordinates.
       */

      return jsonResponse(
        {

          ok:true,

          mission:
            missionSafe,

          live:false,

          location:null,

          completed:false

        }
      );

    }


    /* ======================================
       SANITIZE LOCATION
    ====================================== */

    const publicLocation =
      safeLocation(
        location
      );


    if(!publicLocation){

      return jsonResponse(
        {

          ok:true,

          mission:
            missionSafe,

          live:false,

          location:null,

          completed:false

        }
      );

    }


    /* ======================================
       LIVE
    ====================================== */

    return jsonResponse(
      {

        ok:true,

        mission:
          missionSafe,

        live:true,

        location:
          publicLocation,

        completed:false

      }
    );


  }
  catch(error){


    console.error(
      "HUG live tracking error:",
      error
    );


    return jsonResponse(
      {
        ok:false,

        error:
          "HUG tracking is temporarily unavailable."
      },
      500
    );

  }

};
