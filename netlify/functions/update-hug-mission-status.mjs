import { getStore } from "@netlify/blobs";

/*
 * HUGSLinks
 * Assigned Helper Mission Status
 *
 * File:
 * netlify/functions/update-hug-mission-status.mjs
 *
 * STATUS JOURNEY
 * --------------
 * Accepted
 * At Pickup
 * Items Received
 * On the Way
 * Delivered
 *
 * Only the assigned, approved Helper
 * may update the mission.
 */


const HELPER_STORE_NAME =
  "hugs-help-helpers";

const MISSION_STORE_NAME =
  "hugs-help-missions";


const HELPERS_KEY =
  "helpers";

const MISSIONS_KEY =
  "missions";


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
   EMAIL
========================================== */

function validEmail(email){

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);

}


/* ==========================================
   HELPER ID
========================================== */

function validHelperId(
  helperId
){

  return /^HELPER-\d{4}-\d{6}$/i
    .test(helperId);

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
   SAVE MISSIONS
========================================== */

async function saveMissions(
  store,
  missions
){

  await store.setJSON(
    MISSIONS_KEY,
    {

      updated_at:
        new Date()
          .toISOString(),

      missions

    }
  );

}


/* ==========================================
   STATUS ORDER
========================================== */

const STATUS_FLOW = [

  "Accepted",

  "At Pickup",

  "Items Received",

  "On the Way",

  "Delivered"

];


/* ==========================================
   NEXT STATUS
========================================== */

function nextStatus(
  currentStatus
){

  const position =
    STATUS_FLOW.indexOf(
      currentStatus
    );


  if(
    position === -1
  ){

    return null;

  }


  if(
    position >=
    STATUS_FLOW.length - 1
  ){

    return null;

  }


  return STATUS_FLOW[
    position + 1
  ];

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


    const requestedStatus =
      cleanText(
        body?.status,
        80
      );


    if(
      !missionId ||
      !helperId ||
      !helperEmail ||
      !requestedStatus
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "Mission, Helper ID, email and status are required."

        },
        400
      );

    }


    if(
      !validHelperId(
        helperId
      )
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Invalid HUGS Helper reference number."
        },
        400
      );

    }


    if(
      !validEmail(
        helperEmail
      )
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Invalid email address."
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
      !helper
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "We could not verify this HUGS Helper registration."

        },
        403
      );

    }


    /* ======================================
       HELPER MUST STILL BE APPROVED
    ====================================== */

    if(
      helper.status !==
      "Approved"
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


    if(
      !mission
    ){

      return jsonResponse(
        {
          ok:false,
          error:"HUG Mission not found."
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
            "This HUG Mission is not assigned to this Helper."

        },
        403
      );

    }


    /* ======================================
       STATUS VALIDATION
    ====================================== */

    const expectedStatus =
      nextStatus(
        mission.status
      );


    if(
      !expectedStatus
    ){

      if(
        mission.status ===
        "Delivered"
      ){

        return jsonResponse(
          {

            ok:false,

            error:
              "This HUG Mission has already been delivered."

          },
          409
        );

      }


      return jsonResponse(
        {

          ok:false,

          error:
            "This mission cannot be advanced from its current status."

        },
        409
      );

    }


    /*
     * A Helper cannot skip ahead.
     *
     * Accepted
     *   ↓
     * At Pickup
     *   ↓
     * Items Received
     *   ↓
     * On the Way
     *   ↓
     * Delivered
     */

    if(
      requestedStatus !==
      expectedStatus
    ){

      return jsonResponse(
        {

          ok:false,

          error:
            "The next mission status must be: " +
            expectedStatus

        },
        409
      );

    }


    /* ======================================
       UPDATE STATUS
    ====================================== */

    const now =
      new Date()
        .toISOString();


    const previousStatus =
      mission.status;


    mission.status =
      requestedStatus;

    mission.updated_at =
      now;


    /* ======================================
       STATUS TIMESTAMPS
    ====================================== */

    if(
      requestedStatus ===
      "At Pickup"
    ){

      mission.at_pickup_at =
        now;

    }


    if(
      requestedStatus ===
      "Items Received"
    ){

      mission.items_received_at =
        now;

    }


    if(
      requestedStatus ===
      "On the Way"
    ){

      mission.on_the_way_at =
        now;

    }


    if(
      requestedStatus ===
      "Delivered"
    ){

      mission.delivered_at =
        now;

    }


    /* ======================================
       STATUS HISTORY
    ====================================== */

    if(
      !Array.isArray(
        mission.status_history
      )
    ){

      mission.status_history =
        [];

    }


    mission.status_history.push({

      from:
        previousStatus,

      to:
        requestedStatus,

      changed_at:
        now,

      changed_by:
        helperId

    });


    /* ======================================
       SAVE
    ====================================== */

    await saveMissions(
      missionStore,
      missions
    );


    return jsonResponse(
      {

        ok:true,

        message:
          requestedStatus ===
          "Delivered"

            ?

            "HUG Delivered ❤️"

            :

            "Mission status updated.",

        mission_id:
          mission.id,

        status:
          mission.status,

        next_status:
          nextStatus(
            mission.status
          ),

        updated_at:
          now

      }
    );


  }
  catch(error){


    console.error(
      "HUG Mission status error:",
      error
    );


    return jsonResponse(
      {

        ok:false,

        error:
          "We could not update this HUG Mission right now."

      },
      500
    );

  }

};
