import { getStore } from "@netlify/blobs";

/*
 * HUGSLinks
 * Admin HUG Help Control API
 *
 * File:
 * netlify/functions/admin-hug-missions.mjs
 *
 * ADMIN CAPABILITIES
 * ------------------
 * GET:
 *   ?view=requests
 *   ?view=helpers
 *   ?view=matches
 *
 * POST actions:
 *   approve-request
 *   hold-request
 *   decline-request
 *
 *   approve-helper
 *   pause-helper
 *   reactivate-helper
 *
 *   approve-match
 *   decline-match
 *
 * SECURITY
 * --------
 * Requires:
 *
 * HUGS_ADMIN_TOKEN
 *
 * as a Netlify server environment variable.
 */


/* ==========================================
   STORE NAMES
========================================== */

const REQUEST_STORE_NAME =
  "hugs-help-requests";

const HELPER_STORE_NAME =
  "hugs-help-helpers";

const MISSION_STORE_NAME =
  "hugs-help-missions";

const MATCH_STORE_NAME =
  "hugs-help-matches";


/* ==========================================
   COLLECTION KEYS
========================================== */

const REQUESTS_KEY =
  "requests";

const HELPERS_KEY =
  "helpers";

const MISSIONS_KEY =
  "missions";

const MATCHES_KEY =
  "mission-match-requests";


/* ==========================================
   HEADERS
========================================== */

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
   ADMIN AUTH
========================================== */

function getAdminToken(
  request
){

  const authorization =
    request.headers.get(
      "authorization"
    ) || "";


  if(
    !authorization
      .toLowerCase()
      .startsWith(
        "bearer "
      )
  ){

    return "";

  }


  return authorization
    .slice(7)
    .trim();

}


function authorized(
  request
){

  const expected =
    process.env
      .HUGS_ADMIN_TOKEN;


  if(
    !expected
  ){

    console.error(
      "HUGS_ADMIN_TOKEN is not configured."
    );

    return false;

  }


  const supplied =
    getAdminToken(
      request
    );


  if(
    !supplied
  ){

    return false;

  }


  return supplied === expected;

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
   SORT NEWEST FIRST
========================================== */

function newestFirst(
  records
){

  return records.sort(
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
   FINDERS
========================================== */

function findRequest(
  requests,
  id
){

  return requests.find(
    item =>
      String(
        item?.id || ""
      ) === id
  );

}


function findHelper(
  helpers,
  id
){

  return helpers.find(
    item =>
      String(
        item?.id || ""
      )
      .toUpperCase() ===
      id.toUpperCase()
  );

}


function findMission(
  missions,
  id
){

  return missions.find(
    item =>
      String(
        item?.id || ""
      ) === id
  );

}


function findMatch(
  matches,
  id
){

  return matches.find(
    item =>
      String(
        item?.id || ""
      ) === id
  );

}


/* ==========================================
   MISSION ID
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
   SAFE PUBLIC MISSION
========================================== */

function createPublicMission(
  hugRequest,
  input
){

  /*
   * NEVER copy the complete request object
   * into a public mission.
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

    type:
      cleanText(
        input.type ||
        hugRequest.request_type ||
        "Community Support",
        100
      ),

    city:
      cleanText(
        input.city ||
        hugRequest.city ||
        "",
        100
      ),

    area:
      cleanText(
        input.area ||
        hugRequest.borough_area ||
        "",
        100
      ),

    timing:
      cleanText(
        input.timing ||
        hugRequest.time_needed ||
        "Flexible",
        100
      ),

    summary,

    status:
      "Available",

    approved:
      true,

    created_at:
      new Date()
        .toISOString(),

    /*
     * Internal linkage.
     *
     * hugs-missions.mjs does not expose
     * this field publicly.
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


  const records =
    await readCollection(
      store,
      REQUESTS_KEY,
      "requests"
    );


  return newestFirst(
    records
  );

}


/* ==========================================
   LIST HELPERS
========================================== */

async function listHelpers(){

  const store =
    getStore(
      HELPER_STORE_NAME
    );


  const records =
    await readCollection(
      store,
      HELPERS_KEY,
      "helpers"
    );


  return newestFirst(
    records
  );

}


/* ==========================================
   LIST MATCHES
========================================== */

async function listMatches(){

  const store =
    getStore(
      MATCH_STORE_NAME
    );


  const records =
    await readCollection(
      store,
      MATCHES_KEY,
      "matches"
    );


  return newestFirst(
    records
  );

}


/* ==========================================
   APPROVE REQUEST
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


  const existing =
    missions.find(
      mission =>
        mission.source_request_id ===
        requestId
    );


  if(
    existing
  ){

    return {

      status:409,

      body:{
        ok:false,

        error:
          "A HUG Mission already exists for this request.",

        mission_id:
          existing.id
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


  const now =
    new Date()
      .toISOString();


  hugRequest.review_status =
    "Approved";

  hugRequest.mission_id =
    mission.id;

  hugRequest.reviewed_at =
    now;


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
   REQUEST STATUS
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
   HELPER STATUS
========================================== */

async function updateHelperStatus(
  body,
  newStatus
){

  const helperId =
    cleanText(
      body.helper_id,
      80
    )
    .toUpperCase();


  if(
    !helperId
  ){

    return {

      status:400,

      body:{
        ok:false,
        error:"Helper ID is required."
      }

    };

  }


  const store =
    getStore(
      HELPER_STORE_NAME
    );


  const helpers =
    await readCollection(
      store,
      HELPERS_KEY,
      "helpers"
    );


  const helper =
    findHelper(
      helpers,
      helperId
    );


  if(
    !helper
  ){

    return {

      status:404,

      body:{
        ok:false,
        error:"HUGS Helper not found."
      }

    };

  }


  const now =
    new Date()
      .toISOString();


  helper.status =
    newStatus;

  helper.reviewed_at =
    now;


  if(
    newStatus === "Approved"
  ){

    helper.approved_at =
      now;

  }


  if(
    newStatus === "Paused"
  ){

    helper.paused_at =
      now;

  }


  if(
    body.review_note
  ){

    helper.review_note =
      cleanText(
        body.review_note,
        1000
      );

  }


  await saveCollection(
    store,
    HELPERS_KEY,
    "helpers",
    helpers
  );


  return {

    status:200,

    body:{

      ok:true,

      helper_id:
        helper.id,

      helper_status:
        helper.status

    }

  };

}


/* ==========================================
   APPROVE MATCH
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


  const helperStore =
    getStore(
      HELPER_STORE_NAME
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


  const helpers =
    await readCollection(
      helperStore,
      HELPERS_KEY,
      "helpers"
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


  /*
   * IMPORTANT:
   *
   * Verify Helper again at assignment time.
   *
   * We do not rely only on the earlier
   * accept-hug-mission check.
   */

  const helper =
    findHelper(
      helpers,
      String(
        match.helper_id || ""
      )
    );


  if(
    !helper
  ){

    return {

      status:404,

      body:{
        ok:false,
        error:"Associated HUGS Helper not found."
      }

    };

  }


  if(
    helper.status !==
    "Approved"
  ){

    return {

      status:409,

      body:{

        ok:false,

        error:
          "This Helper must be approved before assignment."

      }

    };

  }


  const registeredEmail =
    String(
      helper.email || ""
    )
    .trim()
    .toLowerCase();


  const matchEmail =
    String(
      match.helper_email || ""
    )
    .trim()
    .toLowerCase();


  if(
    registeredEmail !==
    matchEmail
  ){

    return {

      status:409,

      body:{

        ok:false,

        error:
          "Helper verification no longer matches the registration."

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


  match.status =
    "Approved";

  match.reviewed_at =
    now;

  match.assigned_at =
    now;


  mission.status =
    "Accepted";

  mission.assigned_helper_id =
    helper.id;

  mission.assigned_match_id =
    match.id;

  mission.accepted_at =
    now;


  /*
   * Close other pending applications
   * for the same mission.
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
        "Approved Helper assigned to HUG Mission.",

      mission_id:
        mission.id,

      helper_id:
        helper.id,

      mission_status:
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


  /* ========================================
     AUTHENTICATION
  ======================================== */

  if(
    !authorized(
      request
    )
  ){

    return jsonResponse(
      {
        ok:false,
        error:"Unauthorized."
      },
      401
    );

  }


  try{


    /* ======================================
       GET
    ====================================== */

    if(
      request.method ===
      "GET"
    ){

      const url =
        new URL(
          request.url
        );


      const view =
        url.searchParams.get(
          "view"
        ) || "requests";


      /* REQUESTS */

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


      /* HELPERS */

      if(
        view === "helpers"
      ){

        const helpers =
          await listHelpers();


        return jsonResponse(
          {

            ok:true,

            count:
              helpers.length,

            helpers

          }
        );

      }


      /* MATCHES */

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
          error:"Unknown admin view."
        },
        400
      );

    }


    /* ======================================
       POST
    ====================================== */

    if(
      request.method ===
      "POST"
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
            error:"Invalid JSON request."
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


        /* REQUESTS */

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


        /* HELPERS */

        case "approve-helper":

          result =
            await updateHelperStatus(
              body,
              "Approved"
            );

          break;


        case "pause-helper":

          result =
            await updateHelperStatus(
              body,
              "Paused"
            );

          break;


        case "reactivate-helper":

          result =
            await updateHelperStatus(
              body,
              "Approved"
            );

          break;


        /* MATCHES */

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
              error:"Unknown admin action."
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
        error:"Method not allowed."
      },
      405
    );


  }
  catch(error){


    console.error(
      "HUGS Admin error:",
      error
    );


    return jsonResponse(
      {

        ok:false,

        error:
          "The HUGS Admin service could not complete this request."

      },
      500
    );

  }

};
