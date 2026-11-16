import { getStore } from "@netlify/blobs";
import { collectUpdates } from "../lib/community-updates.mjs";

export function newsStore(context) {
  // Preview data must never overwrite the production daily edition.
  const suffix = context?.deploy?.context === "production" ? "production" : (context?.deploy?.id || "local");
  return getStore(`hugs-community-news-${suffix}`);
}
export default async (request, context) => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  let saved = null;
  let storageError = false;
  try { saved = await newsStore(context).get("latest", { type: "json" }); }
  catch { storageError = true; }
  const stale = !saved || Date.now() - Date.parse(saved.generated_at) > 26 * 3600000;
  let data = saved;
  if (stale) {
    const fresh = await collectUpdates();
    if (fresh.ok) {
      data = fresh;
      try { await newsStore(context).setJSON("latest", data); } catch { storageError = true; }
    } else if (saved) {
      data = { ...saved, stale: true, live_status: "partial", errors: [...fresh.errors, "Daily refresh failed; showing the previous edition."] };
    } else data = fresh;
  }
  if (storageError) data = { ...data, live_status: "partial", errors: [...(data.errors || []), "Daily cache unavailable; source results shown."] };
  // Never present yesterday's incident as a current emergency alert.
  const now = Date.now();
  data = { ...data, alerts: (data.alerts || []).filter(x => now - Date.parse(x.published_at) < 86400000) };
  data.highlights = [data.alerts[0], data.council?.[0], data.news?.[0]].filter(Boolean);
  return Response.json(data, { status: data.ok ? 200 : 503, headers: { "Cache-Control": "public, max-age=0, s-maxage=900", "X-Content-Type-Options": "nosniff" } });
};
