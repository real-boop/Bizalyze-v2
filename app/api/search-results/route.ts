import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });

  const { data: session, error } = await supabase
    .from("search_sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !session) return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });

  // Merge all on-market results into a single array
  let onMarketResults: any[] = [];
  if (session.on_market) {
    const sources = [
      session.perplexity_result,
      session["onmarket-bbs_result"],
      session["onmarket-bb_result"],
      session["onmarket-bfs_result"],
    ];
    for (const src of sources) {
      if (Array.isArray(src)) {
        onMarketResults = onMarketResults.concat(src);
      } else if (src && Array.isArray(src.results)) {
        onMarketResults = onMarketResults.concat(src.results);
      }
    }
  }

  return new Response(JSON.stringify({
    on_market: onMarketResults,
    off_market: session.off_market ? session["offmarket-gmaps_result"] : null,
  }), { status: 200 });
} 