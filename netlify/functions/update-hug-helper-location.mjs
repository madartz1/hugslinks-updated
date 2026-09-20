import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

/*
 * HUGSLinks
 * Secure Live Helper Location
 *
 * File:
 * netlify/functions/update-hug-helper-location.mjs
 *
 * SECURITY
 * --------
 * Requires:
 * - Mission ID
 * - Active Helper session token
 *
 * Stores ONLY the latest active location.
 *
 * No permanent GPS breadcrumb history.
 */


const MISSION_STORE_NAME =
  "hugs-help-missions";

const SESSION_STORE_NAME =
  "hugs-help-mission-sessions";

const LOCATION_STORE_NAME =
  "hugs-help-live-locations";


const MISSIONS_KEY =
  "missions";

const SESSIONS_KEY =
  "sessions";

const LOCATIONS_KEY =
  "active-locations";


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
    "no-cache"

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
   CLEAN
========================================== */

function cleanText(
  value,
  maxLength = 250
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
      maxLength
    );

}


/* ==========================================
   TOKEN HASH
========================================== */

function hashToken(token){

  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

}


/* ==========================================
   COORDINATE
========================================== */

function validCoordinate(
  value,
  minimum,
  maximum
){

  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );

}


/* ==========================================
   COLLECTION
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
   SAVE LOCATIONS
========================================== */

async function saveLocations(
  store,
  locations
){

  await store.setJSON(
    LOCATIONS_KEY,
    {

      updated_at:
        new Date()
          .toISOString(),

      locations

    }
  );

}


/* ==========================================
   SAVE SESSIONS
========================================== */

async function saveSessions(
  store,
  sessions
){

  await store.setJSON(
    SESSIONS_KEY,
    {

      updated_at:
        new Date()
          .toISOString(),

      sessions

    }
  );

}


/* ==========================================
   REMOVE LOCATION
========================================== */

async function removeLocation(
  locationStore,
  locations,
  missionId
){

  const remaining =
    locations.filter(
      item =>
        item.mission_id !==
        missionId
    );


  if(
    remaining.length !==
    locations.length
  ){

    await saveLocations(
      locationStore,
      remaining
    );

  }

}


/* ==========================================
   MAIN
========================================== */

export default async (
  request,
  context
) => {


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


    let body;


    try{

      body =
        await request.json();

    }
    catch(error){

      return jsonResponse(
        {
          ok:false,
          error:"Invalid request."
        },
        400
      );

    }


    /* ======================================
       INPUT
    ====================================== */

    const missionId =
      cleanText(
        body?.mission_id,
        120
      );


    const helperToken =
      cleanText(
        body?.helper_token,
        200
      );


    const action =
      cleanText(
        body?.action,
        40
      )
      .toLowerCase();


    if(
      !missionId ||
      !helperToken
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Mission and secure Helper session are required."
        },
        400
      );

    }


    if(
      action !== "update" &&
      action !== "stop"
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Invalid location action."
        },
        400
      );

    }


    /* ======================================
       VERIFY SESSION
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


    const helperTokenHash =
      hashToken(
        helperToken
      );


    const sessionIndex =
      sessions.findIndex(
        item =>

          item.mission_id ===
            missionId &&

          item.helper_token_hash ===
            helperTokenHash
      );


    if(
      sessionIndex === -1
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Invalid HUG Mission session."
        },
        403
      );

    }


    const session =
      sessions[
        sessionIndex
      ];


    if(
      session.active !== true
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "This HUG Mission session is no longer active."
        },
        403
      );

    }


    /* ======================================
       SESSION EXPIRATION
    ====================================== */

    const expiration =
      new Date(
        session.expires_at
      )
      .getTime();


    if(
      !Number.isFinite(
        expiration
      ) ||
      expiration <= Date.now()
    ){

      session.active =
        false;

      session.ended_at =
        new Date()
          .toISOString();

      session.ended_reason =
        "Session expired";


      await saveSessions(
        sessionStore,
        sessions
      );


      /*
       * Remove any last live location
       * for the expired session.
       */

      const expiredLocationStore =
        getStore(
          LOCATION_STORE_NAME
        );


      const expiredLocations =
        await readCollection(
          expiredLocationStore,
          LOCATIONS_KEY,
          "locations"
        );


      await removeLocation(
        expiredLocationStore,
        expiredLocations,
        missionId
      );


      return jsonResponse(
        {
          ok:false,

          error:
            "This HUG Mission session has expired. Open the mission again."
        },
        403
      );

    }


    /* ======================================
       VERIFY MISSION
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
          ) === missionId
      );


    if(!mission){

      return jsonResponse(
        {
          ok:false,
          error:"HUG Mission not found."
        },
        404
      );

    }


    /* ======================================
       VERIFY ASSIGNMENT
    ====================================== */

    if(
      String(
        mission.assigned_helper_id ||
        ""
      )
      .toUpperCase() !==
      String(
        session.helper_id ||
        ""
      )
      .toUpperCase()
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "This secure session is not authorized for this HUG Mission."
        },
        403
      );

    }


    /* ======================================
       LOCATION STORE
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


    /* ======================================
       STOP
    ====================================== */

    if(
      action === "stop"
    ){

      await removeLocation(
        locationStore,
        locations,
        missionId
      );


      return jsonResponse(
        {
          ok:true,

          mission_id:
            missionId,

          sharing:false,

          message:
            "Live HUG location sharing stopped."
        }
      );

    }


    /* ======================================
       ACTIVE MISSION ONLY
    ====================================== */

    if(
      !ACTIVE_STATUSES.has(
        mission.status
      )
    ){

      /*
       * If the mission is no longer active,
       * remove any stored position.
       */

      await removeLocation(
        locationStore,
        locations,
        missionId
      );


      return jsonResponse(
        {
          ok:false,

          error:
            "Live location sharing is not available for this mission status."
        },
        409
      );

    }


    /* ======================================
       COORDINATES
    ====================================== */

    const latitude =
      Number(
        body?.latitude
      );


    const longitude =
      Number(
        body?.longitude
      );


    if(
      !validCoordinate(
        latitude,
        -90,
        90
      ) ||
      !validCoordinate(
        longitude,
        -180,
        180
      )
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Valid location coordinates are required."
        },
        400
      );

    }


    /* ======================================
       OPTIONAL GPS DATA
    ====================================== */

    let accuracy =
      Number(
        body?.accuracy
      );


    if(
      !Number.isFinite(
        accuracy
      ) ||
      accuracy < 0
    ){

      accuracy =
        null;

    }


    /*
     * Reject obviously unusable accuracy.
     *
     * 10 km+ accuracy generally does not
     * provide meaningful live delivery
     * tracking.
     */

    if(
      accuracy !== null &&
      accuracy > 10000
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "The current location is not accurate enough for live HUG tracking."
        },
        422
      );

    }


    let heading =
      Number(
        body?.heading
      );


    if(
      !Number.isFinite(
        heading
      ) ||
      heading < 0 ||
      heading > 360
    ){

      heading =
        null;

    }


    let speed =
      Number(
        body?.speed
      );


    if(
      !Number.isFinite(
        speed
      ) ||
      speed < 0 ||
      speed > 100
    ){

      speed =
        null;

    }


    /* ======================================
       TIMESTAMP
    ====================================== */

    const now =
      new Date();


    const nowISO =
      now.toISOString();


    /* ======================================
       PRIVATE LOCATION RECORD
    ====================================== */

    const locationRecord = {

      mission_id:
        missionId,

      helper_id:
        session.helper_id,

      latitude,

      longitude,

      accuracy,

      heading,

      speed,

      sharing:
        true,

      updated_at:
        nowISO

    };


    /*
     * ONE current location per mission.
     *
     * No route history is retained here.
     */

    const existingIndex =
      locations.findIndex(
        item =>
          item.mission_id ===
          missionId
      );


    if(
      existingIndex === -1
    ){

      locations.push(
        locationRecord
      );

    }
    else{

      locations[
        existingIndex
      ] =
        locationRecord;

    }


    await saveLocations(
      locationStore,
      locations
    );


    /* ======================================
       SUCCESS
    ====================================== */

    return jsonResponse(
      {
        ok:true,

        mission_id:
          missionId,

        sharing:true,

        updated_at:
          nowISO
      }
    );


  }
  catch(error){


    console.error(
      "Secure HUG location error:",
      error
    );


    return jsonResponse(
      {
        ok:false,

        error:
          "Live HUG location could not be updated."
      },
      500
    );

  }

};
