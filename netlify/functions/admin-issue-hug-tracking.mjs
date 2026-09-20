import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

/*
 * HUGSLinks
 * Admin Issue Recipient Tracking Access
 *
 * File:
 * netlify/functions/admin-issue-hug-tracking.mjs
 *
 * PURPOSE
 * -------
 * Allows authenticated HUGS Admin to issue
 * a fresh recipient tracking credential for
 * an active HUG Mission.
 *
 * SECURITY
 * --------
 * - Requires HUGS_ADMIN_TOKEN.
 * - Never exposes the Helper token.
 * - Generates a new recipient tracking token.
 * - Stores ONLY the SHA-256 token hash.
 * - Returns plaintext tracking token once,
 *   only to authenticated Admin.
 * - Reissuing access invalidates the previous
 *   recipient tracking token.
 * - Delivered missions cannot receive new
 *   tracking access.
 */


const SESSION_STORE_NAME =
  "hugs-help-mission-sessions";

const MISSION_STORE_NAME =
  "hugs-help-missions";


const SESSIONS_KEY =
  "sessions";

const MISSIONS_KEY =
  "missions";


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
   MISSION ID
========================================== */

function validMissionId(
  missionId
){

  return /^HUG-\d{4}-[A-Za-z0-9-]{4,40}$/
    .test(missionId);

}


/* ==========================================
   TOKEN
========================================== */

function createToken(){

  return crypto
    .randomBytes(32)
    .toString("hex");

}


function hashToken(token){

  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

}


/* ==========================================
   CONSTANT-TIME SECRET CHECK
========================================== */

function safeEqual(
  supplied,
  expected
){

  if(
    typeof supplied !== "string" ||
    typeof expected !== "string"
  ){
    return false;
  }


  const suppliedBuffer =
    Buffer.from(
      supplied,
      "utf8"
    );


  const expectedBuffer =
    Buffer.from(
      expected,
      "utf8"
    );


  if(
    suppliedBuffer.length !==
    expectedBuffer.length
  ){
    return false;
  }


  return crypto.timingSafeEqual(
    suppliedBuffer,
    expectedBuffer
  );

}


/* ==========================================
   ADMIN AUTH
========================================== */

function authorizedAdmin(
  request
){

  const expectedToken =
    process.env.HUGS_ADMIN_TOKEN;


  if(!expectedToken){
    return false;
  }


  const authorization =
    request.headers.get(
      "authorization"
    ) || "";


  if(
    !authorization.startsWith(
      "Bearer "
    )
  ){
    return false;
  }


  const suppliedToken =
    authorization
      .slice(7)
      .trim();


  return safeEqual(
    suppliedToken,
    expectedToken
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


  /* ======================================
     ADMIN AUTHENTICATION
  ====================================== */

  if(
    !authorizedAdmin(
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
       MISSION
    ====================================== */

    const missionId =
      cleanText(
        body?.mission_id,
        120
      );


    if(
      !missionId ||
      !validMissionId(
        missionId
      )
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Valid HUG Mission number required."
        },
        400
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
       ACTIVE MISSION ONLY
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
            mission.status ===
              "Delivered"
              ?
              "Tracking access cannot be issued for a delivered HUG."
              :
              "Tracking access is not available for this mission status."
        },
        409
      );

    }


    /* ======================================
       ASSIGNED HELPER REQUIRED
    ====================================== */

    const assignedHelperId =
      cleanText(
        mission.assigned_helper_id,
        80
      )
      .toUpperCase();


    if(!assignedHelperId){

      return jsonResponse(
        {
          ok:false,

          error:
            "This HUG Mission does not have an assigned Helper."
        },
        409
      );

    }


    /* ======================================
       LOAD SESSIONS
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


    const now =
      new Date();


    const nowMs =
      now.getTime();


    /*
     * Find the current active session
     * belonging to the assigned Helper.
     *
     * If more than one somehow exists,
     * choose the newest valid session.
     */

    const candidates =
      sessions
        .map(
          (session,index) => ({
            session,
            index
          })
        )
        .filter(
          entry => {

            const session =
              entry.session;


            if(
              session.mission_id !==
              missionId
            ){
              return false;
            }


            if(
              String(
                session.helper_id || ""
              )
              .toUpperCase() !==
              assignedHelperId
            ){
              return false;
            }


            if(
              session.active !== true
            ){
              return false;
            }


            const expiration =
              new Date(
                session.expires_at
              )
              .getTime();


            return (
              Number.isFinite(
                expiration
              ) &&
              expiration > nowMs
            );

          }
        )
        .sort(
          (a,b) => {

            const aCreated =
              new Date(
                a.session.created_at || 0
              )
              .getTime();


            const bCreated =
              new Date(
                b.session.created_at || 0
              )
              .getTime();


            return (
              bCreated -
              aCreated
            );

          }
        );


    if(
      candidates.length === 0
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "The assigned Helper does not currently have an active secure HUG session."
        },
        409
      );

    }


    const sessionIndex =
      candidates[0]
        .index;


    const session =
      sessions[
        sessionIndex
      ];


    /* ======================================
       GENERATE RECIPIENT TOKEN
    ====================================== */

    const trackingToken =
      createToken();


    const trackingTokenHash =
      hashToken(
        trackingToken
      );


    /*
     * Replacing the stored hash immediately
     * invalidates any previously issued
     * tracking credential for this session.
     */

    session.tracking_token_hash =
      trackingTokenHash;


    session.tracking_issued_at =
      now.toISOString();


    session.tracking_reissued_count =
      Number.isFinite(
        Number(
          session.tracking_reissued_count
        )
      )
        ?
        Number(
          session.tracking_reissued_count
        ) + 1
        :
        1;


    await saveSessions(
      sessionStore,
      sessions
    );


    /* ======================================
       SUCCESS
    ====================================== */

    return jsonResponse(
      {

        ok:true,

        mission_id:
          missionId,

        session_id:
          session.id,

        mission_status:
          mission.status,

        /*
         * Returned once to authenticated
         * Admin.
         *
         * Do not log or persist this value
         * in the browser.
         */

        tracking_token:
          trackingToken,

        expires_at:
          session.expires_at,

        issued_at:
          session.tracking_issued_at,

        message:
          "Private recipient tracking access issued."

      }
    );


  }
  catch(error){


    console.error(
      "Issue HUG tracking access error:",
      error
    );


    return jsonResponse(
      {
        ok:false,

        error:
          "Recipient tracking access could not be issued."
      },
      500
    );

  }

};v
