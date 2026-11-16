import { collectUpdates } from "../lib/community-updates.mjs";
import { newsStore } from "./nyc-updates.mjs";

export default async (_request, context) => {
  const data = await collectUpdates();
  if (!data.ok) throw new Error("All news sources failed; keeping the previous edition.");
  await newsStore(context).setJSON("latest", data);
  console.log(JSON.stringify({ checkedAt: data.generated_at, status: data.live_status, errors: data.errors }));
};
// Daily at 13:00 UTC: 8am New York in winter, 9am during daylight saving.
// Activated only after publication; no daily build or paid AI service required.
export const config = { schedule: "0 13 * * *" };
