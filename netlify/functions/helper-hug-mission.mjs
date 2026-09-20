import { getStore } from "@netlify/blobs";

/*
 * HUGSLinks
 * Private Assigned Helper Mission Lookup
 *
 * File:
 * netlify/functions/helper-hug-mission.mjs
 *
 * PURPOSE
 * -------
 * Allows an approved HUGS Helper to open
 * ONLY a mission assigned to them.
 *
 * This endpoint is PRIVATE-facing.
 * It does not return requester identity,
 * phone, email, exact address, shelter
 * information, or the original private
 * HUG Request.
 */


const HELPER_STORE_NAME =
  "hugs-help-helpers";

const MISSION_STORE_NAME =
  "hugs-help-missions";


const HELPERS_KEY =
  "helpers";

const MISSIONS_KEY =
  "missions";


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

function validEmail(
  email
){

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
   SAFE MISSION
========================================== */

function safeMission(
  mission
){

  /*
   * IMPORTANT:
   *
   * Explicit allowlist.
   *
   * Do NOT replace this by returning
   * the entire mission object.
   *
   * This prevents future private fields
   * from accidentally reaching the
   * Helper's browser.
   */

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

    summary:
      mission.summary || "",

    status:
      mission.status || "",

    accepted_at:
      mission.accepted_at || null,

    at_pickup_at:
      mission.at_pickup_at || null,

    items_received_at:
      mission.items_received_at || null,

    on_the_way_at:
      mission.on_the_way_at || null,

    delivered_at:
      mission.delivered_at || null

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
     METHOD
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


    if(
      !missionId ||
      !helperId ||
      !helperEmail
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Mission Number, Helper Number and registered email are required."
        },
        400
      );

    }


    /* ======================================
       FORMAT VALIDATION
    ====================================== */

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
          error:"Invalid HUGS Helper number."
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


    /* ======================================
       LOAD HELPERS
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


    /* ======================================
       VERIFY HELPER
    ====================================== */

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
      !helper
    ){

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
       HELPER MUST BE APPROVED
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
       LOAD MISSIONS
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


    /* ======================================
       FIND MISSION
    ====================================== */

    const mission =
      missions.find(
        item =>
          String(
            item?.id || ""
          ) === missionId
      );


    if(
      !mission
    ){

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

    const assignedHelperId =
      String(
        mission.assigned_helper_id ||
        ""
      )
      .toUpperCase();


    if(
      assignedHelperId !==
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
       VALID ASSIGNED STATUS
    ====================================== */

    const allowedStatuses =
      new Set([
        "Accepted",
        "At Pickup",
        "Items Received",
        "On the Way",
        "Delivered"
      ]);


    if(
      !allowedStatuses.has(
        mission.status
      )
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "This HUG Mission is not currently available in the Helper Mission Center."
        },
        409
      );

    }


    /* ======================================
       SUCCESS
    ====================================== */

    return jsonResponse(
      {
        ok:true,

        helper:{
          id:helperId,

          status:
            helper.status
        },

        mission:
          safeMission(
            mission
          )
      }
    );


  }
  catch(error){


    console.error(
      "Helper HUG Mission lookup error:",
      error
    );


    return jsonResponse(
      {
        ok:false,

        error:
          "Your HUG Mission could not be opened right now."
      },
      500
    );

  }

};
