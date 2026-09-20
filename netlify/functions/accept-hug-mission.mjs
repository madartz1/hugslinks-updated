import { getStore } from "@netlify/blobs";

/*
 * HUGSLinks
 * Verified HUG Mission Interest / Matching
 *
 * File:
 * netlify/functions/accept-hug-mission.mjs
 *
 * FLOW
 * ----
 * Helper clicks "I Can Help"
 *      ↓
 * Helper ID + email submitted
 *      ↓
 * Private Helper registry verified
 *      ↓
 * Mission verified as Approved + Available
 *      ↓
 * Match request stored as Pending Review
 *      ↓
 * HUGS reviews before assignment
 *
 * IMPORTANT
 * ---------
 * This function DOES NOT automatically assign
 * the Helper to the mission.
 */


/* ==========================================
   STORE NAMES
========================================== */

const HELPER_STORE_NAME =
  "hugs-help-helpers";

const MISSION_STORE_NAME =
  "hugs-help-missions";

const MATCH_STORE_NAME =
  "hugs-help-matches";


/* ==========================================
   COLLECTION KEYS
========================================== */

const HELPERS_KEY =
  "helpers";

const MISSIONS_KEY =
  "missions";

const MATCHES_KEY =
  "mission-match-requests";


/* ==========================================
   RESPONSE HEADERS
========================================== */

const headers = {

  "Content-Type":
    "application/json; charset=utf-8",

  "Cache-Control":
    "no-store, no-cache, must-revalidate"

};


/* ==========================================
   JSON RESPONSE
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
   EMAIL VALIDATION
========================================== */

function validEmail(
  email
){

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(
      email
    );

}


/* ==========================================
   HELPER ID FORMAT
========================================== */

function validHelperId(
  helperId
){

  return /^HELPER-\d{4}-\d{6}$/i
    .test(
      helperId
    );

}


/* ==========================================
   MATCH ID
========================================== */

function createMatchId(){

  const datePart =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      )
      .replaceAll(
        "-",
        ""
      );


  const randomPart =
    crypto
      .randomUUID()
      .replaceAll(
        "-",
        ""
      )
      .slice(
        0,
        10
      )
      .toUpperCase();


  return (
    "MATCH-" +
    datePart +
    "-" +
    randomPart
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


  if(
    !stored
  ){

    return [];

  }


  if(
    Array.isArray(
      stored[property]
    )
  ){

    return stored[property];

  }


  /*
   * Migration tolerance.
   */

  if(
    Array.isArray(
      stored
    )
  ){

    return stored;

  }


  return [];

}


/* ==========================================
   SAVE MATCHES
========================================== */

async function saveMatches(
  store,
  matches
){

  await store.setJSON(
    MATCHES_KEY,
    {

      updated_at:
        new Date()
          .toISOString(),

      matches

    }
  );

}


/* ==========================================
   MAIN FUNCTION
========================================== */

export default async (
  request,
  context
) => {


  /* ----------------------------------------
     POST ONLY
  ---------------------------------------- */

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
       READ JSON
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

          error:
            "Invalid request."
        },
        400
      );

    }


    /* ======================================
       CLEAN VALUES
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


    /* ======================================
       REQUIRED VALUES
    ====================================== */

    if(
      !missionId ||
      !helperId ||
      !helperEmail
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Mission ID, Helper ID and email are required."
        },
        400
      );

    }


    /* ======================================
       HELPER ID FORMAT
    ====================================== */

    if(
      !validHelperId(
        helperId
      )
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Please enter a valid HUGS Helper reference number."
        },
        400
      );

    }


    /* ======================================
       EMAIL FORMAT
    ====================================== */

    if(
      !validEmail(
        helperEmail
      )
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Please enter a valid email address."
        },
        400
      );

    }


    /* ======================================
       VERIFY PRIVATE HELPER RECORD
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
        item => {

          const storedId =
            String(
              item?.id || ""
            )
            .toUpperCase();


          const storedEmail =
            String(
              item?.email || ""
            )
            .trim()
            .toLowerCase();


          return (
            storedId ===
              helperId &&

            storedEmail ===
              helperEmail
          );

        }
      );


    if(
      !helper
    ){

      /*
       * Deliberately do not reveal whether
       * the ID or email was the incorrect
       * piece of information.
       */

      return jsonResponse(
        {
          ok:false,

          error:
            "We could not verify this HUGS Helper registration. Check your Helper reference number and registered email."
        },
        403
      );

    }


    /* ======================================
       HELPER STATUS
    ====================================== */

    const helperStatus =
      String(
        helper.status || ""
      );


    /*
     * Phase 1 currently creates Helpers as
     * "Registered".
     *
     * Later we can add:
     * Approved
     * Paused
     * Suspended
     */

    if(
      helperStatus !== "Registered" &&
      helperStatus !== "Approved"
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "This HUGS Helper registration is not currently eligible for HUG Missions."
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

          error:
            "This HUG Mission could not be found."
        },
        404
      );

    }


    /* ======================================
       MISSION MUST BE APPROVED
    ====================================== */

    if(
      mission.approved !== true
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "This HUG Mission is not available."
        },
        409
      );

    }


    /* ======================================
       MISSION MUST BE AVAILABLE
    ====================================== */

    if(
      mission.status !== "Available"
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "This HUG Mission is no longer available."
        },
        409
      );

    }


    /* ======================================
       LOAD EXISTING MATCH REQUESTS
    ====================================== */

    const matchStore =
      getStore(
        MATCH_STORE_NAME
      );


    const matches =
      await readCollection(
        matchStore,
        MATCHES_KEY,
        "matches"
      );


    /* ======================================
       PREVENT DUPLICATE INTEREST
    ====================================== */

    const existingMatch =
      matches.find(
        item =>

          String(
            item?.mission_id || ""
          ) === missionId &&

          String(
            item?.helper_id || ""
          )
          .toUpperCase() ===
            helperId &&

          item.status !==
            "Declined" &&

          item.status !==
            "Canceled" &&

          item.status !==
            "Mission Assigned"
      );


    if(
      existingMatch
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "You have already requested to help with this HUG Mission.",

          match_id:
            existingMatch.id,

          status:
            existingMatch.status
        },
        409
      );

    }


    /* ======================================
       CREATE MATCH REQUEST
    ====================================== */

    const now =
      new Date()
        .toISOString();


    const matchRequest = {

      id:
        createMatchId(),

      mission_id:
        missionId,

      helper_id:
        helperId,

      helper_email:
        helperEmail,

      status:
        "Pending Review",

      created_at:
        now,

      reviewed_at:
        null,

      assigned_at:
        null

    };


    matches.push(
      matchRequest
    );


    /* ======================================
       SAVE
    ====================================== */

    await saveMatches(
      matchStore,
      matches
    );


    /*
     * IMPORTANT:
     *
     * The mission remains AVAILABLE here.
     *
     * Expressing interest is NOT assignment.
     *
     * The protected admin function later
     * approves one Helper.
     */


    return jsonResponse(
      {
        ok:true,

        message:
          "Your request to help with this HUG Mission has been received for review.",

        match_id:
          matchRequest.id,

        status:
          "Pending Review"
      },
      201
    );


  }
  catch(error){


    console.error(
      "Verified HUG Mission match error:",
      error
    );


    return jsonResponse(
      {
        ok:false,

        error:
          "We could not process your HUG Mission request right now."
      },
      500
    );

  }

};
