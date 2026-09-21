import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

/*
 * HUGSLinks
 * Secure Assigned Helper Mission Status
 *
 * File:
 * netlify/functions/update-hug-mission-status.mjs
 *
 * AUTHORIZATION
 * -------------
 * The Helper browser sends ONLY:
 *
 * - mission_id
 * - helper_token
 * - status
 *
 * Helper ID and email are NOT repeatedly sent.
 *
 * The temporary helper_token is verified against
 * the SHA-256 hash stored in the private mission
 * session.
 *
 * STATUS JOURNEY
 * --------------
 *
 * Accepted
 *   ↓
 * At Pickup
 *   ↓
 * Items Received
 *   ↓
 * On the Way
 *   ↓
 * Delivered
 *
 * DELIVERY PRIVACY
 * ----------------
 *
 * Delivered is a hard privacy boundary.
 *
 * When a mission becomes Delivered:
 *
 * - Delivered is saved first.
 * - Active mission sessions are ended.
 * - Current Helper location is removed.
 * - Recipient tracking becomes unusable.
 * - No location history is retained here.
 */


const HELPER_STORE_NAME =
  "hugs-help-helpers";

const MISSION_STORE_NAME =
  "hugs-help-missions";

const SESSION_STORE_NAME =
  "hugs-help-mission-sessions";

const LOCATION_STORE_NAME =
  "hugs-help-live-locations";


const HELPERS_KEY =
  "helpers";

const MISSIONS_KEY =
  "missions";

const SESSIONS_KEY =
  "sessions";

const LOCATIONS_KEY =
  "active-locations";


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
   CLEAN TEXT
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

  return /^HELPER-\d{4}-\d{6}$/i
    .test(helperId);

}


function validHelperToken(
  token
){

  return /^[a-f0-9]{64}$/i
    .test(token);

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
   TIMING SAFE HASH COMPARISON
========================================== */

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
   READ COLLECTION
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
   SAVE MISSIONS
========================================== */

async function saveMissions(
  store,
  missions
){

  await store.setJSON(
    MISSIONS_KEY,
    {

      updated_at:
        new Date()
          .toISOString(),

      missions

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
   STATUS ORDER
========================================== */

const STATUS_FLOW = [

  "Accepted",

  "At Pickup",

  "Items Received",

  "On the Way",

  "Delivered"

];


/* ==========================================
   NEXT STATUS
========================================== */

function nextStatus(
  currentStatus
){

  const position =
    STATUS_FLOW.indexOf(
      currentStatus
    );


  if(
    position === -1 ||
    position >=
      STATUS_FLOW.length - 1
  ){

    return null;

  }


  return STATUS_FLOW[
    position + 1
  ];

}


/* ==========================================
   REMOVE CURRENT LIVE LOCATION
========================================== */

async function removeMissionLocation(
  missionId,
  helperId
){

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


  const filtered =
    locations.filter(
      location => {

        const sameMission =
          String(
            location?.mission_id || ""
          ) ===
          missionId;


        const sameHelper =
          String(
            location?.helper_id || ""
          )
          .trim()
          .toUpperCase() ===
          helperId;


        return !(
          sameMission &&
          sameHelper
        );

      }
    );


  if(
    filtered.length ===
    locations.length
  ){

    return false;

  }


  await saveLocations(
    locationStore,
    filtered
  );


  return true;

}


/* ==========================================
   EXPIRED SESSION CLEANUP
========================================== */

async function expireSession(
  sessionStore,
  sessions,
  session,
  now,
  missionId,
  helperId
){

  session.active =
    false;

  session.ended_at =
    now;

  session.ended_reason =
    "Session expired";


  await saveSessions(
    sessionStore,
    sessions
  );


  try{

    await removeMissionLocation(
      missionId,
      helperId
    );

  }
  catch(error){

    console.error(
      "Expired HUG session location cleanup error:",
      error
    );

  }

}


/* ==========================================
   DELIVERY PRIVACY SHUTDOWN
========================================== */

async function closeDeliveredMission(
  missionId,
  helperId,
  now
){

  const sessionStore =
    getStore(
      SESSION_STORE_NAME
    );


  const locationStore =
    getStore(
      LOCATION_STORE_NAME
    );


  const [
    sessions,
    locations
  ] =
    await Promise.all([

      readCollection(
        sessionStore,
        SESSIONS_KEY,
        "sessions"
      ),

      readCollection(
        locationStore,
        LOCATIONS_KEY,
        "locations"
      )

    ]);


  let sessionsEnded =
    false;


  for(
    const session
    of sessions
  ){

    const sameMission =
      String(
        session?.mission_id || ""
      ) ===
      missionId;


    const sameHelper =
      String(
        session?.helper_id || ""
      )
      .trim()
      .toUpperCase() ===
      helperId;


    if(
      sameMission &&
      sameHelper &&
      session?.active === true
    ){

      session.active =
        false;

      session.ended_at =
        now;

      session.ended_reason =
        "Mission delivered";

      sessionsEnded =
        true;

    }

  }


  const filteredLocations =
    locations.filter(
      location => {

        const sameMission =
          String(
            location?.mission_id || ""
          ) ===
          missionId;


        const sameHelper =
          String(
            location?.helper_id || ""
          )
          .trim()
          .toUpperCase() ===
          helperId;


        return !(
          sameMission &&
          sameHelper
        );

      }
    );


  const locationRemoved =
    filteredLocations.length !==
    locations.length;


  const writes =
    [];


  if(sessionsEnded){

    writes.push(
      saveSessions(
        sessionStore,
        sessions
      )
    );

  }


  if(locationRemoved){

    writes.push(
      saveLocations(
        locationStore,
        filteredLocations
      )
    );

  }


  if(writes.length){

    await Promise.all(
      writes
    );

  }


  return {

    sessions_ended:
      sessionsEnded,

    location_removed:
      locationRemoved

  };

}


/* ==========================================
   MAIN
========================================== */

export default async request => {


  /* ======================================
     POST ONLY
  ====================================== */

  if(
    request.method !== "POST"
  ){

    return jsonResponse(
      {

        ok:false,

        error:
          "Method not allowed."

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

          error:
            "Invalid request."

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
        128
      );


    const requestedStatus =
      cleanText(
        body?.status,
        80
      );


    if(
      !missionId ||
      !helperToken ||
      !requestedStatus
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "Mission, secure Helper session and status are required."

        },
        400
      );

    }


    if(
      !validMissionId(
        missionId
      )
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "Invalid HUG Mission number."

        },
        400
      );

    }


    if(
      !validHelperToken(
        helperToken
      )
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "Invalid secure Helper session."

        },
        401
      );

    }


    if(
      !STATUS_FLOW.includes(
        requestedStatus
      )
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "Invalid HUG Mission status."

        },
        400
      );

    }


    /* ======================================
       LOAD SECURE SESSIONS
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


    const suppliedHash =
      hashToken(
        helperToken
      );


    /*
     * Find an active session for this mission
     * whose stored token hash matches the
     * supplied temporary Helper token.
     */

    const session =
      sessions.find(
        item => {

          if(
            item?.active !== true
          ){

            return false;

          }


          if(
            String(
              item?.mission_id || ""
            ) !==
            missionId
          ){

            return false;

          }


          return safeHashEqual(
            suppliedHash,
            String(
              item?.helper_token_hash ||
              ""
            )
          );

        }
      );


    if(!session){

      return jsonResponse(
        {

          ok:false,

          error:
            "This secure HUG Helper session is invalid or no longer active."

        },
        401
      );

    }


    /* ======================================
       SESSION HELPER
    ====================================== */

    const helperId =
      String(
        session.helper_id || ""
      )
      .trim()
      .toUpperCase();


    if(
      !validHelperId(
        helperId
      )
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "This secure HUG Helper session is invalid."

        },
        401
      );

    }


    /* ======================================
       SESSION EXPIRATION
    ====================================== */

    const expiresAt =
      new Date(
        session.expires_at
      )
      .getTime();


    const nowDate =
      new Date();


    const now =
      nowDate.toISOString();


    if(
      !Number.isFinite(
        expiresAt
      ) ||
      expiresAt <=
        nowDate.getTime()
    ){

      try{

        await expireSession(
          sessionStore,
          sessions,
          session,
          now,
          missionId,
          helperId
        );

      }
      catch(error){

        console.error(
          "Expired HUG session cleanup error:",
          error
        );

      }


      return jsonResponse(
        {

          ok:false,

          error:
            "This secure HUG Helper session has expired."

        },
        401
      );

    }


    /* ======================================
       VERIFY HELPER IS STILL APPROVED
    ====================================== */

    const helperStore =
      getStore(
        HELPER_STORE_NAME
      );


    const helpers =
      await readCollection(
        helperStore,
        HELPERS_KEY,
        "helpers"
      );


    const helper =
      helpers.find(
        item =>

          String(
            item?.id || ""
          )
          .trim()
          .toUpperCase() ===
          helperId
      );


    if(
      !helper ||
      helper.status !==
        "Approved"
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "This HUGS Helper is no longer approved for active missions."

        },
        403
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
          missionId
      );


    if(!mission){

      return jsonResponse(
        {

          ok:false,

          error:
            "HUG Mission not found."

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
      .trim()
      .toUpperCase() !==
      helperId
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "This HUG Mission is not assigned to this Helper."

        },
        403
      );

    }


    /* ======================================
       STATUS FLOW VALIDATION
    ====================================== */

    const expectedStatus =
      nextStatus(
        mission.status
      );


    if(!expectedStatus){

      if(
        mission.status ===
        "Delivered"
      ){

        return jsonResponse(
          {

            ok:false,

            error:
              "This HUG Mission has already been delivered."

          },
          409
        );

      }


      return jsonResponse(
        {

          ok:false,

          error:
            "This mission cannot be advanced from its current status."

        },
        409
      );

    }


    /*
     * No skipped stages.
     */

    if(
      requestedStatus !==
      expectedStatus
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "The next mission status must be: " +
            expectedStatus

        },
        409
      );

    }


    /* ======================================
       UPDATE MISSION
    ====================================== */

    const previousStatus =
      mission.status;


    mission.status =
      requestedStatus;

    mission.updated_at =
      now;


    /* ======================================
       STATUS TIMESTAMPS
    ====================================== */

    if(
      requestedStatus ===
      "At Pickup"
    ){

      mission.at_pickup_at =
        now;

    }


    if(
      requestedStatus ===
      "Items Received"
    ){

      mission.items_received_at =
        now;

    }


    if(
      requestedStatus ===
      "On the Way"
    ){

      mission.on_the_way_at =
        now;

    }


    if(
      requestedStatus ===
      "Delivered"
    ){

      mission.delivered_at =
        now;

    }


    /* ======================================
       STATUS HISTORY
    ====================================== */

    if(
      !Array.isArray(
        mission.status_history
      )
    ){

      mission.status_history =
        [];

    }


    mission.status_history.push({

      from:
        previousStatus,

      to:
        requestedStatus,

      changed_at:
        now,

      changed_by:
        helperId

    });


    /* ======================================
       SAVE STATUS FIRST
    ====================================== */

    await saveMissions(
      missionStore,
      missions
    );


    /* ======================================
       DELIVERED PRIVACY SHUTDOWN
    ====================================== */

    let privacyShutdown = {

      sessions_ended:false,

      location_removed:false

    };


    if(
      requestedStatus ===
      "Delivered"
    ){

      try{

        privacyShutdown =
          await closeDeliveredMission(
            mission.id,
            helperId,
            now
          );

      }
      catch(cleanupError){

        /*
         * Delivered has already been saved.
         *
         * Recipient tracking and Helper routing
         * must independently reject Delivered
         * missions even if Blob cleanup briefly
         * fails.
         */

        console.error(
          "HUG delivery privacy cleanup error:",
          cleanupError
        );

      }

    }


    /* ======================================
       SUCCESS
    ====================================== */

    return jsonResponse(
      {

        ok:true,

        message:
          requestedStatus ===
          "Delivered"

            ?

            "HUG Delivered ❤️"

            :

            "Mission status updated.",

        mission_id:
          mission.id,

        status:
          mission.status,

        next_status:
          nextStatus(
            mission.status
          ),

        updated_at:
          now,

        tracking_closed:
          requestedStatus ===
          "Delivered",

        live_location_closed:
          requestedStatus ===
          "Delivered",

        session_closed:
          requestedStatus ===
          "Delivered",

        privacy_cleanup:
          requestedStatus ===
          "Delivered"

            ?

            privacyShutdown

            :

            undefined

      }
    );


  }
  catch(error){


    console.error(
      "HUG Mission status error:",
      error
    );


    return jsonResponse(
      {

        ok:false,

        error:
          "We could not update this HUG Mission right now."

      },
      500
    );

  }

};
