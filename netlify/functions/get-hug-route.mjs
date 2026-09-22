import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

/*
 * HUGSLinks
 * Secure Helper Route Access + Mapbox Routing
 *
 * FILE:
 * netlify/functions/get-hug-route.mjs
 *
 * PRIVACY FLOW
 * ------------
 * Accepted       -> Helper -> Pickup
 * At Pickup      -> Helper -> Pickup
 * Items Received -> Helper -> Destination
 * On the Way     -> Helper -> Destination
 * Delivered      -> Private route closed
 *
 * SECURITY
 * --------
 * - Requires mission_id + temporary helper_token.
 * - Plaintext Helper token is never stored.
 * - Session must be active and unexpired.
 * - Session must belong to this exact Mission.
 * - Session Helper must still be assigned.
 * - Helper must still be Approved.
 * - Only a fresh, actively shared location is used.
 * - Destination is never returned before "Items Received".
 * - MAPBOX_ACCESS_TOKEN remains server-side.
 */


/* ==========================================
   STORES
========================================== */

const HELPER_STORE_NAME =
  "hugs-help-helpers";

const SESSION_STORE_NAME =
  "hugs-help-mission-sessions";

const MISSION_STORE_NAME =
  "hugs-help-missions";

const ROUTE_STORE_NAME =
  "hugs-help-private-routes";

const LOCATION_STORE_NAME =
  "hugs-help-live-locations";


/* ==========================================
   KEYS
========================================== */

const HELPERS_KEY =
  "helpers";

const SESSIONS_KEY =
  "sessions";

const MISSIONS_KEY =
  "missions";

const ROUTES_KEY =
  "routes";

const LOCATIONS_KEY =
  "active-locations";


/* ==========================================
   CONSTANTS
========================================== */

const LOCATION_MAX_AGE_MS =
  2 * 60 * 1000;

const ACTIVE_STATUSES =
  new Set([
    "Accepted",
    "At Pickup",
    "Items Received",
    "On the Way"
  ]);


/* ==========================================
   HEADERS
========================================== */

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


function cleanToken(value){

  if(
    typeof value !== "string"
  ){
    return "";
  }

  return value
    .trim()
    .slice(
      0,
      256
    );

}


/* ==========================================
   VALIDATION
========================================== */

function validMissionId(
  missionId
){

  return /^HUG-\d{4}-[A-Za-z0-9-]{4,40}$/
    .test(missionId);

}


function validHelperId(
  helperId
){

  return /^HELPER-\d{4}-\d{6}$/i
    .test(helperId);

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


function safeHashEqual(
  suppliedHash,
  storedHash
){

  if(
    typeof suppliedHash !== "string" ||
    typeof storedHash !== "string" ||
    !suppliedHash ||
    !storedHash
  ){
    return false;
  }

  const supplied =
    Buffer.from(
      suppliedHash,
      "utf8"
    );

  const stored =
    Buffer.from(
      storedHash,
      "utf8"
    );

  if(
    supplied.length !==
    stored.length
  ){
    return false;
  }

  return crypto.timingSafeEqual(
    supplied,
    stored
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
   COORDINATE HELPERS
========================================== */

function coordinateValue(
  object,
  names
){

  if(!object){
    return null;
  }

  for(
    const name of names
  ){

    const raw =
      object[name];

    if(
      raw === null ||
      raw === undefined ||
      raw === ""
    ){
      continue;
    }

    const value =
      Number(raw);

    if(
      Number.isFinite(value)
    ){
      return value;
    }

  }

  return null;

}


function latitudeOf(object){

  return coordinateValue(
    object,
    [
      "latitude",
      "lat"
    ]
  );

}


function longitudeOf(object){

  return coordinateValue(
    object,
    [
      "longitude",
      "lng",
      "lon"
    ]
  );

}


function validLatitude(value){

  return (
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  );

}


function validLongitude(value){

  return (
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );

}


/* ==========================================
   SAFE PICKUP
========================================== */

function safePickup(route){

  if(!route?.pickup){
    return null;
  }

  const latitude =
    latitudeOf(
      route.pickup
    );

  const longitude =
    longitudeOf(
      route.pickup
    );

  if(
    !validLatitude(latitude) ||
    !validLongitude(longitude)
  ){
    return null;
  }

  return {
    label:
      cleanText(
        route.pickup.label ||
        "HUG Pickup",
        150
      ),

    latitude,
    longitude
  };

}


/* ==========================================
   SAFE DESTINATION
========================================== */

function safeDestination(route){

  if(!route?.destination){
    return null;
  }

  const latitude =
    latitudeOf(
      route.destination
    );

  const longitude =
    longitudeOf(
      route.destination
    );

  if(
    !validLatitude(latitude) ||
    !validLongitude(longitude)
  ){
    return null;
  }

  return {
    label:
      cleanText(
        route.destination.label ||
        "HUG Destination",
        150
      ),

    latitude,
    longitude
  };

}


/* ==========================================
   TRANSPORT MODE
========================================== */

function getTransportMode(mission){

  const raw =
    mission.transport_mode ||
    mission.transportation_mode ||
    mission.travel_mode ||
    mission.mode ||
    "driving";

  const normalized =
    String(raw)
      .trim()
      .toLowerCase();

  if(
    normalized === "walking" ||
    normalized === "walk" ||
    normalized === "foot"
  ){

    return {
      mode:"walking",
      profile:"mapbox/walking"
    };

  }

  if(
    normalized === "bicycle" ||
    normalized === "bike" ||
    normalized === "cycling" ||
    normalized === "e-bike" ||
    normalized === "ebike"
  ){

    return {
      mode:"bicycle",
      profile:"mapbox/cycling"
    };

  }

  return {
    mode:"driving",
    profile:"mapbox/driving-traffic"
  };

}


/* ==========================================
   LIVE LOCATION
========================================== */

function findLiveLocation(
  locations,
  missionId,
  helperId
){

  const expectedHelper =
    String(
      helperId || ""
    )
    .toUpperCase();

  const matching =
    locations
      .filter(
        item => {

          const sameMission =
            String(
              item?.mission_id || ""
            ) ===
            String(
              missionId || ""
            );

          const itemHelper =
            String(
              item?.helper_id || ""
            )
            .toUpperCase();

          return (
            sameMission &&
            itemHelper === expectedHelper
          );

        }
      )
      .sort(
        (a,b) => {

          const aTime =
            new Date(
              a.updated_at ||
              a.created_at ||
              0
            )
            .getTime();

          const bTime =
            new Date(
              b.updated_at ||
              b.created_at ||
              0
            )
            .getTime();

          return bTime - aTime;

        }
      );

  const location =
    matching[0];

  if(!location){
    return null;
  }

  const latitude =
    latitudeOf(location);

  const longitude =
    longitudeOf(location);

  if(
    !validLatitude(latitude) ||
    !validLongitude(longitude)
  ){
    return null;
  }

  const updatedAt =
    location.updated_at ||
    location.created_at ||
    null;

  const updatedTime =
    updatedAt
      ?
      new Date(updatedAt)
        .getTime()
      :
      NaN;

  const age =
    Date.now() -
    updatedTime;

  const fresh =
    Number.isFinite(updatedTime) &&
    age >= 0 &&
    age <= LOCATION_MAX_AGE_MS;

  if(!fresh){
    return null;
  }

  return {
    latitude,
    longitude,

    heading:
      Number.isFinite(
        Number(
          location.heading
        )
      )
        ?
        Number(
          location.heading
        )
        :
        null,

    speed:
      Number.isFinite(
        Number(
          location.speed
        )
      )
        ?
        Number(
          location.speed
        )
        :
        null,

    updated_at:
      updatedAt
  };

}


/* ==========================================
   MAPBOX ROUTE
========================================== */

async function calculateRoute({
  origin,
  destination,
  transport,
  accessToken
}){

  if(
    !origin ||
    !destination
  ){
    return null;
  }

  const coordinates =
    origin.longitude +
    "," +
    origin.latitude +
    ";" +
    destination.longitude +
    "," +
    destination.latitude;

  const endpoint =
    new URL(
      "https://api.mapbox.com/directions/v5/" +
      transport.profile +
      "/" +
      coordinates
    );

  endpoint.searchParams.set(
    "geometries",
    "geojson"
  );

  endpoint.searchParams.set(
    "overview",
    "full"
  );

  endpoint.searchParams.set(
    "steps",
    "true"
  );

  endpoint.searchParams.set(
    "alternatives",
    "false"
  );

  endpoint.searchParams.set(
    "access_token",
    accessToken
  );

  const response =
    await fetch(
      endpoint.toString(),
      {
        method:"GET",

        headers:{
          "Accept":
            "application/json"
        }
      }
    );

  let data;

  try{

    data =
      await response.json();

  }
  catch{

    throw new Error(
      "Invalid Mapbox response."
    );

  }

  if(
    !response.ok ||
    data.code !== "Ok"
  ){

    console.error(
      "Mapbox route error:",
      response.status,
      data?.code,
      data?.message
    );

    return null;

  }

  const route =
    Array.isArray(
      data.routes
    )
      ?
      data.routes[0]
      :
      null;

  if(!route){
    return null;
  }

  const distanceMeters =
    Number(
      route.distance
    );

  const durationSeconds =
    Number(
      route.duration
    );

  if(
    !Number.isFinite(
      distanceMeters
    ) ||
    !Number.isFinite(
      durationSeconds
    )
  ){
    return null;
  }

  const generatedAt =
    new Date();

  const estimatedArrival =
    new Date(
      generatedAt.getTime() +
      durationSeconds * 1000
    );

  return {
    mode:
      transport.mode,

    distance_meters:
      Math.round(
        distanceMeters
      ),

    distance_miles:
      Number(
        (
          distanceMeters /
          1609.344
        )
        .toFixed(2)
      ),

    duration_seconds:
      Math.round(
        durationSeconds
      ),

    duration_minutes:
      Math.max(
        1,
        Math.round(
          durationSeconds /
          60
        )
      ),

    estimated_arrival:
      estimatedArrival
        .toISOString(),

    generated_at:
      generatedAt
        .toISOString(),

    geometry:
      route.geometry,

    steps:
      extractSteps(
        route
      )
  };

}


/* ==========================================
   TURN-BY-TURN STEPS
========================================== */

function extractSteps(route){

  const output = [];

  const legs =
    Array.isArray(
      route.legs
    )
      ?
      route.legs
      :
      [];

  for(
    const leg of legs
  ){

    const steps =
      Array.isArray(
        leg.steps
      )
        ?
        leg.steps
        :
        [];

    for(
      const step of steps
    ){

      const maneuver =
        step.maneuver ||
        {};

      output.push({
        instruction:
          cleanText(
            maneuver.instruction ||
            "",
            300
          ),

        street:
          cleanText(
            step.name ||
            "",
            150
          ),

        distance_meters:
          Number.isFinite(
            Number(
              step.distance
            )
          )
            ?
            Math.round(
              Number(
                step.distance
              )
            )
            :
            null,

        duration_seconds:
          Number.isFinite(
            Number(
              step.duration
            )
          )
            ?
            Math.round(
              Number(
                step.duration
              )
            )
            :
            null
      });

    }

  }

  return output;

}


/* ==========================================
   MAIN
========================================== */

export default async request => {

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

    const helperToken =
      cleanToken(
        body?.helper_token
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

    if(
      !validMissionId(
        missionId
      )
    ){

      return jsonResponse(
        {
          ok:false,
          error:
            "Invalid HUG Mission number."
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

          safeHashEqual(
            tokenHash,
            item.helper_token_hash
          )
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
       SESSION EXPIRATION
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
       VERIFY HELPER
    ====================================== */

    const helperId =
      cleanText(
        session.helper_id,
        80
      )
      .toUpperCase();

    if(
      !validHelperId(
        helperId
      )
    ){

      return jsonResponse(
        {
          ok:false,
          error:
            "Invalid HUGS Helper session."
        },
        403
      );

    }

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
            helperId
      );

    if(
      !helper ||
      helper.status !== "Approved"
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
          error:
            "HUG Mission not found."
        },
        404
      );

    }


    /* ======================================
       VERIFY ASSIGNMENT
    ====================================== */

    if(
      String(
        mission.assigned_helper_id ||
        ""
      )
      .toUpperCase() !==
      helperId
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
       DELIVERED = CLOSED
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

          navigation:
            null,

          message:
            "HUG Delivered ❤️"
        }
      );

    }


    if(
      !ACTIVE_STATUSES.has(
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

    const privateRoute =
      routes.find(
        item =>
          String(
            item?.mission_id || ""
          ) === missionId
      );

    if(!privateRoute){

      return jsonResponse(
        {
          ok:true,

          mission_status:
            mission.status,

          destination_unlocked:
            false,

          route:
            null,

          navigation:
            null,

          message:
            "The private route has not been prepared yet."
        }
      );

    }

    const pickup =
      safePickup(
        privateRoute
      );

    if(!pickup){

      return jsonResponse(
        {
          ok:false,
          error:
            "The HUG pickup location is not configured correctly."
        },
        500
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

    const destination =
      destinationUnlocked
        ?
        safeDestination(
          privateRoute
        )
        :
        null;

    if(
      destinationUnlocked &&
      !destination
    ){

      return jsonResponse(
        {
          ok:false,
          error:
            "The HUG destination is not configured correctly."
        },
        500
      );

    }


    /* ======================================
       CURRENT HELPER LOCATION
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

    const helperLocation =
      findLiveLocation(
        locations,
        missionId,
        helperId
      );


    /* ======================================
       NAVIGATION TARGET
    ====================================== */

    const navigationTarget =
      destinationUnlocked
        ?
        destination
        :
        pickup;

    const transport =
      getTransportMode(
        mission
      );

    let navigation =
      null;

    const mapboxToken =
      process.env
        .MAPBOX_ACCESS_TOKEN;

    if(
      helperLocation &&
      mapboxToken
    ){

      navigation =
        await calculateRoute({
          origin:
            helperLocation,

          destination:
            navigationTarget,

          transport,

          accessToken:
            mapboxToken
        });

    }


    /* ======================================
       PICKUP-ONLY RESPONSE
    ====================================== */

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

          transport_mode:
            transport.mode,

          helper_location:
            helperLocation,

          route:{
            pickup
          },

          navigation,

          message:
            helperLocation
              ?
              (
                navigation
                  ?
                  "Route to HUG pickup ready."
                  :
                  "Pickup ready. Navigation is waiting for the routing service."
              )
              :
              "Pickup ready. Start live location to calculate your route."
        }
      );

    }


    /* ======================================
       DESTINATION RESPONSE
    ====================================== */

    return jsonResponse(
      {
        ok:true,

        mission_status:
          mission.status,

        destination_unlocked:
          true,

        transport_mode:
          transport.mode,

        helper_location:
          helperLocation,

        route:{
          pickup,
          destination
        },

        navigation,

        message:
          helperLocation
            ?
            (
              navigation
                ?
                "Route to HUG destination ready."
                :
                "Destination unlocked. Navigation is waiting for the routing service."
            )
            :
            "Destination unlocked. Start live location to calculate your route."
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
