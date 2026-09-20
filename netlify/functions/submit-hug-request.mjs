import { getStore } from "@netlify/blobs";

/*
 * HUGSLinks
 * Private HUG Request Intake
 *
 * File:
 * netlify/functions/submit-hug-request.mjs
 *
 * Flow:
 *
 * Requester
 *   ↓
 * submit-hug-request
 *   ↓
 * PRIVATE hugs-help-requests store
 *   ↓
 * HUGS review
 *   ↓
 * sanitized approved mission
 *   ↓
 * public HUG Mission board
 */


const STORE_NAME =
  "hugs-help-requests";

const REQUESTS_KEY =
  "requests";


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
   EMAIL VALIDATION
========================================== */

function validEmail(
  email
){

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(
      email
    );

}


/* ==========================================
   REQUEST TYPES
========================================== */

const allowedRequestTypes =
  new Set([

    "Food Pickup",

    "Essential Shopping",

    "Supply Delivery",

    "Community Partner Pickup",

    "Housing Navigation",

    "Resource Navigation",

    "Creative Support",

    "Other"

  ]);


/* ==========================================
   TIMING VALUES
========================================== */

const allowedTiming =
  new Set([

    "Today",

    "Within a few days",

    "Flexible"

  ]);


/* ==========================================
   CREATE SERVER-SIDE REQUEST ID
========================================== */

function createRequestId(){

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
        10
      )
      .toUpperCase();


  return (
    "HUGREQ-" +
    year +
    "-" +
    random
  );

}


/* ==========================================
   READ REQUESTS
========================================== */

async function readRequests(
  store
){

  const stored =
    await store.get(
      REQUESTS_KEY,
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
      stored.requests
    )
  ){

    return stored.requests;

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
   SAVE REQUESTS
========================================== */

async function saveRequests(
  store,
  requests
){

  await store.setJSON(
    REQUESTS_KEY,
    {

      updated_at:
        new Date()
          .toISOString(),

      requests

    }
  );

}


/* ==========================================
   MAIN FUNCTION
========================================== */

export default async (
  request,
  context
) => {


  /* ----------------------------------------
     POST ONLY
  ---------------------------------------- */

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


    /* ----------------------------------------
       PARSE JSON
    ---------------------------------------- */

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
            "Invalid request."
        },
        400
      );

    }


    /* ----------------------------------------
       HONEYPOT
    ---------------------------------------- */

    const botField =
      cleanText(
        body?.bot_field,
        200
      );


    if(
      botField
    ){

      /*
       * Do not tell bots why the submission
       * was rejected.
       */

      return jsonResponse(
        {
          ok:true,

          message:
            "Request received."
        },
        200
      );

    }


    /* ----------------------------------------
       CLEAN INPUT
    ---------------------------------------- */

    const firstName =
      cleanText(
        body?.first_name,
        100
      );


    const lastName =
      cleanText(
        body?.last_name,
        100
      );


    const email =
      cleanText(
        body?.email,
        254
      )
      .toLowerCase();


    const phone =
      cleanText(
        body?.phone,
        50
      );


    const requestType =
      cleanText(
        body?.request_type,
        100
      );


    const city =
      cleanText(
        body?.city,
        100
      );


    const area =
      cleanText(
        body?.borough_area,
        100
      );


    const zipCode =
      cleanText(
        body?.zip_code,
        20
      );


    const requestDetails =
      cleanText(
        body?.request_details,
        2000
      );


    const timeNeeded =
      cleanText(
        body?.time_needed,
        100
      );


    const accessibility =
      cleanText(
        body?.accessibility_considerations,
        1000
      );


    const consent =
      body?.request_consent === true ||
      body?.request_consent === "Yes";


    /* ----------------------------------------
       REQUIRED VALUES
    ---------------------------------------- */

    if(
      !firstName ||
      !email ||
      !requestType ||
      !city ||
      !requestDetails ||
      !timeNeeded
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Please complete all required HUG Request fields."
        },
        400
      );

    }


    /* ----------------------------------------
       EMAIL
    ---------------------------------------- */

    if(
      !validEmail(
        email
      )
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Please enter a valid email address."
        },
        400
      );

    }


    /* ----------------------------------------
       REQUEST TYPE
    ---------------------------------------- */

    if(
      !allowedRequestTypes.has(
        requestType
      )
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Please select a valid HUG Request type."
        },
        400
      );

    }


    /* ----------------------------------------
       TIMING
    ---------------------------------------- */

    if(
      !allowedTiming.has(
        timeNeeded
      )
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Please select when the help is needed."
        },
        400
      );

    }


    /* ----------------------------------------
       CONSENT
    ---------------------------------------- */

    if(
      !consent
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Consent is required before submitting a HUG Request."
        },
        400
      );

    }


    /* ----------------------------------------
       CREATE PRIVATE REQUEST
    ---------------------------------------- */

    const requestId =
      createRequestId();


    const now =
      new Date()
        .toISOString();


    const hugRequest = {

      /*
       * INTERNAL REQUEST INFORMATION
       */

      id:
        requestId,

      review_status:
        "Pending Review",

      created_at:
        now,

      reviewed_at:
        null,

      mission_id:
        null,


      /*
       * REQUEST CATEGORY
       */

      request_type:
        requestType,

      time_needed:
        timeNeeded,


      /*
       * PRIVATE CONTACT INFORMATION
       *
       * These fields never belong in the
       * public mission feed.
       */

      first_name:
        firstName,

      last_name:
        lastName,

      email,

      phone,


      /*
       * GENERAL LOCATION
       */

      city,

      borough_area:
        area,

      zip_code:
        zipCode,


      /*
       * PRIVATE REQUEST DETAILS
       */

      request_details:
        requestDetails,

      accessibility_considerations:
        accessibility,


      /*
       * CONSENT RECORD
       */

      request_consent:
        true,

      consent_recorded_at:
        now

    };


    /* ----------------------------------------
       STORE PRIVATELY
    ---------------------------------------- */

    const store =
      getStore(
        STORE_NAME
      );


    const requests =
      await readRequests(
        store
      );


    requests.push(
      hugRequest
    );


    await saveRequests(
      store,
      requests
    );


    /* ----------------------------------------
       RESPONSE
       DO NOT RETURN PRIVATE STORED DATA
    ---------------------------------------- */

    return jsonResponse(
      {
        ok:true,

        message:
          "Your HUG Request has been received for review.",

        request_id:
          requestId,

        status:
          "Pending Review"
      },
      201
    );


  }
  catch(error){


    console.error(
      "Submit HUG Request error:",
      error
    );


    return jsonResponse(
      {
        ok:false,

        error:
          "We could not submit your HUG Request right now."
      },
      500
    );

  }

};
