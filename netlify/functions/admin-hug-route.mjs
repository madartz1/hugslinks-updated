import { getStore } from "@netlify/blobs";

const MISSION_STORE_NAME =
  "hugs-help-missions";

const ROUTE_STORE_NAME =
  "hugs-help-private-routes";

const MISSIONS_KEY =
  "missions";

const ROUTES_KEY =
  "routes";


const headers = {
  "Content-Type":
    "application/json; charset=utf-8",

  "Cache-Control":
    "no-store, no-cache, must-revalidate"
};


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


function validCoordinate(
  value,
  min,
  max
){

  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}


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

    /* ADMIN AUTH */

    const configuredToken =
      process.env.HUGS_ADMIN_TOKEN;


    if(!configuredToken){

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


    const auth =
      request.headers.get(
        "authorization"
      ) || "";


    if(
      auth !==
      `Bearer ${configuredToken}`
    ){

      return jsonResponse(
        {
          ok:false,
          error:"Unauthorized."
        },
        401
      );
    }


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
      Number(
        body?.pickup_latitude
      );


    const pickupLongitude =
      Number(
        body?.pickup_longitude
      );


    const destinationLatitude =
      Number(
        body?.destination_latitude
      );


    const destinationLongitude =
      Number(
        body?.destination_longitude
      );


    if(!missionId){

      return jsonResponse(
        {
          ok:false,
          error:"Mission ID is required."
        },
        400
      );
    }


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
          error:"Valid pickup and destination coordinates are required."
        },
        400
      );
    }


    /* VERIFY MISSION */

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
          error:"HUG Mission not found."
        },
        404
      );
    }


    if(
      !mission.assigned_helper_id
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


    /* ROUTE */

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


    const existingIndex =
      routes.findIndex(
        item =>
          item.mission_id ===
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
        ].created_at || now;


      routes[
        existingIndex
      ] =
        route;
    }


    await routeStore.setJSON(
      ROUTES_KEY,
      {
        updated_at:
          now,

        routes
      }
    );


    return jsonResponse(
      {
        ok:true,

        mission_id:
          missionId,

        message:
          "Private HUG route saved."
      }
    );


  }
  catch(error){

    console.error(
      "HUG route admin error:",
      error
    );


    return jsonResponse(
      {
        ok:false,
        error:"Private HUG route could not be saved."
      },
      500
    );
  }
};
