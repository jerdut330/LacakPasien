import { getTrackInfo } from "@/lib/track";

// Live updates: the family page asks this every few seconds.
// Same token check and same safe fields as the page (never notes).
export async function GET(_req: Request, ctx: RouteContext<"/track/[token]/status">) {
  const { token } = await ctx.params;
  const info = await getTrackInfo(token);
  if (!info) return Response.json({ error: "This link isn't working." }, { status: 404 });
  return Response.json(info, { headers: { "cache-control": "no-store" } });
}
