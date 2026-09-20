import { getStore } from "@netlify/blobs";

/*
 * HUGSLinks
 * Request to Accept a HUG Mission
 *
 * File:
 * netlify/functions/accept-hug-mission.mjs
 *
 * PURPOSE
 * -------
 * Allows a registered HUGS Helper to express
 * interest in an AVAILABLE HUG Mission.
 *
 * IMPORTANT:
 *
 * This does NOT automatically assign the mission.
 *
 * The connection is stored as:
 *
 * Pending Review
 *
 * HUGSLinks can approve the Helper / Mission
 * connection separately.
 */


const MISSION_STORE_NAME =
  "hugs-help-missions";

const MATCH_STORE_NAME =
  "hugs-help-matches";

const MISSIONS_KEY =
  "missions";

const MATCHES_KEY =
  "mission-match-requests";


const headers = {

  "Content-Type":
    "application/json; charset=utf-8",

  "Cache-Control":
    "no-store, no-cache, must-revalidate"

};


/* ==========================================
   RESPONSE HELPER
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
   VALIDATE EMAIL
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
   VALIDATE HELPER ID
========================================== */

function validHelperId(
  helperId
){

  /*
   * Expected:
   *
   * HELPER-2026-123456
   */

  return /^HELPER-\d{4}-\d{6}$/i
    .test(
      helperId
    );

}


/* ==========================================
   CREATE MATCH REQUEST ID
========================================== */

function createMatchId(){

  const now =
    new Date();


  const datePart =
    now
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
   READ MISSIONS
========================================== */

async function readMissions(
  store
){

  const stored =
    await store.get(
      MISSIONS_KEY,
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
      stored.missions
    )
  ){

    return stored.missions;

  }


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
   READ MATCH REQUESTS
========================================== */

async function readMatches(
  store
){

  const stored =
    await store.get(
      MATCHES_KEY,
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
      stored.matches
    )
  ){

    return stored.matches;

  }


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
   SAVE MATCH REQUESTS
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


    /* ----------------------------------------
       READ REQUEST BODY
    ---------------------------------------- */

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


    /* ----------------------------------------
       CLEAN VALUES
    ---------------------------------------- */

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


    /* ----------------------------------------
       REQUIRED FIELDS
    ---------------------------------------- */

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


    /* ----------------------------------------
       HELPER ID FORMAT
    ---------------------------------------- */

    if(
      !validHelperId(
        helperId
      )
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "The HUGS Helper reference number is not valid."
        },
        400
      );

    }


    /* ----------------------------------------
       EMAIL FORMAT
    ---------------------------------------- */

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


    /* ----------------------------------------
       LOAD MISSIONS
    ---------------------------------------- */

    const missionStore =
      getStore(
        MISSION_STORE_NAME
      );


    const missions =
      await readMissions(
        missionStore
      );


    /* ----------------------------------------
       FIND MISSION
    ---------------------------------------- */

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


    /* ----------------------------------------
       MUST BE APPROVED
    ---------------------------------------- */

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


    /* ----------------------------------------
       MUST STILL BE AVAILABLE
    ---------------------------------------- */

    if(
      mission.status !==
      "Available"
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


    /* ----------------------------------------
       LOAD MATCH REQUESTS
    ---------------------------------------- */

    const matchStore =
      getStore(
        MATCH_STORE_NAME
      );


    const matches =
      await readMatches(
        matchStore
      );


    /* ----------------------------------------
       PREVENT DUPLICATE REQUEST
    ---------------------------------------- */

    const existingMatch =
      matches.find(
        item =>

          item.mission_id ===
            missionId &&

          (
            item.helper_id ===
              helperId ||

            item.helper_email ===
              helperEmail
          ) &&

          item.status !==
            "Declined" &&

          item.status !==
            "Canceled"
      );


    if(
      existingMatch
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "You have already requested this HUG Mission.",

          match_id:
            existingMatch.id,

          status:
            existingMatch.status
        },
        409
      );

    }


    /* ----------------------------------------
       CREATE PENDING MATCH
    ---------------------------------------- */

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
        new Date()
          .toISOString(),

      reviewed_at:
        null,

      assigned_at:
        null

    };


    matches.push(
      matchRequest
    );


    /* ----------------------------------------
       SAVE
    ---------------------------------------- */

    await saveMatches(
      matchStore,
      matches
    );


    /*
     * IMPORTANT:
     *
     * We DO NOT change the mission from
     * Available to Accepted here.
     *
     * Multiple Helpers may express interest.
     *
     * HUGSLinks decides which Helper is
     * appropriate before assignment.
     */


    return jsonResponse(
      {
        ok:true,

        message:
          "Your request to help with this HUG Mission has been received.",

        match_id:
          matchRequest.id,

        status:
          matchRequest.status
      },
      201
    );


  }
  catch(error){


    console.error(
      "Accept HUG Mission error:",
      error
    );


    return jsonResponse(
      {
        ok:false,

        error:
          "We could not process this HUG Mission request right now."
      },
      500
    );

  }

};
