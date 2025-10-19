import { createClient } from "@supabase/supabase-js";
import { ApifyClient } from "apify-client";

// Environment variable checks
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables.');
}
if (!process.env.APIFY_API_TOKEN) {
  throw new Error('Missing Apify API token.');
}
if (!process.env.PERPLEXITY_API_KEY) {
  throw new Error('Missing Perplexity API key.');
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN! });

// Zod for schema validation
import { z } from "zod";

// System prompt and schema for Perplexity
const SYSTEM_PROMPT = `You are an expert in finding business listings across the internet using diligent web search to identify available listings across all possible sources. 
Ensure that listings are online and recent before returning results to the user.  
The user will provide you with an input that might be unstructured. Correct any typos, interpret the user input and structure the search query into Business type (e.g., laundromat) and Location (e.g., San Jose, CA).
Location handling: 
- City/County: Search for "[business] for sale near [location]" 
- State: Search for "[business] for sale in [state]"  
Process: 
1) Construct queries using the business type and location. 
2) Retrieve all currently listed businesses for sale that match the criteria. Prioritize listings by recency, remove obvious duplicates. 
3) Extract the following information: Business name or headline, Direct link to the original listing, Asking price (if available), Listing or update date (if available).
Always provide a direct link to the listing. 
Sources to check: 
Business Marketplaces ; Commercial Real Estate and Broker websites ; Classifieds (e.g. Facebook Marketplace) ; Industry-Specific directories (e.g. Coin Laundry Association)
Response format: 
Respond in a structured JSON format, listing all findings. 
Each listing is an array with name, direct link, price, and date (if available). Always respond in the requested format, without any additional explanations or verbiage.  
Output the following JSON structure exactly: 
{ "name": "listing title", "link": "full source URL", "price": "$X,XXX or null if not available", "date": "MM/DD/YYYY or null if not available"} 
Completeness and Diligence 
Ensure a diligent and holistic search. 
Include only active and currently available listings. 
Include only entries matching the location criteria 
No additional text outside the JSON structure 
Preserve original URLs exactly as provided 
Respond ONLY with the JSON array, no extra text, no explanations, no markdown, no commentary. Do NOT include any text before or after the JSON array. If you do not know, return an empty array: []`;

const ListingSchema = z.object({
  name: z.string(),
  link: z.string().url(),
  price: z.string().nullable(),
  date: z.string().nullable(),
});
const ListingsArraySchema = z.array(ListingSchema);

type Listing = z.infer<typeof ListingSchema>;

// Helper: Extract first JSON array from a string
function extractFirstJsonArray(text: string): string | null {
  const match = text.match(/\[\s*[\{\[]([\s\S]*?)\][\s\]]*/);
  return match ? match[0] : null;
}

// Import the new Perplexity scraper function
import { callPerplexity, dedupeListings } from "./onmarket-perplexity";
// Import the new GMaps off-market scraper function
import { callApifyOffMarket } from "./offmarket-gmaps";
import { translateSearchQuery } from "./search-translator";
import { callApifyBBS } from "./onmarket-bbs";
import { callApifyBB } from "./onmarket-bb";
import { callApifyBFS } from "./onmarket-bfs";

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionId } = body;
  if (!sessionId) return new Response(JSON.stringify({ error: "Missing sessionId" }), { status: 400 });

  // Fetch session
  const { data: session, error: fetchError } = await supabase
    .from("search_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (fetchError || !session) {
    console.error('[Session] Not found:', fetchError);
    return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
  }

  // --- NEW: Call search translator and save response ---
  let translatorResponse = null;
  try {
    translatorResponse = await translateSearchQuery(session.cleaned_query);
    console.debug(`[Session ${sessionId}] Translator response:`, translatorResponse);
    await supabase.from("search_sessions").update({ search_translator_response: translatorResponse }).eq("id", sessionId);
    console.log(`[Session ${sessionId}] Saved search_translator_response to DB.`);
  } catch (err: any) {
    console.error(`[Session ${sessionId}] Translator error:`, err);
    await supabase.from("search_sessions").update({ error_message: `Translator error: ${err.message}` }).eq("id", sessionId);
    return new Response(JSON.stringify({ error: `Translator error: ${err.message}` }), { status: 500 });
  }

  let errorMessage = null;

  // --- Run scrapers in parallel ---
  const scraperPromises = [];

  // On-market: Perplexity
  if (session.on_market) {
    scraperPromises.push((async () => {
      try {
        console.log(`[Session ${sessionId}] Starting Perplexity step...`);
        await supabase.from("search_sessions").update({ perplexity_status: "running" }).eq("id", sessionId);
        const perplexityListings = await callPerplexity(session.cleaned_query);
        const dedupedListings = dedupeListings(perplexityListings);
        await supabase.from("search_sessions").update({ perplexity_status: "complete", perplexity_result: dedupedListings }).eq("id", sessionId);
        console.log(`[Session ${sessionId}] Perplexity complete, stored result.`);
      } catch (err: any) {
        errorMessage = `Perplexity error: ${err.message}`;
        await supabase.from("search_sessions").update({ perplexity_status: "error", error_message: errorMessage }).eq("id", sessionId);
        console.error(`[Session ${sessionId}] Perplexity error:`, err);
      }
    })());
  }

  // Off-market: GMaps (Apify)
  if (session.off_market) {
    scraperPromises.push((async () => {
      try {
        console.log(`[Session ${sessionId}] Starting GMaps Off-market step...`);
        await supabase.from("search_sessions").update({ "offmarket-gmaps_status": "running" }).eq("id", sessionId);
        const result = await callApifyOffMarket(session.cleaned_query);
        await supabase.from("search_sessions").update({ "offmarket-gmaps_status": "complete", "offmarket-gmaps_result": result }).eq("id", sessionId);
        console.log(`[Session ${sessionId}] GMaps Off-market complete, stored result.`);
      } catch (err: any) {
        errorMessage = errorMessage ? errorMessage + ` | GMaps Off-market error: ${err.message}` : `GMaps Off-market error: ${err.message}`;
        await supabase.from("search_sessions").update({ "offmarket-gmaps_status": "error", error_message: errorMessage }).eq("id", sessionId);
        console.error(`[Session ${sessionId}] GMaps Off-market error:`, err);
      }
    })());
  }

  // On-market: BizBuySell (BBS)
  if (session.on_market && translatorResponse && translatorResponse.bizbuysell) {
    scraperPromises.push((async () => {
      try {
        console.log(`[Session ${sessionId}] Starting BizBuySell (BBS) step...`);
        await supabase.from("search_sessions").update({ "onmarket-bbs_status": "running" }).eq("id", sessionId);
        const apifyClient = new (await import("apify-client")).ApifyClient({ token: process.env.APIFY_API_TOKEN! });
        const actorInput = translatorResponse.bizbuysell;
        console.log(`[Session ${sessionId}] BBS actor input:`, actorInput);
        const run = await apifyClient.actor("bongobongo~bizbuysell-working-v1-1").call(actorInput);
        console.log(`[Session ${sessionId}] BBS run started, run ID:`, run.id);
        await supabase.from("search_sessions").update({ "onmarket-bbs_run_id": run.id }).eq("id", sessionId);
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        console.log(`[Session ${sessionId}] BBS results fetched:`, items.length, "items");
        await supabase.from("search_sessions").update({
          "onmarket-bbs_status": "complete",
          "onmarket-bbs_result": items
        }).eq("id", sessionId);
        console.log(`[Session ${sessionId}] BizBuySell (BBS) complete, stored result.`);
      } catch (err: any) {
        errorMessage = errorMessage ? errorMessage + ` | BBS error: ${err.message}` : `BBS error: ${err.message}`;
        await supabase.from("search_sessions").update({ "onmarket-bbs_status": "error", error_message: errorMessage }).eq("id", sessionId);
        console.error(`[Session ${sessionId}] BizBuySell (BBS) error:`, err);
      }
    })());
  }

  // On-market: BizBen (BB)
  if (session.on_market && translatorResponse && translatorResponse.bizben) {
    scraperPromises.push((async () => {
      try {
        console.log(`[Session ${sessionId}] Starting BizBen (BB) step...`);
        await supabase.from("search_sessions").update({ "onmarket-bb_status": "running" }).eq("id", sessionId);
        const apifyClient = new (await import("apify-client")).ApifyClient({ token: process.env.APIFY_API_TOKEN! });
        const actorInput = translatorResponse.bizben;
        const run = await apifyClient.actor("bongobongo~bizben-working-v1-1").call(actorInput);
        await supabase.from("search_sessions").update({ "onmarket-bb_run_id": run.id }).eq("id", sessionId);
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        await supabase.from("search_sessions").update({ "onmarket-bb_status": "complete", "onmarket-bb_result": items }).eq("id", sessionId);
        console.log(`[Session ${sessionId}] BizBen (BB) complete, stored result.`);
      } catch (err: any) {
        errorMessage = errorMessage ? errorMessage + ` | BB error: ${err.message}` : `BB error: ${err.message}`;
        await supabase.from("search_sessions").update({ "onmarket-bb_status": "error", error_message: errorMessage }).eq("id", sessionId);
        console.error(`[Session ${sessionId}] BizBen (BB) error:`, err);
      }
    })());
  }

  // On-market: BusinessesForSale (BFS)
  const enableBFS = process.env.ENABLE_BFS_SCRAPER === "true";
  if (session.on_market && translatorResponse && translatorResponse.businessesforsale && enableBFS) {
    scraperPromises.push((async () => {
      try {
        console.log(`[Session ${sessionId}] Starting BusinessesForSale (BFS) step...`);
        await supabase.from("search_sessions").update({ "onmarket-bfs_status": "running" }).eq("id", sessionId);
        const apifyClient = new (await import("apify-client")).ApifyClient({ token: process.env.APIFY_API_TOKEN! });
        const actorInput = translatorResponse.businessesforsale;
        const run = await apifyClient.actor("bongobongo~businessesforsale-working-v1").call(actorInput);
        await supabase.from("search_sessions").update({ "onmarket-bfs_run_id": run.id }).eq("id", sessionId);
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        await supabase.from("search_sessions").update({ "onmarket-bfs_status": "complete", "onmarket-bfs_result": items }).eq("id", sessionId);
        console.log(`[Session ${sessionId}] BusinessesForSale (BFS) complete, stored result.`);
      } catch (err: any) {
        errorMessage = errorMessage ? errorMessage + ` | BFS error: ${err.message}` : `BFS error: ${err.message}`;
        await supabase.from("search_sessions").update({ "onmarket-bfs_status": "error", error_message: errorMessage }).eq("id", sessionId);
        console.error(`[Session ${sessionId}] BusinessesForSale (BFS) error:`, err);
      }
    })());
  }

  // Wait for all scrapers to finish
  await Promise.all(scraperPromises);

  await supabase.from("search_sessions").update({ progress: 100 }).eq("id", sessionId);
  console.log(`[Session ${sessionId}] Search complete. Progress set to 100.`);

  return new Response(JSON.stringify({ success: true, errorMessage }), { status: 200 });
}

// Remove all legacy Perplexity code. Only use the imported function. 