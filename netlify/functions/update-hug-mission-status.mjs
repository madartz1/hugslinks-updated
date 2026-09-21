import { getStore } from "@netlify/blobs";

/*
 * HUGSLinks
 * Assigned Helper Mission Status
 *
 * File:
 * netlify/functions/update-hug-mission-status.mjs
 *
 * STATUS JOURNEY
 * --------------
 * Accepted
 * At Pickup
 * Items Received
 * On the Way
 * Delivered
 *
 * Only the assigned, approved Helper
 * may update the mission.
 *
 * DELIVERY PRIVACY
 * ----------------
 * When a mission becomes Delivered:
 *
 * - Final Delivered status is saved.
 * - Current Helper live location is removed.
 * - Matching active mission sessions are ended.
 * - Recipient tracking therefore cannot continue.
 * - No historical location data is retained here.
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

/*
 * Must match:
 * update-hug-helper-location.mjs
 */
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
    "nosniff"

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
   EMAIL
========================================== */

function validEmail(email){

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);

}


/* ==========================================
   HELPER ID
========================================== */

function validHelperId(
  helperId
){

  return /^HELPER-\d{4}-\d{6}$/i
    .test(helperId);

}


/* ==========================================
   MISSION ID
========================================== */

function validMissionId(
  missionId
){

  return /^HUG-\d{4}-[A-Za-z0-9-]{4,40}$/
    .test(missionId);

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
    position === -1
  ){

    return null;

  }


  if(
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


  /* ======================================
     END ACTIVE SESSIONS
  ====================================== */

  let sessionsChanged =
    false;


  for(
    const session
    of sessions
  ){

    const sameMission =
      String(
        session?.mission_id || ""
      ) ===
      String(
        missionId
      );


    const sameHelper =
      String(
        session?.helper_id || ""
      )
      .trim()
      .toUpperCase()
      ===
      String(
        helperId
      )
      .trim()
      .toUpperCase();


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

      sessionsChanged =
        true;

    }

  }


  /* ======================================
     REMOVE LIVE LOCATION
  ====================================== */

  const filteredLocations =
    locations.filter(
      location => {

        const sameMission =
          String(
            location?.mission_id || ""
          ) ===
          String(
            missionId
          );


        const sameHelper =
          String(
            location?.helper_id || ""
          )
          .trim()
          .toUpperCase()
          ===
          String(
            helperId
          )
          .trim()
          .toUpperCase();


        /*
         * Remove matching live-location
         * entry on delivery.
         */

        return !(
          sameMission &&
          sameHelper
        );

      }
    );


  const locationsChanged =
    filteredLocations.length !==
    locations.length;


  const writes =
    [];


  if(sessionsChanged){

    writes.push(
      saveSessions(
        sessionStore,
        sessions
      )
    );

  }


  if(locationsChanged){

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
      sessionsChanged,

    location_removed:
      locationsChanged

  };

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
       BODY
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


    const helperId =
      cleanText(
        body?.helper_id,
        80
      )
      .toUpperCase();


    const helperEmail =
      cleanText(
        body?.helper_email,
        254
      )
      .toLowerCase();


    const requestedStatus =
      cleanText(
        body?.status,
        80
      );


    if(
      !missionId ||
      !helperId ||
      !helperEmail ||
      !requestedStatus
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "Mission, Helper ID, email and status are required."

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
          error:"Invalid HUG Mission number."
        },
        400
      );

    }


    if(
      !validHelperId(
        helperId
      )
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Invalid HUGS Helper reference number."
        },
        400
      );

    }


    if(
      !validEmail(
        helperEmail
      )
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Invalid email address."
        },
        400
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
          error:"Invalid HUG Mission status."
        },
        400
      );

    }


    /* ======================================
       VERIFY HELPER
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
          .toUpperCase()
          ===
          helperId &&

          String(
            item?.email || ""
          )
          .trim()
          .toLowerCase()
          ===
          helperEmail
      );


    if(!helper){

      return jsonResponse(
        {

          ok:false,

          error:
            "We could not verify this HUGS Helper registration."

        },
        403
      );

    }


    /* ======================================
       HELPER MUST STILL BE APPROVED
    ====================================== */

    if(
      helper.status !==
      "Approved"
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "This HUGS Helper is not currently approved for missions."

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
      .trim()
      .toUpperCase()
      !==
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
       STATUS VALIDATION
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
     * Helpers cannot skip mission stages.
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
       UPDATE STATUS
    ====================================== */

    const now =
      new Date()
        .toISOString();


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
       SAVE FINAL MISSION STATUS
    ====================================== */

    await saveMissions(
      missionStore,
      missions
    );


    /* ======================================
       DELIVERY PRIVACY SHUTDOWN
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
         * The mission has already been saved
         * as Delivered.
         *
         * get-hug-live-tracking.mjs also
         * treats Delivered as a hard privacy
         * boundary and returns no coordinates,
         * even if cleanup encounters a temporary
         * storage error.
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
