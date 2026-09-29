const FARMERS_DATASET = "8vwk-6iz2";
const FOOD_HELP_LAYER = "https://services6.arcgis.com/yG5s3afENB5iO9fj/arcgis/rest/services/Food_Help_Programs_PROD_view/FeatureServer/0/query";
const FOOD_HELP_PAGE = "https://finder.nyc.gov/foodhelp/locations";

const trustedLocators = [
  { id:"food-help-nyc", type:"free-food", name:"NYC Food Help", description:"Official NYC locator for free food pantries and community kitchens.", url:FOOD_HELP_PAGE, source:"NYC HRA / DSS", live:true },
  { id:"food-bank-nyc", type:"free-food", name:"Food Bank For NYC", description:"Search free groceries, hot meals, mobile pantries and SNAP support across NYC.", url:"https://www.foodbanknyc.org/find-food/", source:"Food Bank For New York City", live:true },
  { id:"city-harvest", type:"free-food", name:"City Harvest Food Map", description:"Current free food distributions, pantries, soup kitchens, community fridges and Mobile Markets.", url:"https://www.cityharvest.org/food-map/", source:"City Harvest", live:true },
  { id:"fridge-finder", type:"community-fridge", name:"Fridge Finder", description:"Find community fridges and current status information.", url:"https://www.fridgefinder.app/", source:"Fridge Finder", live:true },
  { id:"plentiful", type:"reservation", name:"Plentiful", description:"Find participating food pantries and reserve pickup times where available.", url:"https://plentifulapp.com/", source:"Plentiful", live:true },
  { id:"access-nyc-food", type:"benefits", name:"ACCESS NYC Food Assistance", description:"Official NYC guidance for Community Food Connection and other food-benefit programs.", url:"https://access.nyc.gov/programs/emergency-food-assistance/", source:"ACCESS NYC / HRA", live:true },
  { id:"snap", type:"benefits", name:"SNAP / EBT", description:"Apply for monthly grocery benefits and review current NYC SNAP guidance.", url:"https://access.nyc.gov/programs/supplemental-nutrition-assistance-program-snap/", source:"ACCESS NYC / HRA", live:true },
  { id:"health-bucks", type:"discount", name:"Health Bucks", description:"SNAP shoppers can earn produce incentives at participating NYC farmers markets and farm stands.", url:"https://www.nyc.gov/site/doh/health/health-topics/health-bucks.page", source:"NYC Health", live:true },
  { id:"good-stuff", type:"discount", name:"Get the Good Stuff", description:"SNAP shoppers can earn matching dollars for eligible fruits, vegetables and beans at participating NYC supermarkets.", url:"https://www.nyc.gov/site/doh/health/health-topics/free-produce-snap.page", source:"NYC Health", live:true },
  { id:"nutrition-security", type:"healthy-food", name:"NYC Nutrition Security Programs", description:"Explore Health Bucks, Get the Good Stuff, Groceries to Go and Green Carts.", url:"https://www.nyc.gov/site/foodpolicy/programs/nutrition-security.page", source:"NYC Mayor's Office of Food Policy", live:true }
];

const pantryTypes = {
  FP: "Food Pantry",
  FPH: "Halal Food Pantry",
  FPHA: "Food Pantry for HIV Customers",
  FPK: "Kosher Food Pantry",
  FPM: "Mobile Food Pantry"
};

const kitchenTypes = {
  SK: "Community Kitchen",
  SKK: "Kosher Community Kitchen",
  SKM: "Mobile Community Kitchen"
};

const boroughNames = {
  BK: "Brooklyn",
  BX: "Bronx",
  MN: "Manhattan",
  QN: "Queens",
  SI: "Staten Island"
};

function json(data, status = 200, maxAge = 900) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=86400`
    }
  });
}

function clean(value) {
  const text = String(value ?? "").trim();
  return /^(none provided|null)$/i.test(text) ? "" : text;
}

function normalizeFoodHelp(feature) {
  const row = feature?.attributes || {};
  const latitude = Number(feature?.geometry?.y);
  const longitude = Number(feature?.geometry?.x);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const pantry = pantryTypes[clean(row.type_fp)] || "";
  const kitchen = kitchenTypes[clean(row.type_sk)] || "";
  if (!pantry && !kitchen) return null;

  const schedule = [];
  if (pantry) {
    schedule.push({ service: pantry, days: clean(row.fp_days_orig), hours: clean(row.fp_hours_orig), note: clean(row.fp_notes) });
  }
  if (kitchen) {
    schedule.push({ service:kitchen, days:clean(row.sk_days_orig), hours:clean(row.sk_hours_orig), note:clean(row.sk_notes) });
  }

  const features = ["Free Food"];
  if (pantry) features.push("Groceries");
  if (kitchen) features.push("Hot Meals");
  if (/mobile/i.test(`${pantry} ${kitchen}`)) features.push("Mobile Service");

  const dietary = [];
  if (/halal/i.test(`${pantry} ${kitchen}`)) dietary.push("Halal");
  if (/kosher/i.test(`${pantry} ${kitchen}`)) dietary.push("Kosher");

  const notes = [clean(row.fp_notes), clean(row.sk_notes)].filter(Boolean);
  const hours = schedule.map(item => {
    const timing = [item.days, item.hours].filter(Boolean).join(" • ");
    const detail = timing || item.note;
    return `${item.service}${detail ? `: ${detail}` : ""}`;
  }).join(" | ");

  return {
    id: `nyc-food-${row.FID}`,
    type: pantry && kitchen ? "pantry-kitchen" : pantry ? "food-pantry" : "community-kitchen",
    name: clean(row.program) || "NYC food assistance location",
    category: [pantry, kitchen].filter(Boolean).join(" + "),
    description: pantry && kitchen
      ? "Free groceries and prepared-meal service through NYC Community Food Connection."
      : pantry
        ? "Free groceries through NYC Community Food Connection."
        : "Free prepared meals through NYC Community Food Connection.",
    address: clean(row.distadd),
    address_detail: clean(row.dist_location_info),
    borough: boroughNames[clean(row.distboro)] || clean(row.distboro),
    zip: clean(row.distzip),
    phone: clean(row.org_phone),
    website: "",
    latitude,
    longitude,
    hours,
    schedule,
    notes,
    features,
    dietary,
    price_level: "Free",
    official: true,
    source_label: "NYC Food Help",
    source_url: FOOD_HELP_PAGE
  };
}

async function loadFoodHelpLocations() {
  const fields = [
    "FID", "type_fp", "type_sk", "program", "org_phone", "distadd", "distboro", "distzip",
    "dist_location_info", "fp_days_orig", "fp_hours_orig", "sk_days_orig", "sk_hours_orig",
    "fp_notes", "sk_notes"
  ];
  const url = new URL(FOOD_HELP_LAYER);
  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", fields.join(","));
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("resultRecordCount", "2000");
  url.searchParams.set("orderByFields", "program ASC");
  url.searchParams.set("f", "json");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { "User-Agent":"HUGSLinks-Food-Navigator/2.0" }
  });
  if (!response.ok) throw new Error(`NYC Food Help responded ${response.status}`);
  const data = await response.json();
  if (data?.error) throw new Error(data.error.message || "NYC Food Help query failed");
  return (data.features || []).map(normalizeFoodHelp).filter(Boolean);
}

function normalizeMarket(row) {
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    id: `market-${String(row.marketname || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${latitude}`,
    type: "farmers-market",
    name: row.marketname || "NYC Farmers Market",
    category: "Farmers Market / Fresh Food",
    description: "Fresh-food market listed by NYC. Contact the market or check its current listing before traveling.",
    borough: row.borough || "",
    address: row.streetaddress || "",
    zip: row.zip || "",
    phone: "",
    website: "",
    latitude,
    longitude,
    days: row.daysoperation || "",
    hours: [row.daysoperation, row.hoursoperations].filter(Boolean).join(" • "),
    accepts_ebt: String(row.accepts_ebt || "").toLowerCase() === "yes",
    year_round: String(row.open_year_round || "").toLowerCase() === "yes",
    features: [
      String(row.accepts_ebt || "").toLowerCase() === "yes" ? "SNAP / EBT" : "",
      String(row.open_year_round || "").toLowerCase() === "yes" ? "Year-Round" : "",
      "Fresh Food"
    ].filter(Boolean),
    dietary: ["Fresh Produce", "Vegetarian", "Vegan"],
    price_level: "Varies",
    official: true,
    source_label: "NYC Open Data",
    source_url: "https://data.cityofnewyork.us/"
  };
}

async function loadFarmersMarkets() {
  const currentYear = new Date().getFullYear();
  const sourceUrl = `https://data.cityofnewyork.us/resource/${FARMERS_DATASET}.json?$limit=500&$where=year=${currentYear}`;
  const response = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent":"HUGSLinks-Food-Navigator/2.0" }
  });
  if (!response.ok) throw new Error(`NYC Open Data responded ${response.status}`);
  const rows = await response.json();
  return rows.map(normalizeMarket).filter(Boolean);
}

export default async request => {
  if (request.method !== "GET") return json({ ok:false, error:"Method not allowed." }, 405);

  const [foodResult, marketResult] = await Promise.allSettled([
    loadFoodHelpLocations(),
    loadFarmersMarkets()
  ]);

  const locations = foodResult.status === "fulfilled" ? foodResult.value : [];
  const markets = marketResult.status === "fulfilled" ? marketResult.value : [];
  const errors = [];
  if (foodResult.status === "rejected") errors.push(`Food Help: ${foodResult.reason?.message || "unavailable"}`);
  if (marketResult.status === "rejected") errors.push(`Fresh-food markets: ${marketResult.reason?.message || "unavailable"}`);

  return json({
    ok: true,
    generated_at: new Date().toISOString(),
    live_status: errors.length === 0 ? "live" : (locations.length || markets.length) ? "partial" : "fallback",
    live_errors: errors,
    counts: {
      food_help: locations.length,
      farmers_markets: markets.length
    },
    sources: {
      food_help: {
        provider: "NYC HRA / DSS Food Help NYC",
        url: FOOD_HELP_PAGE,
        refresh: "Fetched from the public NYC Food Help feature layer and edge-cached for 15 minutes."
      },
      farmers_markets: {
        dataset: FARMERS_DATASET,
        provider: "NYC Department of Health and Mental Hygiene / NYC Open Data",
        refresh: "Fetched automatically from NYC Open Data and edge-cached for 15 minutes."
      }
    },
    locations,
    markets,
    trusted_locators: trustedLocators
  });
};
