import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

/*
 * HUGSLinks
 * Secure HUG Mission Session
 *
 * File:
 * netlify/functions/create-hug-mission-session.mjs
 *
 * PURPOSE
 * -------
 * Creates a private Helper mission session.
 *
 * SECURITY
 * --------
 * - Helper receives ONLY helper_token.
 * - Tracking token is generated and stored
 *   only as a hash.
 * - Recipient tracking credentials are NOT
 *   exposed to the Helper browser.
 * - Tokens are never stored in plaintext.
 */


const HELPER_STORE_NAME =
  "hugs-help-helpers";

const MISSION_STORE_NAME =
  "hugs-help-missions";

const SESSION_STORE_NAME =
  "hugs-help-mission-sessions";


const HELPERS_KEY =
  "helpers";

const MISSIONS_KEY =
  "missions";

const SESSIONS_KEY =
  "sessions";


const SESSION_HOURS = 12;


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
   VALIDATION
========================================== */

function validEmail(email){

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);

}


function validHelperId(helperId){

  return /^HELPER-\d{4}-\d{6}$/i
    .test(helperId);

}


function validMissionId(missionId){

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
   SAFE MISSION
========================================== */

function safeMission(mission){

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


    if(
      !validMissionId(missionId) ||
      !validHelperId(helperId) ||
      !validEmail(helperEmail)
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Mission or Helper verification information is invalid."
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
            "This HUGS Helper could not be verified as an approved Helper."
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


    const allowedStatuses =
      new Set([
        "Accepted",
        "At Pickup",
        "Items Received",
        "On the Way"
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
            "This HUG Mission is not available for a new live session."
        },
        409
      );

    }


    /* ======================================
       CREATE TOKENS
    ====================================== */

    const helperToken =
      createToken();


    /*
     * Recipient tracking token.
     *
     * IMPORTANT:
     *
     * This plaintext value is deliberately
     * NOT returned to the Helper browser.
     *
     * Only its hash is stored with the
     * session.
     *
     * Recipient access will be issued
     * through a separate protected
     * HUGS/Admin flow.
     */

    const trackingToken =
      createToken();


    const helperTokenHash =
      hashToken(
        helperToken
      );


    const trackingTokenHash =
      hashToken(
        trackingToken
      );


    const now =
      new Date();


    const expiresAt =
      new Date(
        now.getTime() +
        SESSION_HOURS *
        60 *
        60 *
        1000
      );


    /* ======================================
       SESSION STORE
    ====================================== */

    const sessionStore =
      getStore(
        SESSION_STORE_NAME
      );


    let sessions =
      await readCollection(
        sessionStore,
        SESSIONS_KEY,
        "sessions"
      );


    const nowMs =
      now.getTime();


    /*
     * Remove expired sessions.
     */

    sessions =
      sessions.filter(
        session => {

          const expiration =
            new Date(
              session.expires_at
            )
            .getTime();


          return (
            Number.isFinite(expiration) &&
            expiration > nowMs
          );

        }
      );


    /*
     * Invalidate older active sessions
     * for this mission/helper pair.
     */

    sessions =
      sessions.map(
        session => {

          if(
            session.mission_id ===
              missionId &&

            String(
              session.helper_id || ""
            )
            .toUpperCase() ===
              helperId &&

            session.active === true
          ){

            return {

              ...session,

              active:false,

              ended_at:
                now.toISOString(),

              ended_reason:
                "Replaced by new session"

            };

          }


          return session;

        }
      );


    /* ======================================
       NEW SESSION
    ====================================== */

    const sessionId =
      "SESSION-" +
      crypto
        .randomBytes(8)
        .toString("hex")
        .toUpperCase();


    const session = {

      id:
        sessionId,

      mission_id:
        missionId,

      helper_id:
        helperId,

      helper_token_hash:
        helperTokenHash,

      tracking_token_hash:
        trackingTokenHash,

      active:
        true,

      created_at:
        now.toISOString(),

      expires_at:
        expiresAt.toISOString(),

      ended_at:
        null,

      ended_reason:
        null

    };


    sessions.push(
      session
    );


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

        session_id:
          sessionId,

        /*
         * ONLY Helper credential returned.
         */

        helper_token:
          helperToken,

        expires_at:
          expiresAt.toISOString(),

        mission:
          safeMission(
            mission
          )

      }
    );


  }
  catch(error){


    console.error(
      "Create HUG Mission session error:",
      error
    );


    return jsonResponse(
      {
        ok:false,

        error:
          "A secure HUG Mission session could not be created."
      },
      500
    );

  }

};
