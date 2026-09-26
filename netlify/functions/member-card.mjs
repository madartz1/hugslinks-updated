import { getStore } from "@netlify/blobs";

export default async (request) => {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!/^[a-f0-9]{48}$/.test(token)) return Response.json({ ok:false }, { status:400 });

  const member = await getStore("hugs-original-333").get("token:" + token, { type:"json" });
  if (!member) return Response.json({ ok:false }, { status:404 });

  return Response.json({
    ok:true,
    member:{
      number:member.number,
      displayNumber:member.displayNumber,
      name:member.name,
      createdAt:member.createdAt
    }
  }, { headers:{ "Cache-Control":"private, no-store" } });
};
