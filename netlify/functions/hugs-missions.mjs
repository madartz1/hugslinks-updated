import { getStore } from "@netlify/blobs";

/*
 * HUGSLinks
 * HUG Missions — Public Mission Feed
 *
 * File:
 * netlify/functions/hugs-missions.mjs
 *
 * PURPOSE
 * -------
 * Returns ONLY approved, sanitized HUG Missions
 * that are safe for the Helper-facing mission board.
 *
 * This function does NOT:
 * - expose original HUG Request submissions
 * - expose requester names
 * - expose email addresses
 * - expose phone numbers
 * - expose exact addresses
 * - expose shelter/location details
 * - approve missions
 * - allow Helpers to modify missions
 *
 * Approval happens separately.
 */


const STORE_NAME = "hugs-help-missions";

const MISSIONS_KEY = "missions";


/*
 * These are the ONLY fields the public mission
 * board is allowed to receive.
 */

const PUBLIC_FIELDS = [
  "id",
  "type",
  "area",
  "city",
  "timing",
  "summary",
  "status",
  "approved",
  "created_at"
];


/*
 * CORS / response headers.
 */

const headers = {
  "Content-Type": "application/json; charset=utf-8",

  "Cache-Control":
    "no-store, no-cache, must-revalidate"
};


/*
 * Standard JSON response helper.
 */

function jsonResponse(
  body,
  status = 200
) {

  return new Response(
    JSON.stringify(body),
    {
      status,
      headers
    }
  );

}


/*
 * Only copy explicitly approved public fields.
 *
 * Even if private information accidentally exists
 * inside the stored mission object, it will not be
 * returned by this endpoint.
 */

function sanitizeMission(
  mission
) {

  const safeMission = {};


  for(
    const field of PUBLIC_FIELDS
  ) {

    if(
      Object.prototype.hasOwnProperty.call(
        mission,
        field
      )
    ) {

      safeMission[field] =
        mission[field];

    }

  }


  return safeMission;

}


/*
 * Normalize values before returning them.
 */

function normalizeMission(
  mission
) {

  const safe =
    sanitizeMission(
      mission
    );


  return {

    id:
      String(
        safe.id || ""
      ),

    type:
      String(
        safe.type ||
        "Community Support"
      ),

    area:
      String(
        safe.area || ""
      ),

    city:
      String(
        safe.city || ""
      ),

    timing:
      String(
        safe.timing ||
        "Flexible"
      ),

    summary:
      String(
        safe.summary ||
        "Approved community assistance request."
      ),

    status:
      String(
        safe.status ||
        "Available"
      ),

    approved:
      safe.approved === true,

    created_at:
      String(
        safe.created_at || ""
      )

  };

}


/*
 * Determine whether a mission is allowed
 * on the public Helper board.
 */

function isPublicMission(
  mission
) {

  if(
    !mission ||
    typeof mission !== "object"
  ) {

    return false;

  }


  /*
   * Mission must have been explicitly approved.
   */

  if(
    mission.approved !== true
  ) {

    return false;

  }


  /*
   * Only AVAILABLE missions appear publicly.
   *
   * Accepted/in-progress missions will eventually
   * be handled through the Helper's mission view.
   */

  if(
    mission.status !== "Available"
  ) {

    return false;

  }


  /*
   * Mission needs a public ID.
   */

  if(
    !mission.id
  ) {

    return false;

  }


  return true;

}


/*
 * Safely read the mission collection.
 */

async function readMissions(
  store
) {

  try {

    const stored =
      await store.get(
        MISSIONS_KEY,
        {
          type: "json",
          consistency: "strong"
        }
      );


    /*
     * First run:
     * no mission collection exists yet.
     */

    if(
      stored === null ||
      stored === undefined
    ) {

      return [];

    }


    /*
     * Preferred storage shape:
     *
     * {
     *   missions: [...]
     * }
     */

    if(
      Array.isArray(
        stored.missions
      )
    ) {

      return stored.missions;

    }


    /*
     * Also tolerate an older/direct array shape
     * if we ever migrate storage.
     */

    if(
      Array.isArray(
        stored
      )
    ) {

      return stored;

    }


    return [];

  }
  catch(error) {

    console.error(
      "Unable to read HUG Missions:",
      error
    );


    throw error;

  }

}


/*
 * Sort newest missions first.
 */

function sortMissions(
  missions
) {

  return missions.sort(
    (a,b) => {

      const aTime =
        Date.parse(
          a.created_at || ""
        ) || 0;


      const bTime =
        Date.parse(
          b.created_at || ""
        ) || 0;


      return bTime - aTime;

    }
  );

}


/*
 * MAIN NETLIFY FUNCTION
 */

export default async (
  request,
  context
) => {

  /*
   * Public endpoint is GET only.
   */

  if(
    request.method !== "GET"
  ) {

    return jsonResponse(
      {
        ok:false,

        error:
          "Method not allowed."
      },
      405
    );

  }


  try {

    /*
     * Open the dedicated HUG Missions store.
     */

    const store =
      getStore(
        STORE_NAME
      );


    /*
     * Retrieve stored missions.
     */

    const storedMissions =
      await readMissions(
        store
      );


    /*
     * Critical privacy boundary:
     *
     * 1. approved only
     * 2. available only
     * 3. explicit public fields only
     */

    const publicMissions =
      storedMissions

        .filter(
          isPublicMission
        )

        .map(
          normalizeMission
        );


    sortMissions(
      publicMissions
    );


    return jsonResponse(
      {
        ok:true,

        count:
          publicMissions.length,

        missions:
          publicMissions
      }
    );

  }
  catch(error) {

    console.error(
      "HUG Missions endpoint error:",
      error
    );


    return jsonResponse(
      {
        ok:false,

        count:0,

        missions:[],

        error:
          "HUG Missions are temporarily unavailable."
      },
      500
    );

  }

};
