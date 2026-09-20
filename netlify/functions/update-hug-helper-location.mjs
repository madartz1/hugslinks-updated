import { getStore } from "@netlify/blobs";

/*
 * HUGSLinks
 * Active HUG Live Location Update
 *
 * File:
 * netlify/functions/update-hug-helper-location.mjs
 *
 * PURPOSE
 * -------
 * Receives location updates from an APPROVED
 * Helper during an ASSIGNED active HUG Mission.
 *
 * IMPORTANT
 * ---------
 * This information is PRIVATE.
 *
 * Never expose this store through:
 * hugs-missions.mjs
 *
 * Location sharing ends when:
 * - Helper stops sharing
 * - Mission is Delivered
 * - Mission is Canceled
 * - Helper is no longer approved
 */


const HELPER_STORE_NAME =
  "hugs-help-helpers";

const MISSION_STORE_NAME =
  "hugs-help-missions";

const LOCATION_STORE_NAME =
  "hugs-help-live-locations";


const HELPERS_KEY =
  "helpers";

const MISSIONS_KEY =
  "missions";

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
    "no-store, no-cache, must-revalidate"

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
   NUMBER
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
       IDENTITY
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


    const action =
      cleanText(
        body?.action,
        40
      );


    if(
      !missionId ||
      !helperId ||
      !helperEmail
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Mission and Helper verification are required."
        },
        400
      );

    }


    if(
      !validHelperId(helperId) ||
      !validEmail(helperEmail)
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Helper verification failed."
        },
        403
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
          .toUpperCase() ===
            helperId &&

          String(
            item?.email || ""
          )
          .trim()
          .toLowerCase() ===
            helperEmail
      );


    if(
      !helper ||
      helper.status !== "Approved"
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "This Helper is not currently approved."
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


    if(
      String(
        mission.assigned_helper_id || ""
      )
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


    const existingIndex =
      locations.findIndex(
        item =>
          item.mission_id ===
          missionId
      );


    /* ======================================
       STOP SHARING
    ====================================== */

    if(
      action === "stop"
    ){

      if(
        existingIndex !== -1
      ){

        locations.splice(
          existingIndex,
          1
        );


        await saveLocations(
          locationStore,
          locations
        );

      }


      return jsonResponse(
        {
          ok:true,

          message:
            "Live HUG location sharing stopped.",

          sharing:false
        }
      );

    }


    /* ======================================
       MISSION MUST BE ACTIVE
    ====================================== */

    if(
      !ACTIVE_STATUSES.has(
        mission.status
      )
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Live location sharing is only available during an active HUG Mission."
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
       OPTIONAL LOCATION INFORMATION
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


    let heading =
      Number(
        body?.heading
      );


    if(
      !Number.isFinite(
        heading
      )
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
      speed < 0
    ){

      speed =
        null;

    }


    const now =
      new Date()
        .toISOString();


    /* ======================================
       PRIVATE ACTIVE LOCATION
    ====================================== */

    const locationRecord = {

      mission_id:
        missionId,

      helper_id:
        helperId,

      latitude,

      longitude,

      accuracy,

      heading,

      speed,

      sharing:
        true,

      updated_at:
        now

    };


    /*
     * We intentionally store only the latest
     * active position here rather than creating
     * a permanent breadcrumb trail.
     *
     * This gives us live tracking without
     * unnecessarily building a detailed
     * historical location database.
     */


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


    return jsonResponse(
      {
        ok:true,

        sharing:true,

        mission_id:
          missionId,

        updated_at:
          now
      }
    );


  }
  catch(error){


    console.error(
      "HUG live location update error:",
      error
    );


    return jsonResponse(
      {
        ok:false,

        error:
          "HUG live location could not be updated."
      },
      500
    );

  }

};
