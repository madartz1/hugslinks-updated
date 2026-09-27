const FARMERS_DATASET = "8vwk-6iz2";

const trustedLocators = [
  {
    id: "food-help-nyc",
    type: "free-food",
    name: "NYC Food Help",
    description: "Official NYC locator for free food pantries and community kitchens.",
    url: "https://finder.nyc.gov/foodhelp/locations",
    source: "NYC HRA / DSS",
    live: true
  },
  {
    id: "food-bank-nyc",
    type: "free-food",
    name: "Food Bank For NYC",
    description: "Search free groceries, hot meals, mobile pantries and SNAP support across NYC.",
    url: "https://www.foodbanknyc.org/find-food/",
    source: "Food Bank For New York City",
    live: true
  },
  {
    id: "city-harvest",
    type: "free-food",
    name: "City Harvest Food Map",
    description: "Current free food distributions, pantries, soup kitchens, community fridges and Mobile Markets.",
    url: "https://www.cityharvest.org/food-map/",
    source: "City Harvest",
    live: true
  },
  {
    id: "fridge-finder",
    type: "community-fridge",
    name: "Fridge Finder",
    description: "Find community fridges and current status information.",
    url: "https://www.fridgefinder.app/",
    source: "Fridge Finder",
    live: true
  },
  {
    id: "plentiful",
    type: "reservation",
    name: "Plentiful",
    description: "Find participating food pantries and reserve pickup times where available.",
    url: "https://plentifulapp.com/",
    source: "Plentiful",
    live: true
  },
  {
    id: "access-nyc-food",
    type: "benefits",
    name: "ACCESS NYC Food Assistance",
    description: "Official NYC guidance for Community Food Connection and other food-benefit programs.",
    url: "https://access.nyc.gov/programs/emergency-food-assistance/",
    source: "ACCESS NYC",
    live: true
  }
];

function json(data, status = 200, maxAge = 1800) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=86400`
    }
  });
}

function normalizeMarket(row) {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: `market-${String(row.marketname || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${lat}`,
    type: "farmers-market",
    name: row.marketname || "NYC Farmers Market",
    borough: row.borough || "",
    address: row.streetaddress || "",
    latitude: lat,
    longitude: lng,
    days: row.daysoperation || "",
    hours: row.hoursoperations || "",
    accepts_ebt: String(row.accepts_ebt || "").toLowerCase() === "yes",
    year_round: String(row.open_year_round || "").toLowerCase() === "yes",
    source: "NYC DOHMH / NYC Open Data"
  };
}

export default async () => {
  const currentYear = new Date().getFullYear();
  const sourceUrl = `https://data.cityofnewyork.us/resource/${FARMERS_DATASET}.json?$limit=500&$where=year=${currentYear}`;

  let markets = [];
  let liveStatus = "fallback";
  let liveError = null;

  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "HUGSLinks-Food-Navigator/1.0" }
    });
    if (!res.ok) throw new Error(`NYC Open Data responded ${res.status}`);
    const rows = await res.json();
    markets = rows.map(normalizeMarket).filter(Boolean);
    liveStatus = "live";
  } catch (error) {
    liveError = error?.message || "Live resource update unavailable";
    console.error("HUGS food resource refresh failed:", liveError);
  }

  return json({
    ok: true,
    generated_at: new Date().toISOString(),
    live_status: liveStatus,
    live_error: liveError,
    sources: {
      farmers_markets: {
        dataset: FARMERS_DATASET,
        provider: "NYC Department of Health and Mental Hygiene / NYC Open Data",
        refresh: "Fetched automatically from NYC Open Data and edge-cached for 30 minutes."
      },
      emergency_food: {
        provider: "NYC HRA / DSS and trusted NYC food networks",
        refresh: "Linked to current provider locators because a stable public location API is not exposed."
      }
    },
    markets,
    trusted_locators: trustedLocators
  });
};
