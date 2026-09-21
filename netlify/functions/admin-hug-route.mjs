import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

/*
 * HUGSLinks
 * Secure Admin Private HUG Route
 *
 * FILE:
 * netlify/functions/admin-hug-route.mjs
 *
 * PURPOSE
 * -------
 * Allows authenticated HUGS Admin to create
 * or update the private pickup/destination
 * coordinates for an assigned active mission.
 *
 * PRIVACY
 * -------
 * Private route information is stored separately
 * from the public HUG Mission collection.
 *
 * get-hug-route.mjs controls when an assigned
 * Helper may see pickup/destination information.
 */


const MISSION_STORE_NAME =
  "hugs-help-missions";

const ROUTE_STORE_NAME =
  "hugs-help-private-routes";


const MISSIONS_KEY =
  "missions";

const ROUTES_KEY =
  "routes";


const ACTIVE_ROUTE_STATUSES =
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

  "Expires":
    "0",

  "X-Content-Type-Options":
    "nosniff",

  "Referrer-Policy":
    "no-referrer"

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
   MISSION ID
========================================== */

function validMissionId(
  missionId
){

  return /^HUG-\d{4}-[A-Za-z0-9-]{4,40}$/
    .test(missionId);

}


/* ==========================================
   ADMIN TOKEN SECURITY
========================================== */

function safeTokenEqual(
  suppliedToken,
  configuredToken
){

  if(
    typeof suppliedToken !== "string" ||
    typeof configuredToken !== "string" ||
    !suppliedToken ||
    !configuredToken
  ){

    return false;

  }


  const supplied =
    Buffer.from(
      suppliedToken,
      "utf8"
    );


  const configured =
    Buffer.from(
      configuredToken,
      "utf8"
    );


  if(
    supplied.length !==
    configured.length
  ){

    return false;

  }


  return crypto.timingSafeEqual(
    supplied,
    configured
  );

}


/* ==========================================
   ADMIN AUTH
========================================== */

function authorizedAdmin(
  request
){

  const configuredToken =
    process.env.HUGS_ADMIN_TOKEN;


  if(!configuredToken){

    return {
      configured:false,
      authorized:false
    };

  }


  const authorization =
    request.headers.get(
      "authorization"
    ) || "";


  const prefix =
    "Bearer ";


  if(
    !authorization.startsWith(
      prefix
    )
  ){

    return {
      configured:true,
      authorized:false
    };

  }


  const suppliedToken =
    authorization
      .slice(
        prefix.length
      )
      .trim();


  return {

    configured:true,

    authorized:
      safeTokenEqual(
        suppliedToken,
        configuredToken
      )

  };

}


/* ==========================================
   COORDINATES
========================================== */

function parseCoordinate(
  value
){

  /*
   * Prevent:
   *
   * Number("")    -> 0
   * Number(null)  -> 0
   *
   * from silently creating a coordinate.
   */

  if(
    value === null ||
    value === undefined
  ){

    return null;

  }


  if(
    typeof value === "string" &&
    !value.trim()
  ){

    return null;

  }


  const number =
    Number(value);


  if(
    !Number.isFinite(number)
  ){

    return null;

  }


  return number;

}


function validCoordinate(
  value,
  min,
  max
){

  return (
    Number.isFinite(value) &&
    value >= min &&
    value <= max
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
   MAIN
========================================== */

export default async request => {


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
       ADMIN AUTHENTICATION
    ====================================== */

    const admin =
      authorizedAdmin(
        request
      );


    if(
      !admin.configured
    ){

      console.error(
        "HUGS_ADMIN_TOKEN is not configured."
      );


      return jsonResponse(
        {
          ok:false,
          error:"Admin service is not configured."
        },
        500
      );

    }


    if(
      !admin.authorized
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Unauthorized."
        },
        401
      );

    }


    /* ======================================
       REQUEST BODY
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


    const pickupLabel =
      cleanText(
        body?.pickup_label,
        160
      );


    const destinationLabel =
      cleanText(
        body?.destination_label,
        160
      );


    const pickupLatitude =
      parseCoordinate(
        body?.pickup_latitude
      );


    const pickupLongitude =
      parseCoordinate(
        body?.pickup_longitude
      );


    const destinationLatitude =
      parseCoordinate(
        body?.destination_latitude
      );


    const destinationLongitude =
      parseCoordinate(
        body?.destination_longitude
      );


    /* ======================================
       MISSION VALIDATION
    ====================================== */

    if(
      !missionId
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Mission ID is required."
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


    /* ======================================
       COORDINATE VALIDATION
    ====================================== */

    if(
      !validCoordinate(
        pickupLatitude,
        -90,
        90
      ) ||
      !validCoordinate(
        pickupLongitude,
        -180,
        180
      ) ||
      !validCoordinate(
        destinationLatitude,
        -90,
        90
      ) ||
      !validCoordinate(
        destinationLongitude,
        -180,
        180
      )
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Valid pickup and destination coordinates are required."
        },
        400
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
       ASSIGNED HELPER REQUIRED
    ====================================== */

    const assignedHelperId =
      cleanText(
        mission.assigned_helper_id,
        80
      );


    if(
      !assignedHelperId
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "A Helper must be assigned before a private route is created."

        },
        409
      );

    }


    /* ======================================
       ACTIVE MISSION REQUIRED
    ====================================== */

    if(
      !ACTIVE_ROUTE_STATUSES.has(
        mission.status
      )
    ){

      if(
        mission.status ===
        "Delivered"
      ){

        return jsonResponse(
          {

            ok:false,

            error:
              "This HUG Mission has already been delivered. Its private route can no longer be changed."

          },
          409
        );

      }


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
       PRIVATE ROUTE STORE
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


    const now =
      new Date()
        .toISOString();


    /* ======================================
       ROUTE RECORD
    ====================================== */

    const route = {

      mission_id:
        missionId,

      pickup:{

        label:
          pickupLabel ||
          "HUG Pickup",

        latitude:
          pickupLatitude,

        longitude:
          pickupLongitude

      },

      destination:{

        label:
          destinationLabel ||
          "HUG Destination",

        latitude:
          destinationLatitude,

        longitude:
          destinationLongitude

      },

      created_at:
        now,

      updated_at:
        now

    };


    /* ======================================
       CREATE OR REPLACE
    ====================================== */

    const existingIndex =
      routes.findIndex(
        item =>
          String(
            item?.mission_id || ""
          ) ===
          missionId
      );


    if(
      existingIndex === -1
    ){

      routes.push(
        route
      );

    }
    else{

      route.created_at =
        routes[
          existingIndex
        ]?.created_at ||
        now;


      routes[
        existingIndex
      ] =
        route;

    }


    /* ======================================
       SAVE PRIVATE ROUTES
    ====================================== */

    await routeStore.setJSON(
      ROUTES_KEY,
      {

        updated_at:
          now,

        routes

      }
    );


    /* ======================================
       RESPONSE
    ====================================== */

    return jsonResponse(
      {

        ok:true,

        mission_id:
          missionId,

        mission_status:
          mission.status,

        helper_assigned:
          true,

        updated_at:
          now,

        message:
          existingIndex === -1

            ?
            "Private HUG route created."

            :
            "Private HUG route updated."

      }
    );


  }
  catch(error){


    console.error(
      "Secure HUG route admin error:",
      error
    );


    return jsonResponse(
      {

        ok:false,

        error:
          "Private HUG route could not be saved."

      },
      500
    );

  }

};
