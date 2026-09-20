/*
==========================================================
HUGSLinks
geocode-hug-route.mjs

Private HUG Mission address geocoder.

Purpose:
- Accept pickup and destination addresses from HUGS Admin
- Require HUGS Admin authorization
- Send addresses to Mapbox Geocoding API v6
- Return standardized locations + coordinates
- Keep the Mapbox token on the server
- Never expose the Mapbox token to browser HTML

Required Netlify environment variables:

HUGS_ADMIN_TOKEN
MAPBOX_ACCESS_TOKEN
==========================================================
*/


/* ========================================================
   RESPONSE HELPERS
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
   ADMIN AUTHORIZATION
======================================================== */

function getAdminToken(event){

  const authorization =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    "";


  if(
    authorization.startsWith(
      "Bearer "
    )
  ){

    return authorization
      .slice(7)
      .trim();

  }


  return "";

}


function authorized(event){

  const expectedToken =
    process.env.HUGS_ADMIN_TOKEN;


  if(!expectedToken){

    console.error(
      "HUGS_ADMIN_TOKEN is not configured."
    );

    return false;

  }


  const providedToken =
    getAdminToken(event);


  return (
    providedToken &&
    providedToken === expectedToken
  );

}


/* ========================================================
   INPUT CLEANING
======================================================== */

function cleanText(
  value,
  maxLength = 256
){

  if(
    typeof value !== "string"
  ){

    return "";

  }


  return value
    .trim()
    .replace(
      /\s+/g,
      " "
    )
    .slice(
      0,
      maxLength
    );

}


/* ========================================================
   MAPBOX GEOCODER
======================================================== */

async function geocodeAddress(
  address,
  accessToken
){

  const endpoint =
    new URL(
      "https://api.mapbox.com/search/geocode/v6/forward"
    );


  endpoint.searchParams.set(
    "q",
    address
  );


  /*
   * HUGS currently operates in the U.S.
   * This reduces incorrect international matches.
   */

  endpoint.searchParams.set(
    "country",
    "US"
  );


  /*
   * We want an address rather than broad
   * city/state results.
   */

  endpoint.searchParams.set(
    "types",
    "address,secondary_address"
  );


  /*
   * One completed search rather than
   * autocomplete requests on every keystroke.
   */

  endpoint.searchParams.set(
    "autocomplete",
    "false"
  );


  endpoint.searchParams.set(
    "limit",
    "1"
  );


  /*
   * HUGS needs to retain the coordinates
   * with the active Mission route.
   *
   * Permanent geocoding permits storage
   * according to Mapbox's Geocoding terms.
   */

  endpoint.searchParams.set(
    "permanent",
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
      "Mapbox returned an invalid geocoding response."
    );

  }


  if(!response.ok){

    console.error(
      "Mapbox geocoding error:",
      response.status,
      data?.message ||
      "Unknown Mapbox error"
    );


    throw new Error(
      "The address service could not complete this request."
    );

  }


  const feature =
    Array.isArray(data.features)
      ? data.features[0]
      : null;


  if(!feature){

    return null;

  }


  const coordinates =
    feature.geometry?.coordinates;


  if(
    !Array.isArray(coordinates) ||
    coordinates.length < 2
  ){

    return null;

  }


  const longitude =
    Number(
      coordinates[0]
    );


  const latitude =
    Number(
      coordinates[1]
    );


  if(
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ){

    return null;

  }


  /*
   * Mapbox v6 normally supplies the useful
   * display fields through feature.properties.
   *
   * Fallbacks are included defensively.
   */

  const properties =
    feature.properties || {};


  const name =
    properties.name ||
    feature.text ||
    "";


  const placeFormatted =
    properties.place_formatted ||
    feature.place_name ||
    "";


  const fullAddress =
    properties.full_address ||
    [
      name,
      placeFormatted
    ]
    .filter(Boolean)
    .join(", ") ||
    address;


  const accuracy =
    properties.coordinates?.accuracy ||
    properties.accuracy ||
    null;


  const matchCode =
    properties.match_code ||
    null;


  return {

    input_address:
      address,

    formatted_address:
      fullAddress,

    latitude,

    longitude,

    accuracy,

    match_code:
      matchCode

  };

}


/* ========================================================
   MAIN HANDLER
======================================================== */

export async function handler(
  event
){

  /*
   * POST only.
   */

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
   * Admin authorization.
   */

  if(
    !authorized(event)
  ){

    return jsonResponse(
      401,
      {
        ok:false,
        error:
          "Unauthorized HUGS Admin request."
      }
    );

  }


  /*
   * Mapbox token remains server-side.
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


  const pickupAddress =
    cleanText(
      body.pickup_address
    );


  const destinationAddress =
    cleanText(
      body.destination_address
    );


  /*
   * Both locations are required.
   */

  if(
    !pickupAddress ||
    !destinationAddress
  ){

    return jsonResponse(
      400,
      {
        ok:false,
        error:
          "Enter both the pickup and destination addresses."
      }
    );

  }


  /*
   * Mapbox search text is limited.
   * Reject semicolons because Mapbox's
   * forward-geocoding query does not permit
   * them in search text.
   */

  if(
    pickupAddress.includes(";") ||
    destinationAddress.includes(";")
  ){

    return jsonResponse(
      400,
      {
        ok:false,
        error:
          "Pickup and destination addresses cannot contain semicolons."
      }
    );

  }


  try{

    /*
     * Run both searches together.
     */

    const [
      pickup,
      destination
    ] =
      await Promise.all([

        geocodeAddress(
          pickupAddress,
          mapboxToken
        ),

        geocodeAddress(
          destinationAddress,
          mapboxToken
        )

      ]);


    if(!pickup){

      return jsonResponse(
        404,
        {
          ok:false,
          error:
            "The pickup address could not be located. Check the address and try again."
        }
      );

    }


    if(!destination){

      return jsonResponse(
        404,
        {
          ok:false,
          error:
            "The destination address could not be located. Check the address and try again."
        }
      );

    }


    /*
     * Return only the information HUGS
     * Admin needs.
     *
     * The Mapbox access token is never
     * returned.
     */

    return jsonResponse(
      200,
      {

        ok:true,

        pickup,

        destination

      }
    );

  }
  catch(error){

    console.error(
      "HUG route geocoding failed:",
      error
    );


    return jsonResponse(
      502,
      {
        ok:false,
        error:
          "HUGS could not verify the route locations right now."
      }
    );

  }

}
