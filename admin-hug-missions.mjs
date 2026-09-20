import { getStore } from "@netlify/blobs";

/*
 * HUGSLinks
 * Admin HUG Mission Approval Layer
 *
 * File:
 * netlify/functions/admin-hug-missions.mjs
 *
 * PURPOSE
 * -------
 * Internal/server-side mission management.
 *
 * This endpoint can:
 *
 * 1. List private HUG Requests for review
 * 2. Approve a request and create a sanitized mission
 * 3. Hold a request
 * 4. Decline a request
 * 5. List pending Helper match requests
 * 6. Approve a Helper match
 * 7. Decline a Helper match
 *
 * SECURITY
 * --------
 * Requires a server-side environment variable:
 *
 * HUGS_ADMIN_TOKEN
 *
 * NEVER put that token inside public HTML,
 * JavaScript, GitHub source, or browser code.
 */


/* ==========================================
   STORES
========================================== */

const REQUEST_STORE_NAME =
  "hugs-help-requests";

const MISSION_STORE_NAME =
  "hugs-help-missions";

const MATCH_STORE_NAME =
  "hugs-help-matches";


const REQUESTS_KEY =
  "requests";

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
   CLEAN TEXT
========================================== */

function cleanText(
  value,
  maxLength = 500
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
   ADMIN AUTHORIZATION
========================================== */

function getAdminToken(
  request
){

  const auth =
    request.headers.get(
      "authorization"
    ) || "";


  if(
    auth.toLowerCase()
      .startsWith(
        "bearer "
      )
  ){

    return auth
      .slice(7)
      .trim();

  }


  return "";
}


function authorized(
  request
){

  const expectedToken =
    process.env
      .HUGS_ADMIN_TOKEN;


  /*
   * Fail closed if the server secret
   * has not been configured.
   */

  if(
    !expectedToken
  ){

    console.error(
      "HUGS_ADMIN_TOKEN is not configured."
    );

    return false;

  }


  const suppliedToken =
    getAdminToken(
      request
    );


  if(
    !suppliedToken
  ){

    return false;

  }


  /*
   * Straight comparison is sufficient for this
   * phase because this endpoint will be replaced
   * by authenticated admin accounts later.
   */

  return suppliedToken ===
    expectedToken;

}


/* ==========================================
   GENERATE MISSION ID
========================================== */

function createMissionId(){

  const year =
    new Date()
      .getFullYear();


  const random =
    crypto
      .randomUUID()
      .replaceAll(
        "-",
        ""
      )
      .slice(
        0,
        8
      )
      .toUpperCase();


  return (
    "HUG-" +
    year +
    "-" +
    random
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
   SAVE COLLECTION
========================================== */

async function saveCollection(
  store,
  key,
  property,
  collection
){

  await store.setJSON(
    key,
    {
      updated_at:
        new Date()
          .toISOString(),

      [property]:
        collection
    }
  );

}


/* ==========================================
   FIND REQUEST
========================================== */

function findRequest(
  requests,
  requestId
){

  return requests.find(
    item =>
      String(
        item?.id || ""
      ) === requestId
  );

}


/* ==========================================
   FIND MISSION
========================================== */

function findMission(
  missions,
  missionId
){

  return missions.find(
    item =>
      String(
        item?.id || ""
      ) === missionId
  );

}


/* ==========================================
   FIND MATCH
========================================== */

function findMatch(
  matches,
  matchId
){

  return matches.find(
    item =>
      String(
        item?.id || ""
      ) === matchId
  );

}


/* ==========================================
   PUBLIC MISSION CREATOR
========================================== */

function createPublicMission(
  hugRequest,
  input
){

  /*
   * CRITICAL PRIVACY BOUNDARY
   *
   * Do NOT spread hugRequest into this object.
   *
   * We construct the public mission manually
   * so private fields cannot accidentally leak.
   */


  const type =
    cleanText(
      input.type ||
      hugRequest.request_type ||
      "Community Support",
      100
    );


  const city =
    cleanText(
      input.city ||
      hugRequest.city ||
      "",
      100
    );


  const area =
    cleanText(
      input.area ||
      hugRequest.borough_area ||
      "",
      100
    );


  const timing =
    cleanText(
      input.timing ||
      hugRequest.time_needed ||
      "Flexible",
      100
    );


  /*
   * Summary MUST be supplied/reviewed by HUGS.
   *
   * We intentionally do not automatically use
   * the requester's full request_details field.
   */

  const summary =
    cleanText(
      input.summary,
      600
    );


  if(
    !summary
  ){

    throw new Error(
      "A reviewed public mission summary is required."
    );

  }


  return {

    id:
      createMissionId(),

    type,

    city,

    area,

    timing,

    summary,

    status:
      "Available",

    approved:
      true,

    created_at:
      new Date()
        .toISOString(),

    /*
     * Internal linkage is intentionally kept
     * in storage.
     *
     * The public hugs-missions endpoint does
     * not allow this field through its
     * public-field whitelist.
     */

    source_request_id:
      String(
        hugRequest.id || ""
      )

  };

}


/* ==========================================
   LIST REQUESTS
========================================== */

async function listRequests(){

  const store =
    getStore(
      REQUEST_STORE_NAME
    );


  const requests =
    await readCollection(
      store,
      REQUESTS_KEY,
      "requests"
    );


  /*
   * Admin endpoint may see private request
   * information because this endpoint is
   * protected by server-side authorization.
   */

  return requests.sort(
    (a,b) => {

      const aTime =
        Date.parse(
          a.created_at || ""
        ) || 0;


      const bTime =
        Date.parse(
          b.created_at || ""
        ) || 0;


      return bTime - aTime;

    }
  );

}


/* ==========================================
   LIST MATCH REQUESTS
========================================== */

async function listMatches(){

  const store =
    getStore(
      MATCH_STORE_NAME
    );


  const matches =
    await readCollection(
      store,
      MATCHES_KEY,
      "matches"
    );


  return matches.sort(
    (a,b) => {

      const aTime =
        Date.parse(
          a.created_at || ""
        ) || 0;


      const bTime =
        Date.parse(
          b.created_at || ""
        ) || 0;


      return bTime - aTime;

    }
  );

}


/* ==========================================
   APPROVE HUG REQUEST
========================================== */

async function approveRequest(
  body
){

  const requestId =
    cleanText(
      body.request_id,
      120
    );


  if(
    !requestId
  ){

    return {
      status:400,

      body:{
        ok:false,
        error:"Request ID is required."
      }
    };

  }


  const requestStore =
    getStore(
      REQUEST_STORE_NAME
    );


  const missionStore =
    getStore(
      MISSION_STORE_NAME
    );


  const requests =
    await readCollection(
      requestStore,
      REQUESTS_KEY,
      "requests"
    );


  const missions =
    await readCollection(
      missionStore,
      MISSIONS_KEY,
      "missions"
    );


  const hugRequest =
    findRequest(
      requests,
      requestId
    );


  if(
    !hugRequest
  ){

    return {
      status:404,

      body:{
        ok:false,
        error:"HUG Request not found."
      }
    };

  }


  /*
   * Prevent accidental duplicate mission creation.
   */

  const existingMission =
    missions.find(
      mission =>
        mission.source_request_id ===
        requestId
    );


  if(
    existingMission
  ){

    return {
      status:409,

      body:{
        ok:false,

        error:
          "A HUG Mission already exists for this request.",

        mission_id:
          existingMission.id
      }
    };

  }


  let mission;


  try{

    mission =
      createPublicMission(
        hugRequest,
        body
      );

  }
  catch(error){

    return {
      status:400,

      body:{
        ok:false,
        error:error.message
      }
    };

  }


  missions.push(
    mission
  );


  hugRequest.review_status =
    "Approved";

  hugRequest.mission_id =
    mission.id;

  hugRequest.reviewed_at =
    new Date()
      .toISOString();


  /*
   * Save the public mission and update the
   * private request separately.
   */

  await saveCollection(
    missionStore,
    MISSIONS_KEY,
    "missions",
    missions
  );


  await saveCollection(
    requestStore,
    REQUESTS_KEY,
    "requests",
    requests
  );


  return {
    status:201,

    body:{
      ok:true,

      message:
        "HUG Request approved and sanitized mission created.",

      mission
    }
  };

}


/* ==========================================
   HOLD / DECLINE REQUEST
========================================== */

async function updateRequestStatus(
  body,
  status
){

  const requestId =
    cleanText(
      body.request_id,
      120
    );


  if(
    !requestId
  ){

    return {
      status:400,

      body:{
        ok:false,
        error:"Request ID is required."
      }
    };

  }


  const store =
    getStore(
      REQUEST_STORE_NAME
    );


  const requests =
    await readCollection(
      store,
      REQUESTS_KEY,
      "requests"
    );


  const hugRequest =
    findRequest(
      requests,
      requestId
    );


  if(
    !hugRequest
  ){

    return {
      status:404,

      body:{
        ok:false,
        error:"HUG Request not found."
      }
    };

  }


  hugRequest.review_status =
    status;


  hugRequest.reviewed_at =
    new Date()
      .toISOString();


  if(
    body.review_note
  ){

    hugRequest.review_note =
      cleanText(
        body.review_note,
        1000
      );

  }


  await saveCollection(
    store,
    REQUESTS_KEY,
    "requests",
    requests
  );


  return {
    status:200,

    body:{
      ok:true,

      request_id:
        requestId,

      review_status:
        status
    }
  };

}


/* ==========================================
   APPROVE HELPER MATCH
========================================== */

async function approveMatch(
  body
){

  const matchId =
    cleanText(
      body.match_id,
      140
    );


  if(
    !matchId
  ){

    return {
      status:400,

      body:{
        ok:false,
        error:"Match ID is required."
      }
    };

  }


  const matchStore =
    getStore(
      MATCH_STORE_NAME
    );


  const missionStore =
    getStore(
      MISSION_STORE_NAME
    );


  const matches =
    await readCollection(
      matchStore,
      MATCHES_KEY,
      "matches"
    );


  const missions =
    await readCollection(
      missionStore,
      MISSIONS_KEY,
      "missions"
    );


  const match =
    findMatch(
      matches,
      matchId
    );


  if(
    !match
  ){

    return {
      status:404,

      body:{
        ok:false,
        error:"Helper match request not found."
      }
    };

  }


  if(
    match.status !==
    "Pending Review"
  ){

    return {
      status:409,

      body:{
        ok:false,

        error:
          "This Helper match has already been reviewed."
      }
    };

  }


  const mission =
    findMission(
      missions,
      match.mission_id
    );


  if(
    !mission
  ){

    return {
      status:404,

      body:{
        ok:false,
        error:"Associated HUG Mission not found."
      }
    };

  }


  if(
    mission.approved !== true ||
    mission.status !== "Available"
  ){

    return {
      status:409,

      body:{
        ok:false,

        error:
          "This HUG Mission is no longer available."
      }
    };

  }


  const now =
    new Date()
      .toISOString();


  /*
   * Assign selected Helper.
   */

  match.status =
    "Approved";

  match.reviewed_at =
    now;

  match.assigned_at =
    now;


  /*
   * Mission leaves the public Available board.
   */

  mission.status =
    "Accepted";

  mission.assigned_helper_id =
    match.helper_id;

  mission.assigned_match_id =
    match.id;

  mission.accepted_at =
    now;


  /*
   * Other pending requests for this same mission
   * are closed automatically.
   */

  for(
    const otherMatch of matches
  ){

    if(
      otherMatch.id !==
        match.id &&

      otherMatch.mission_id ===
        mission.id &&

      otherMatch.status ===
        "Pending Review"
    ){

      otherMatch.status =
        "Mission Assigned";

      otherMatch.reviewed_at =
        now;

    }

  }


  await saveCollection(
    matchStore,
    MATCHES_KEY,
    "matches",
    matches
  );


  await saveCollection(
    missionStore,
    MISSIONS_KEY,
    "missions",
    missions
  );


  return {
    status:200,

    body:{
      ok:true,

      message:
        "Helper approved and HUG Mission assigned.",

      mission_id:
        mission.id,

      helper_id:
        match.helper_id,

      status:
        mission.status
    }
  };

}


/* ==========================================
   DECLINE MATCH
========================================== */

async function declineMatch(
  body
){

  const matchId =
    cleanText(
      body.match_id,
      140
    );


  if(
    !matchId
  ){

    return {
      status:400,

      body:{
        ok:false,
        error:"Match ID is required."
      }
    };

  }


  const store =
    getStore(
      MATCH_STORE_NAME
    );


  const matches =
    await readCollection(
      store,
      MATCHES_KEY,
      "matches"
    );


  const match =
    findMatch(
      matches,
      matchId
    );


  if(
    !match
  ){

    return {
      status:404,

      body:{
        ok:false,
        error:"Helper match request not found."
      }
    };

  }


  if(
    match.status !==
    "Pending Review"
  ){

    return {
      status:409,

      body:{
        ok:false,

        error:
          "This Helper match has already been reviewed."
      }
    };

  }


  match.status =
    "Declined";

  match.reviewed_at =
    new Date()
      .toISOString();


  if(
    body.review_note
  ){

    match.review_note =
      cleanText(
        body.review_note,
        1000
      );

  }


  await saveCollection(
    store,
    MATCHES_KEY,
    "matches",
    matches
  );


  return {
    status:200,

    body:{
      ok:true,

      match_id:
        matchId,

      status:
        "Declined"
    }
  };

}


/* ==========================================
   MAIN HANDLER
========================================== */

export default async (
  request,
  context
) => {


  /*
   * This entire endpoint is private.
   */

  if(
    !authorized(
      request
    )
  ){

    return jsonResponse(
      {
        ok:false,

        error:
          "Unauthorized."
      },
      401
    );

  }


  try{


    /* ======================================
       GET
       List requests or matches
    ====================================== */

    if(
      request.method === "GET"
    ){

      const url =
        new URL(
          request.url
        );


      const view =
        url.searchParams.get(
          "view"
        ) || "requests";


      if(
        view === "requests"
      ){

        const requests =
          await listRequests();


        return jsonResponse(
          {
            ok:true,

            count:
              requests.length,

            requests
          }
        );

      }


      if(
        view === "matches"
      ){

        const matches =
          await listMatches();


        return jsonResponse(
          {
            ok:true,

            count:
              matches.length,

            matches
          }
        );

      }


      return jsonResponse(
        {
          ok:false,

          error:
            "Unknown admin view."
        },
        400
      );

    }


    /* ======================================
       POST
       Administrative actions
    ====================================== */

    if(
      request.method === "POST"
    ){

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
              "Invalid JSON request."
          },
          400
        );

      }


      const action =
        cleanText(
          body?.action,
          80
        );


      let result;


      switch(
        action
      ){


        case "approve-request":

          result =
            await approveRequest(
              body
            );

          break;


        case "hold-request":

          result =
            await updateRequestStatus(
              body,
              "On Hold"
            );

          break;


        case "decline-request":

          result =
            await updateRequestStatus(
              body,
              "Declined"
            );

          break;


        case "approve-match":

          result =
            await approveMatch(
              body
            );

          break;


        case "decline-match":

          result =
            await declineMatch(
              body
            );

          break;


        default:

          return jsonResponse(
            {
              ok:false,

              error:
                "Unknown admin action."
            },
            400
          );

      }


      return jsonResponse(
        result.body,
        result.status
      );

    }


    return jsonResponse(
      {
        ok:false,

        error:
          "Method not allowed."
      },
      405
    );


  }
  catch(error){

    console.error(
      "HUGS Admin Mission error:",
      error
    );


    return jsonResponse(
      {
        ok:false,

        error:
          "The HUGS admin service could not complete this request."
      },
      500
    );

  }

};
