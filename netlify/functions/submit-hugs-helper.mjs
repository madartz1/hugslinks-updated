import { getStore } from "@netlify/blobs";

/*
 * HUGSLinks
 * HUGS Helper Registration
 *
 * File:
 * netlify/functions/submit-hugs-helper.mjs
 *
 * PURPOSE
 * -------
 * Creates a private HUGS Helper record and
 * generates the official Helper ID server-side.
 *
 * Helper information is NOT public.
 */


const STORE_NAME =
  "hugs-help-helpers";

const HELPERS_KEY =
  "helpers";


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
   EMAIL
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
   HELPER ID
========================================== */

function createHelperId(){

  const year =
    new Date()
      .getFullYear();


  const random =
    String(
      Math.floor(
        100000 +
        Math.random() * 900000
      )
    );


  return (
    "HELPER-" +
    year +
    "-" +
    random
  );

}


/* ==========================================
   ALLOWED HELP TYPES
========================================== */

const allowedHelpTypes =
  new Set([

    "Food Pickup",

    "Local Delivery",

    "Essential Shopping",

    "Resource Support",

    "Creative Skills",

    "Business Skills",

    "Community Support",

    "Business Partner Pickup"

  ]);


/* ==========================================
   ALLOWED TRANSPORTATION
========================================== */

const allowedTransportation =
  new Set([

    "Walking",

    "Bike",

    "E-Bike",

    "Public Transit",

    "Car",

    "Van",

    "Other",

    "None"

  ]);


/* ==========================================
   READ HELPERS
========================================== */

async function readHelpers(
  store
){

  const stored =
    await store.get(
      HELPERS_KEY,
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
      stored.helpers
    )
  ){

    return stored.helpers;

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
   SAVE HELPERS
========================================== */

async function saveHelpers(
  store,
  helpers
){

  await store.setJSON(
    HELPERS_KEY,
    {

      updated_at:
        new Date()
          .toISOString(),

      helpers

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
    catch(error){

      return jsonResponse(
        {
          ok:false,
          error:"Invalid request."
        },
        400
      );

    }


    /* ======================================
       HONEYPOT
    ====================================== */

    if(
      cleanText(
        body?.bot_field,
        200
      )
    ){

      return jsonResponse(
        {
          ok:true,
          message:"Registration received."
        }
      );

    }


    /* ======================================
       BASIC INFORMATION
    ====================================== */

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


    const travelRange =
      cleanText(
        body?.travel_range,
        100
      );


    const carryingCapacity =
      cleanText(
        body?.carrying_capacity,
        500
      );


    const availability =
      cleanText(
        body?.availability,
        100
      );


    const skillsExperience =
      cleanText(
        body?.skills_experience,
        1500
      );


    const consent =
      body?.helper_consent === true ||
      body?.helper_consent === "Yes";


    /* ======================================
       HELP TYPES
    ====================================== */

    let helpTypes =
      Array.isArray(
        body?.help_types
      )
        ? body.help_types
        : [];


    helpTypes =
      helpTypes

        .map(
          item =>
            cleanText(
              item,
              100
            )
        )

        .filter(
          item =>
            allowedHelpTypes.has(
              item
            )
        );


    helpTypes =
      [
        ...new Set(
          helpTypes
        )
      ];


    /* ======================================
       TRANSPORTATION
    ====================================== */

    let transportation =
      Array.isArray(
        body?.transportation
      )
        ? body.transportation
        : [];


    transportation =
      transportation

        .map(
          item =>
            cleanText(
              item,
              100
            )
        )

        .filter(
          item =>
            allowedTransportation.has(
              item
            )
        );


    transportation =
      [
        ...new Set(
          transportation
        )
      ];


    /* ======================================
       VALIDATION
    ====================================== */

    if(
      !firstName ||
      !email ||
      !city
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Please complete the required Helper information."
        },
        400
      );

    }


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


    if(
      helpTypes.length === 0
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Please select at least one way you can help."
        },
        400
      );

    }


    if(
      !consent
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "Consent is required to register as a HUGS Helper."
        },
        400
      );

    }


    /* ======================================
       OPEN PRIVATE STORE
    ====================================== */

    const store =
      getStore(
        STORE_NAME
      );


    const helpers =
      await readHelpers(
        store
      );


    /* ======================================
       EXISTING EMAIL
    ====================================== */

    const existingHelper =
      helpers.find(
        helper =>
          String(
            helper?.email || ""
          )
          .toLowerCase() ===
          email
      );


    if(
      existingHelper
    ){

      return jsonResponse(
        {
          ok:false,

          error:
            "A HUGS Helper registration already exists for this email address."
        },
        409
      );

    }


    /* ======================================
       UNIQUE HELPER ID
    ====================================== */

    let helperId;


    do{

      helperId =
        createHelperId();

    }
    while(
      helpers.some(
        helper =>
          helper.id ===
          helperId
      )
    );


    const now =
      new Date()
        .toISOString();


    /* ======================================
       PRIVATE HELPER RECORD
    ====================================== */

    const helper = {

      id:
        helperId,

      status:
        "Registered",

      created_at:
        now,

      reviewed_at:
        null,


      /* PRIVATE CONTACT INFORMATION */

      first_name:
        firstName,

      last_name:
        lastName,

      email,

      phone,


      /* GENERAL SERVICE AREA */

      city,

      borough_area:
        area,

      zip_code:
        zipCode,

      travel_range:
        travelRange,


      /* HELPER CAPABILITIES */

      help_types:
        helpTypes,

      transportation,

      carrying_capacity:
        carryingCapacity,

      availability,

      skills_experience:
        skillsExperience,


      /* CONSENT */

      helper_consent:
        true,

      consent_recorded_at:
        now

    };


    helpers.push(
      helper
    );


    await saveHelpers(
      store,
      helpers
    );


    /*
     * Only return what the Helper needs.
     *
     * Do not echo the complete private
     * registration back to the browser.
     */

    return jsonResponse(
      {
        ok:true,

        message:
          "Your HUGS Helper registration has been received.",

        helper_id:
          helperId,

        status:
          "Registered"
      },
      201
    );


  }
  catch(error){


    console.error(
      "HUGS Helper registration error:",
      error
    );


    return jsonResponse(
      {
        ok:false,

        error:
          "We could not complete your HUGS Helper registration right now."
      },
      500
    );

  }

};
