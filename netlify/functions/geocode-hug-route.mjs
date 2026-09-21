import crypto from "node:crypto";

/*
 * HUGSLinks
 * Secure Private HUG Route Geocoder
 *
 * FILE:
 * netlify/functions/geocode-hug-route.mjs
 *
 * PURPOSE
 * -------
 * - Accept private pickup and destination addresses
 *   from authenticated HUGS Admin.
 *
 * - Send the addresses to Mapbox Geocoding API v6.
 *
 * - Return standardized addresses and coordinates
 *   for Admin review.
 *
 * - Keep MAPBOX_ACCESS_TOKEN server-side.
 *
 * - Never write addresses into the public
 *   HUG Mission collection.
 *
 * REQUIRED NETLIFY ENVIRONMENT VARIABLES
 * --------------------------------------
 *
 * HUGS_ADMIN_TOKEN
 * MAPBOX_ACCESS_TOKEN
 */


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
   CLEAN TEXT
========================================== */

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
      /[\u0000-\u001F\u007F]/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .slice(
      0,
      maxLength
    );

}


/* ==========================================
   TIMING-SAFE TOKEN COMPARISON
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
   ADMIN AUTHENTICATION
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
   COORDINATE VALIDATION
========================================== */

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
   MAPBOX GEOCODER
========================================== */

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
   *
   * Restricting the search reduces accidental
   * international matches.
   */

  endpoint.searchParams.set(
    "country",
    "US"
  );


  /*
   * Exact address-level results only.
   */

  endpoint.searchParams.set(
    "types",
    "address,secondary_address"
  );


  /*
   * Admin submits a completed address.
   *
   * We do not call Mapbox on every keystroke.
   */

  endpoint.searchParams.set(
    "autocomplete",
    "false"
  );


  /*
   * We need one candidate for the Admin
   * verification screen.
   */

  endpoint.searchParams.set(
    "limit",
    "1"
  );


  /*
   * HUGS intends to retain the verified
   * coordinates with the private active
   * Mission route.
   *
   * IMPORTANT:
   * Confirm the production Mapbox account/token
   * is eligible for permanent geocoding before
   * enabling this in production.
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

        },

        cache:
          "no-store"

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


  /* ======================================
     FIRST MATCH
  ====================================== */

  const feature =
    Array.isArray(
      data.features
    )
      ?
      data.features[0]
      :
      null;


  if(!feature){

    return null;

  }


  /* ======================================
     COORDINATES
  ====================================== */

  const coordinates =
    feature.geometry?.coordinates;


  if(
    !Array.isArray(
      coordinates
    ) ||
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
    !validLatitude(
      latitude
    ) ||
    !validLongitude(
      longitude
    )
  ){

    return null;

  }


  /* ======================================
     MAPBOX PROPERTIES
  ====================================== */

  const properties =
    feature.properties ||
    {};


  const name =
    cleanText(
      properties.name ||
      feature.text ||
      "",
      200
    );


  const placeFormatted =
    cleanText(
      properties.place_formatted ||
      feature.place_name ||
      "",
      350
    );


  /*
   * Mapbox v6 may supply full_address.
   *
   * Otherwise construct a readable address.
   */

  const fullAddress =
    cleanText(
      properties.full_address ||
      [
        name,
        placeFormatted
      ]
      .filter(Boolean)
      .join(", ") ||
      address,
      450
    );


  const accuracy =
    cleanText(
      properties.coordinates?.accuracy ||
      properties.accuracy ||
      "",
      100
    ) || null;


  /*
   * match_code can be an object.
   *
   * Keep it structured rather than converting
   * it to "[object Object]".
   */

  const matchCode =

    properties.match_code &&
    typeof properties.match_code ===
      "object"

      ?
      properties.match_code

      :
      null;


  /* ======================================
     SAFE RESULT
  ====================================== */

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

        error:
          "Method not allowed."

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

          error:
            "Admin service is not configured."

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

          error:
            "Unauthorized."

        },
        401
      );

    }


    /* ======================================
       MAPBOX CONFIGURATION
    ====================================== */

    const mapboxToken =
      process.env
        .MAPBOX_ACCESS_TOKEN;


    if(!mapboxToken){

      console.error(
        "MAPBOX_ACCESS_TOKEN is not configured."
      );


      return jsonResponse(
        {

          ok:false,

          error:
            "HUGS routing service is not configured yet."

        },
        503
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

          error:
            "Invalid request data."

        },
        400
      );

    }


    /* ======================================
       PRIVATE ADDRESSES
    ====================================== */

    const pickupAddress =
      cleanText(
        body?.pickup_address
      );


    const destinationAddress =
      cleanText(
        body?.destination_address
      );


    if(
      !pickupAddress ||
      !destinationAddress
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "Enter both the pickup and destination addresses."

        },
        400
      );

    }


    /*
     * Mapbox free-form forward search does not
     * accept semicolons in the search text.
     *
     * It also prevents multiple locations from
     * being packed into one HUG route field.
     */

    if(
      pickupAddress.includes(";") ||
      destinationAddress.includes(";")
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "Enter one pickup address and one destination address."

        },
        400
      );

    }


    /* ======================================
       GEOCODE BOTH LOCATIONS
    ====================================== */

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


    /* ======================================
       PICKUP RESULT
    ====================================== */

    if(!pickup){

      return jsonResponse(
        {

          ok:false,

          error:
            "The pickup address could not be located. Check the address and try again."

        },
        404
      );

    }


    /* ======================================
       DESTINATION RESULT
    ====================================== */

    if(!destination){

      return jsonResponse(
        {

          ok:false,

          error:
            "The destination address could not be located. Check the address and try again."

        },
        404
      );

    }


    /* ======================================
       RESPONSE CONTRACT
    ====================================== */

    return jsonResponse(
      {

        ok:true,

        pickup:{

          input_address:
            pickup.input_address,

          formatted_address:
            pickup.formatted_address,

          latitude:
            pickup.latitude,

          longitude:
            pickup.longitude,

          accuracy:
            pickup.accuracy,

          match_code:
            pickup.match_code

        },

        destination:{

          input_address:
            destination.input_address,

          formatted_address:
            destination.formatted_address,

          latitude:
            destination.latitude,

          longitude:
            destination.longitude,

          accuracy:
            destination.accuracy,

          match_code:
            destination.match_code

        }

      }
    );


  }
  catch(error){


    console.error(
      "Secure HUG route geocoding failed:",
      error
    );


    return jsonResponse(
      {

        ok:false,

        error:
          "HUGS could not verify the route locations right now."

      },
      502
    );

  }

};
