// Preserve the existing handlers while using Netlify's current Request/Response
// runtime, which is not subject to Lambda compatibility's 4 KB env limit.
export function modernHandler(legacyHandler) {
 return async function handleRequest(request,context) {
  const url=new URL(request.url),headers=Object.fromEntries(request.headers.entries());
  headers.host ||= url.host;
  const hasBody=!['GET','HEAD'].includes(request.method),type=headers['content-type']||'';
  const binary=hasBody&&!!type&&!/(^text\/|json|xml|x-www-form-urlencoded)/i.test(type);
  const bytes=hasBody?Buffer.from(await request.arrayBuffer()):Buffer.alloc(0);
  const multiValueQueryStringParameters={};for(const [key,value] of url.searchParams){(multiValueQueryStringParameters[key]||=[]).push(value);}
  const event={httpMethod:request.method,headers,body:binary?bytes.toString('base64'):bytes.toString('utf8'),isBase64Encoded:binary,rawUrl:request.url,rawQuery:url.search.slice(1),path:url.pathname,queryStringParameters:Object.fromEntries(url.searchParams.entries()),multiValueQueryStringParameters};
  const result=await legacyHandler(event,context),responseHeaders=new Headers(result?.headers||{});
  for(const [key,values] of Object.entries(result?.multiValueHeaders||{}))for(const value of values)responseHeaders.append(key,value);
  const status=result?.statusCode??200;
  const body=[204,205,304].includes(status)||request.method==='HEAD'?null:result?.isBase64Encoded?Buffer.from(result.body||'','base64'):result?.body??'';
  return new Response(body,{status,headers:responseHeaders});
 };
}
