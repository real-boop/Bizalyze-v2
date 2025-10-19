import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  const body = await req.json();
  const { cleaned_query, on_market, off_market, user_id } = body;

  if (!cleaned_query || (on_market !== true && off_market !== true)) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
  }

  const { data, error } = await supabase
    .from("search_sessions")
    .insert([{
      cleaned_query,
      on_market,
      off_market,
      user_id: user_id || null,
    }])
    .select("id")
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ sessionId: data.id }), { status: 200 });
} 