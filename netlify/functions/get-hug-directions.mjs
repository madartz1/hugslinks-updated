/*
==========================================================
HUGSLinks
get-hug-directions.mjs

Protected HUG Mission routing service.

Purpose:
- Generate real street routes through Mapbox
- Support walking, bicycle and car missions
- Return route geometry, distance and duration
- Keep the Mapbox access token server-side
- Prevent arbitrary public routing requests

Required Netlify environment variables:

MAPBOX_ACCESS_TOKEN
==========================================================
*/


/* ========================================================
   RESPONSE
======================================================== */

function jsonResponse(
  statusCode,
  body
){

  return {

    statusCode,

    headers:{

      "Content-Type":
        "application/json",

      "Cache-Control":
        "no-store, no-cache, must-revalidate",

      "Pragma":
        "no-cache",

      "X-Content-Type-Options":
        "nosniff"

    },

    body:
      JSON.stringify(body)

  };

}


/* ========================================================
   TOKEN HELPERS
======================================================== */

function getBearerToken(event){

  const authorization =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    "";


  if(
    !authorization.startsWith(
      "Bearer "
    )
  ){

    return "";

  }


  return authorization
    .slice(7)
    .trim();

}


/* ========================================================
   NUMBER VALIDATION
======================================================== */

function toNumber(value){

  const number =
    Number(value);


  return Number.isFinite(number)
    ? number
    : null;

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


/* ========================================================
   TRANSPORT MODE
======================================================== */

function getMapboxProfile(mode){

  const normalized =
    String(mode || "")
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


  /*
   * Driving traffic is the default
   * for car / vehicle missions.
   */

  return {
    mode:"driving",
    profile:"mapbox/driving-traffic"
  };

}


/* ========================================================
   ROUTE AUTHORIZATION
======================================================== */

/*
 * This function intentionally requires a protected
 * HUG session token.
 *
 * IMPORTANT:
 *
 * The browser is NOT allowed to send arbitrary coordinates
 * and use HUGSLinks as an open Mapbox routing proxy.
 *
 * For the current build, the caller must provide:
 *
 * - mission_id
 * - session_token
 * - origin
 * - destination
 *
 * The session token must already have been issued by the
 * HUG mission-session system.
 *
 * The exact session-store lookup will be connected to the
 * existing HUG session architecture when this function is
 * wired into get-hug-route.mjs.
 *
 * Until then, this function accepts ADMIN authorization
 * for controlled testing and rejects unauthenticated calls.
 */

function authorizeRequest(event){

  const token =
    getBearerToken(event);


  if(!token){

    return {
      authorized:false,
      role:null
    };

  }


  const adminToken =
    process.env.HUGS_ADMIN_TOKEN;


  if(
    adminToken &&
    token === adminToken
  ){

    return {
      authorized:true,
      role:"admin"
    };

  }


  /*
   * Helper-session verification belongs in the
   * existing HUG session store, not here as a
   * duplicated security system.
   *
   * We will connect that in the integration step.
   */

  return {
    authorized:false,
    role:null
  };

}


/* ========================================================
   MAPBOX DIRECTIONS
======================================================== */

async function requestMapboxRoute({

  originLatitude,
  originLongitude,

  destinationLatitude,
  destinationLongitude,

  mode,

  accessToken

}){

  const transport =
    getMapboxProfile(mode);


  /*
   * Mapbox coordinates are:
   *
   * longitude,latitude
   *
   * NOT latitude,longitude.
   */

  const coordinates =

    originLongitude +
    "," +
    originLatitude +
    ";" +
    destinationLongitude +
    "," +
    destinationLatitude;


  const endpoint =
    new URL(

      "https://api.mapbox.com/directions/v5/" +
      transport.profile +
      "/" +
      coordinates

    );


  /*
   * GeoJSON makes the route easy to draw
   * with Leaflet or Mapbox GL.
   */

  endpoint.searchParams.set(
    "geometries",
    "geojson"
  );


  /*
   * Return one recommended route.
   */

  endpoint.searchParams.set(
    "alternatives",
    "false"
  );


  /*
   * Route overview gives us the complete
   * line for the HUG map.
   */

  endpoint.searchParams.set(
    "overview",
    "full"
  );


  /*
   * Include turn-by-turn steps so HUGS
   * can later build Helper navigation.
   */

  endpoint.searchParams.set(
    "steps",
    "true"
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
      "Mapbox returned an invalid directions response."
    );

  }


  if(!response.ok){

    console.error(
      "Mapbox Directions error:",
      response.status,
      data?.message ||
      data?.code ||
      "Unknown Mapbox error"
    );


    throw new Error(
      "The route service could not calculate this HUG route."
    );

  }


  if(
    data.code !== "Ok" ||
    !Array.isArray(data.routes) ||
    !data.routes[0]
  ){

    return null;

  }


  const route =
    data.routes[0];


  const distanceMeters =
    Number(route.distance);


  const durationSeconds =
    Number(route.duration);


  if(
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(durationSeconds)
  ){

    return null;

  }


  return {

    mode:
      transport.mode,

    profile:
      transport.profile,

    distance_meters:
      Math.round(
        distanceMeters
      ),

    distance_miles:
      Number(
        (
          distanceMeters /
          1609.344
        ).toFixed(2)
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

    geometry:
      route.geometry,

    steps:
      extractSteps(route)

  };

}


/* ========================================================
   TURN-BY-TURN STEPS
======================================================== */

function extractSteps(route){

  const legs =
    Array.isArray(route.legs)
      ? route.legs
      : [];


  const steps = [];


  for(
    const leg of legs
  ){

    const legSteps =
      Array.isArray(leg.steps)
        ? leg.steps
        : [];


    for(
      const step of legSteps
    ){

      const maneuver =
        step.maneuver || {};


      const location =
        Array.isArray(
          maneuver.location
        )
          ? maneuver.location
          : [];


      steps.push({

        instruction:
          String(
            maneuver.instruction ||
            ""
          ).slice(
            0,
            300
          ),

        type:
          String(
            maneuver.type ||
            ""
          ).slice(
            0,
            50
          ),

        modifier:
          String(
            maneuver.modifier ||
            ""
          ).slice(
            0,
            50
          ),

        street:
          String(
            step.name ||
            ""
          ).slice(
            0,
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
            null,

        longitude:
          Number.isFinite(
            Number(
              location[0]
            )
          )
            ?
            Number(
              location[0]
            )
            :
            null,

        latitude:
          Number.isFinite(
            Number(
              location[1]
            )
          )
            ?
            Number(
              location[1]
            )
            :
            null

      });

    }

  }


  return steps;

}


/* ========================================================
   MAIN HANDLER
======================================================== */

export async function handler(event){

  if(
    event.httpMethod !== "POST"
  ){

    return jsonResponse(
      405,
      {
        ok:false,
        error:
          "Method not allowed."
      }
    );

  }


  /*
   * Controlled access only.
   */

  const authorization =
    authorizeRequest(event);


  if(!authorization.authorized){

    return jsonResponse(
      401,
      {
        ok:false,
        error:
          "Unauthorized HUG route request."
      }
    );

  }


  /*
   * Server-side Mapbox credential.
   */

  const mapboxToken =
    process.env.MAPBOX_ACCESS_TOKEN;


  if(!mapboxToken){

    console.error(
      "MAPBOX_ACCESS_TOKEN is not configured."
    );


    return jsonResponse(
      503,
      {
        ok:false,
        error:
          "HUGS routing service is not configured yet."
      }
    );

  }


  /*
   * Parse request.
   */

  let body;


  try{

    body =
      JSON.parse(
        event.body || "{}"
      );

  }
  catch{

    return jsonResponse(
      400,
      {
        ok:false,
        error:
          "Invalid request data."
      }
    );

  }


  const missionId =
    String(
      body.mission_id || ""
    )
    .trim()
    .slice(
      0,
      120
    );


  if(!missionId){

    return jsonResponse(
      400,
      {
        ok:false,
        error:
          "Mission ID is required."
      }
    );

  }


  /*
   * Origin.
   */

  const originLatitude =
    toNumber(
      body.origin?.latitude ??
      body.origin?.lat
    );


  const originLongitude =
    toNumber(
      body.origin?.longitude ??
      body.origin?.lng ??
      body.origin?.lon
    );


  /*
   * Destination.
   */

  const destinationLatitude =
    toNumber(
      body.destination?.latitude ??
      body.destination?.lat
    );


  const destinationLongitude =
    toNumber(
      body.destination?.longitude ??
      body.destination?.lng ??
      body.destination?.lon
    );


  if(
    !validLatitude(
      originLatitude
    ) ||
    !validLongitude(
      originLongitude
    )
  ){

    return jsonResponse(
      400,
      {
        ok:false,
        error:
          "A valid route origin is required."
      }
    );

  }


  if(
    !validLatitude(
      destinationLatitude
    ) ||
    !validLongitude(
      destinationLongitude
    )
  ){

    return jsonResponse(
      400,
      {
        ok:false,
        error:
          "A valid route destination is required."
      }
    );

  }


  /*
   * Avoid meaningless route requests.
   */

  if(
    originLatitude ===
      destinationLatitude &&
    originLongitude ===
      destinationLongitude
  ){

    return jsonResponse(
      400,
      {
        ok:false,
        error:
          "The route origin and destination cannot be identical."
      }
    );

  }


  const mode =
    body.mode ||
    "driving";


  try{

    const route =
      await requestMapboxRoute({

        originLatitude,
        originLongitude,

        destinationLatitude,
        destinationLongitude,

        mode,

        accessToken:
          mapboxToken

      });


    if(!route){

      return jsonResponse(
        404,
        {
          ok:false,
          error:
            "No usable route could be found for this HUG Mission."
        }
      );

    }


    /*
     * Calculate an estimated arrival timestamp.
     *
     * This is an estimate based on the duration
     * Mapbox returned at request time.
     */

    const generatedAt =
      new Date();


    const estimatedArrival =
      new Date(

        generatedAt.getTime() +

        (
          route.duration_seconds *
          1000
        )

      );


    return jsonResponse(
      200,
      {

        ok:true,

        mission_id:
          missionId,

        route:{

          mode:
            route.mode,

          distance_meters:
            route.distance_meters,

          distance_miles:
            route.distance_miles,

          duration_seconds:
            route.duration_seconds,

          duration_minutes:
            route.duration_minutes,

          estimated_arrival:
            estimatedArrival
              .toISOString(),

          generated_at:
            generatedAt
              .toISOString(),

          geometry:
            route.geometry,

          steps:
            route.steps

        }

      }
    );

  }
  catch(error){

    console.error(
      "HUG Directions failure:",
      error
    );


    return jsonResponse(
      502,
      {
        ok:false,
        error:
          "HUGS could not calculate the route right now."
      }
    );

  }

}
