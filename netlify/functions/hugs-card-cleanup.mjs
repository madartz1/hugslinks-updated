import { dependencies } from './_shared/hugs-card-links.mjs';
// Netlify schedules run on published deploys, not Deploy Previews. Preview links
// still expire immediately at 30 days; sender removal also purges their media.
export default async () => {
 const d=dependencies();if(!d.configured)return new Response('Not configured',{status:503});
 await d.store.init();let removed=0;
 for(const row of await d.store.expired()){
  await d.store.revoke(row.id);
  try{await d.storage.remove(row);await d.store.purged(row.id);removed++;}catch{console.error('HUG card cleanup will retry');}
 }
 await d.store.cleanCodes();return Response.json({removed});
};
export const config={schedule:'@daily'};
