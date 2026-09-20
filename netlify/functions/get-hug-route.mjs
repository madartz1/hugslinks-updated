import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

/*
 * HUGSLinks
 * Secure Helper Route Access
 *
 * FILE:
 * netlify/functions/get-hug-route.mjs
 *
 * IMPORTANT:
 * This is NOT get-hug-delivery.mjs.
 *
 * PRIVACY RULE:
 *
 * Accepted
 *   -> Pickup only
 *
 * At Pickup
 *   -> Pickup only
 *
 * Items Received
 *   -> Pickup + Destination
 *
 * On the Way
 *   -> Pickup + Destination
 *
 * Delivered
 *   -> Route closed
 */


const SESSION_STORE_NAME =
  "hugs-help-mission-sessions";

const MISSION_STORE_NAME =
  "hugs-help-missions";

const ROUTE_STORE_NAME =
  "hugs-help-private-routes";


const SESSIONS_KEY =
  "sessions";

const MISSIONS_KEY =
  "missions";

const ROUTES_KEY =
  "routes";


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
   CLEAN INPUT
========================================== */

function cleanText(
  value,
  max = 250
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
      max
    );
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
   READ BLOB COLLECTION
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
   SAFE PICKUP
========================================== */

function safePickup(route){

  if(
    !route?.pickup
  ){
    return null;
  }


  return {

    label:
      route.pickup.label ||
      "HUG Pickup",

    latitude:
      route.pickup.latitude,

    longitude:
      route.pickup.longitude

  };
}


/* ==========================================
   SAFE DESTINATION
========================================== */

function safeDestination(route){

  if(
    !route?.destination
  ){
    return null;
  }


  return {

    label:
      route.destination.label ||
      "HUG Destination",

    latitude:
      route.destination.latitude,

    longitude:
      route.destination.longitude

  };
}


/* ==========================================
   MAIN
========================================== */

export default async request => {


  /* ----------------------------------------
     POST ONLY
  ---------------------------------------- */

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


    /* --------------------------------------
       READ REQUEST
    -------------------------------------- */

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


    /* --------------------------------------
       INPUT
    -------------------------------------- */

    const missionId =
      cleanText(
        body?.mission_id,
        120
      );


    const helperToken =
      cleanText(
        body?.helper_token,
        200
      );


    if(
      !missionId ||
      !helperToken
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Secure mission access is required."
        },
        400
      );
    }


    /* ======================================
       VERIFY SECURE HELPER SESSION
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


    const tokenHash =
      hashToken(
        helperToken
      );


    const session =
      sessions.find(
        item =>

          item.mission_id ===
            missionId &&

          item.helper_token_hash ===
            tokenHash
      );


    if(
      !session ||
      session.active !== true
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Invalid HUG Mission session."
        },
        403
      );
    }


    /* ======================================
       CHECK SESSION EXPIRATION
    ====================================== */

    const expires =
      new Date(
        session.expires_at
      )
      .getTime();


    if(
      !Number.isFinite(expires) ||
      expires <= Date.now()
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "HUG Mission session expired."
        },
        403
      );
    }


    /* ======================================
       LOAD CURRENT MISSION
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
          item.id ===
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
       VERIFY HELPER ASSIGNMENT
    ====================================== */

    if(
      String(
        mission.assigned_helper_id ||
        ""
      )
      .toUpperCase() !==
      String(
        session.helper_id ||
        ""
      )
      .toUpperCase()
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "This session is not authorized for this HUG Mission."
        },
        403
      );
    }


    /* ======================================
       DELIVERED
       ROUTE IS CLOSED
    ====================================== */

    if(
      mission.status ===
      "Delivered"
    ){

      return jsonResponse(
        {
          ok:true,

          mission_status:
            "Delivered",

          destination_unlocked:
            false,

          route:
            null,

          message:
            "HUG Delivered ❤️"
        }
      );
    }


    /* ======================================
       ACTIVE MISSION STATUSES
    ====================================== */

    const activeStatuses =
      new Set([
        "Accepted",
        "At Pickup",
        "Items Received",
        "On the Way"
      ]);


    if(
      !activeStatuses.has(
        mission.status
      )
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Private routing is not available for this mission status."
        },
        409
      );
    }


    /* ======================================
       LOAD PRIVATE ROUTE
    ====================================== */

    const routeStore =
      getStore(
        ROUTE_STORE_NAME
      );


    const routes =
      await readCollection(
        routeStore,
        ROUTES_KEY,
        "routes"
      );


    const route =
      routes.find(
        item =>
          item.mission_id ===
          missionId
      );


    /* --------------------------------------
       ROUTE NOT PREPARED YET
    -------------------------------------- */

    if(!route){

      return jsonResponse(
        {
          ok:true,

          mission_status:
            mission.status,

          destination_unlocked:
            false,

          route:
            null,

          message:
            "The private route has not been prepared yet."
        }
      );
    }


    /* ======================================
       DESTINATION PRIVACY GATE
    ====================================== */

    const destinationUnlocked =

      mission.status ===
        "Items Received" ||

      mission.status ===
        "On the Way";


    /*
     * ACCEPTED
     *
     * or
     *
     * AT PICKUP
     *
     * -----------------------------
     *
     * Return pickup ONLY.
     *
     * Destination coordinates are
     * NOT included in the response.
     */


    if(
      !destinationUnlocked
    ){

      return jsonResponse(
        {
          ok:true,

          mission_status:
            mission.status,

          destination_unlocked:
            false,

          route:{

            pickup:
              safePickup(
                route
              )

          },

          message:
            "Destination unlocks after the HUG is received."
        }
      );
    }


    /* ======================================
       DESTINATION UNLOCKED
    ====================================== */

    return jsonResponse(
      {
        ok:true,

        mission_status:
          mission.status,

        destination_unlocked:
          true,

        route:{

          pickup:
            safePickup(
              route
            ),

          destination:
            safeDestination(
              route
            )

        },

        message:
          mission.status ===
          "On the Way"

            ? "HUG is on the way."

            : "Destination unlocked."
      }
    );


  }
  catch(error){


    console.error(
      "Secure Helper HUG route error:",
      error
    );


    return jsonResponse(
      {
        ok:false,

        error:
          "The private HUG route could not be loaded."
      },
      500
    );

  }

};
