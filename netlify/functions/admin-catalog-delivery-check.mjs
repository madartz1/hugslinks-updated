import { createHash, timingSafeEqual } from "node:crypto";
import send from "./admin-send-birthday-hug.mjs";
import { getDesign } from "../function-libs/ready-made-card-catalog.mjs";

const origin = "https://hugslinks.com";
const expected = Buffer.from("e6c52ad07d5c089df7e95d3cb7382154aa57302435a45122428066535956a88b", "hex");
const expires = Date.parse("2026-11-26T18:48:38.771Z");
const cases = [
  {
    "collection": "birthday",
    "card": 0,
    "id": "0f5814fd-0030-4b38-84f1-a48664be6d1a"
  },
  {
    "collection": "gen-z-holiday-hugs",
    "card": 6,
    "id": "810e0cf4-5a0e-4153-82d5-103c80bb4563"
  },
  {
    "collection": "christmas",
    "card": 4,
    "id": "ba0c450c-202d-4bfc-89bd-e7d2844e13c5"
  },
  {
    "collection": "thanksgiving",
    "card": 3,
    "id": "8657d5bd-f025-4573-a81b-062e12d742e7"
  },
  {
    "collection": "thinking-of-you",
    "card": 1,
    "id": "24f622c0-279d-4909-8b0f-2bf9a533cd6f"
  },
  {
    "collection": "motion",
    "card": 0,
    "id": "3f92cbbf-4607-4446-8d70-3540995ffa38"
  },
  {
    "collection": "memorial",
    "card": 0,
    "id": "c1524525-1af0-4217-89c7-7d107a8ccad6"
  }
];

export default async request => {
  const supplied = createHash("sha256").update(request.headers.get("authorization") || "").digest();
  if (request.method !== "POST" || new URL(request.url).origin !== origin ||
      Date.now() > expires || !timingSafeEqual(supplied, expected) || !process.env.HUGS_ADMIN_TOKEN) {
    return new Response(null, { status: 404 });
  }
  const index = Number(new URL(request.url).searchParams.get("case"));
  const test = Number.isInteger(index) && index >= 0 ? cases[index] : undefined;
  const design = test && getDesign(test.collection, test.card);
  if (!design) return new Response(null, { status: 404 });
  return send(new Request(origin + "/.netlify/functions/admin-send-birthday-hug", {
    method: "POST",
    headers: { Origin: origin, Authorization: "Bearer " + process.env.HUGS_ADMIN_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...test,
      email: "hugslinkscards@gmail.com",
      sender: "HUGSLinks",
      recipient: "HUGSLinks Test Inbox",
      color: "navy",
      message: "No-charge Owner Workspace email test for " + design.title
    })
  }));
};