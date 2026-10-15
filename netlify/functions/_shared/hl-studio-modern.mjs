// Bridge HUGS Studio's existing Lambda-style handlers to Netlify's modern
// Request/Response API. Keep request bodies intact for Stripe signature checks.
export function modernHandler(legacyHandler) {
  return async function handleRequest(request) {
    const url = new URL(request.url);
    const headers = Object.fromEntries(request.headers.entries());
    const body = request.method === 'GET' || request.method === 'HEAD'
      ? ''
      : await request.text();
    const event = {
      httpMethod: request.method,
      headers,
      body,
      isBase64Encoded: false,
      rawUrl: request.url,
      path: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    };
    const result = await legacyHandler(event);
    return new Response(result?.body ?? '', {
      status: result?.statusCode ?? 200,
      headers: result?.headers ?? {},
    });
  };
}
