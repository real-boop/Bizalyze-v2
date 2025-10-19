import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
// import fetch from 'node-fetch'; // Not needed in Next.js API routes
import { z } from "zod";

// DEBUG: Log environment variable presence and length (do not log full keys)
console.log('[DEBUG] PERPLEXITY_API_KEY present:', !!process.env.PERPLEXITY_API_KEY, 'length:', process.env.PERPLEXITY_API_KEY?.length || 0);

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// System prompt and schema
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
  const match = text.match(/\[\s*[\{\[][^]*?\][\s\]]*/);
  return match ? match[0] : null;
}

// --- Perplexity call ---
async function callPerplexity(query: string): Promise<Listing[]> {
  const start = Date.now();
  try {
    const userPrompt = `Search for businesses for sale: ${query}`;
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4000,
        temperature: 0.2,
        top_p: 0.9,
        web_search_options: {
          search_context_size: 'high'
        },
        stream: false
      })
    });
    const text = await response.text();
    let apiResponse;
    try {
      apiResponse = JSON.parse(text);
    } catch (err) {
      console.error("[DEBUG] Perplexity non-JSON response:", text);
      throw new Error(`Perplexity returned non-JSON: ${text.slice(0, 200)}`);
    }
    // Extract the schema from choices[0].message.content
    let content = apiResponse.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[DEBUG] Perplexity: No content in response', apiResponse);
      return [];
    }
    let listings: Listing[] = [];
    try {
      const jsonStr = extractFirstJsonArray(content);
      if (!jsonStr) throw new Error('No JSON array found in Perplexity content');
      listings = ListingsArraySchema.parse(JSON.parse(jsonStr));
    } catch (err) {
      console.error('[DEBUG] Perplexity: Failed to parse listings array:', err, content);
      return [];
    }
    const responseTimeMs = Date.now() - start;
    console.log("[DEBUG] Perplexity listings:", listings, "Response time:", responseTimeMs, "ms");
    return listings;
  } catch (err: any) {
    const responseTimeMs = Date.now() - start;
    console.error("[DEBUG] Perplexity error:", err);
    return [];
  }
}

export async function POST(req: NextRequest) {
  let query: string;
  let on_market: boolean;
  try {
    const body = await req.json();
    query = body.query;
    on_market = body.on_market;
    if (!query) throw new Error('Missing query');
    if (typeof on_market !== 'boolean') throw new Error('Missing on_market boolean');
    console.log("[DEBUG] Received query:", query, "on_market:", on_market);
  } catch (err) {
    console.error("[DEBUG] Failed to parse request body:", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!on_market) {
    // If not on market, skip Perplexity and return empty listings
    return NextResponse.json({ listings: [] });
  }

  // Run Perplexity
  let perplexityListings: Listing[] = [];
  try {
    perplexityListings = await callPerplexity(query);
  } catch (err) {
    console.error("[DEBUG] Unexpected error in Perplexity call:", err);
  }

  // Store results in search_sessions
  try {
    const { error } = await supabase.from('search_sessions').insert([
      {
        cleaned_query: query,
        on_market: true,
        perplexity_result: perplexityListings,
        perplexity_status: 'complete',
      }
    ]);
    if (error) {
      console.error('[DEBUG] Supabase insert error:', error);
    }
  } catch (err) {
    console.error('[DEBUG] Error storing results in Supabase:', err);
  }

  return NextResponse.json({ listings: perplexityListings });
} 