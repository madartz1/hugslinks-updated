"use strict";
// Server-only adapter. Not an HTTP handler. No generation on import.
// Call only after owner authorization, durable budget reservation and model approval.
const KEY_NAME = "HL_STUDIO_FAL_KEY";
function configuration() {
  const key = process.env[KEY_NAME];
  return {configured: Boolean(key && key.trim()), preview: ["deploy-preview","branch-deploy"].includes(process.env.CONTEXT)};
}
function previewHeaders() {
  const state = configuration();
  if (!state.preview || !state.configured) throw new Error("Preview provider unavailable");
  return {Authorization: "Key " + process.env[KEY_NAME].trim(), "Content-Type":"application/json"};
}
// Read-only queue status for an existing request; does not submit a generation.
async function status(model, requestId) {
  if (!/^fal-ai\/[a-zA-Z0-9/_-]+$/.test(model) || !/^[a-zA-Z0-9-]{1,128}$/.test(requestId)) throw new Error("Invalid request");
  const response = await fetch("https://queue.fal.run/" + model + "/requests/" + requestId + "/status", {headers:previewHeaders(),redirect:"error",signal:AbortSignal.timeout(10000)});
  if (!response.ok) return {ok:false,status:response.status};
  const data = await response.json();
  return {ok:true,status:typeof data.status==="string"?data.status:"UNKNOWN"};
}
module.exports = {configuration,status};
