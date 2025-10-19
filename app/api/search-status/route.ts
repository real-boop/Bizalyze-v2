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

  // Build steps array dynamically
  const steps = [];
  if (session.on_market) {
    steps.push({ label: "Perplexity", done: session.perplexity_status === "complete" });
  }
  if (session.off_market) {
    steps.push({ label: "Off-market", done: session["offmarket-gmaps_status"] === "complete" });
  }

  return new Response(JSON.stringify({
    progress: session.progress,
    steps,
    error: session.error_message,
    search_translator_response: session.search_translator_response,
    perplexity_status: session.perplexity_status,
    onmarket_bbs_status: session["onmarket-bbs_status"],
    onmarket_bb_status: session["onmarket-bb_status"],
    onmarket_bfs_status: session["onmarket-bfs_status"],
    offmarket_gmaps_status: session["offmarket-gmaps_status"],
    on_market: session.on_market,
    off_market: session.off_market,
    cleaned_query: session.cleaned_query,
    search_query: session.search_query,
  }), { status: 200 });
} 