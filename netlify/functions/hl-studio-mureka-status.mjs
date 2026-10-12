// HL Studio Mureka connection check. No music is generated or credits spent.
export default async function handler() {
  const headers = { "content-type": "application/json", "cache-control": "no-store" };
  const configured = Boolean(process.env.MUREKA_API_KEY);
  return new Response(JSON.stringify({
    configured,
    generationEnabled: false,
    paymentRequired: true,
    message: configured
      ? "Mureka key detected. Paid song generation remains disabled until verified Stripe checkout and order tracking are implemented."
      : "MUREKA_API_KEY is not configured for this deployment."
  }), { status: 200, headers });
}
export const config = { path: "/api/hl-studio/mureka-status" };
