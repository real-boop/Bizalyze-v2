import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
// import fetch from 'node-fetch'; // Not needed in Next.js API routes
import OpenAI from "openai";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

// DEBUG: Log environment variable presence and length (do not log full keys)
console.log('[DEBUG] OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY, 'length:', process.env.OPENAI_API_KEY?.length || 0);
console.log('[DEBUG] PERPLEXITY_API_KEY present:', !!process.env.PERPLEXITY_API_KEY, 'length:', process.env.PERPLEXITY_API_KEY?.length || 0);

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
  const match = text.match(/\[\s*[\{\[][\s\S]*?\][\s\]]*/);
  return match ? match[0] : null;
}

// Helper: Robustly extract and validate all JSON arrays of listings from text (for OpenAI)
function extractListingsFromText(text: string): Listing[] {
  const arrays: Listing[] = [];
  const arrayRegex = /\[\s*{[\s\S]*?}\s*\]/g;
  let match;
  while ((match = arrayRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[0]);
      const validated = ListingsArraySchema.parse(parsed);
      arrays.push(...validated);
    } catch (e) {
      // Ignore invalid arrays
    }
  }
  return arrays;
}

// --- Claude call ---
async function callClaude(query: string): Promise<Listing[]> {
  const start = Date.now();
  try {
    const userPrompt = `Search for businesses for sale: ${query}`;
    const msg = await anthropic.beta.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 20000,
      temperature: 0.8,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
      tools: [
        {
          name: "web_search",
          type: "web_search_20250305",
        },
      ],
      betas: ["web-search-2025-03-05"],
    });
    const responseTimeMs = Date.now() - start;
    let text = "";
    // Extract text from Claude response
    if (msg.content && Array.isArray(msg.content)) {
      const textContent = msg.content.find((item) => item.type === "text");
      if (textContent && "text" in textContent) {
        text = textContent.text;
      }
    }
    let listings: Listing[] = [];
    try {
      listings = extractListingsFromText(text);
      if (!listings.length) throw new Error('No valid JSON array of listings found in Claude content');
    } catch (err) {
      console.error('[DEBUG] Claude: Failed to parse listings array:', err, text);
      return [];
    }
    console.log("[DEBUG] Claude listings:", listings, "Response time:", responseTimeMs, "ms");
    return listings;
  } catch (err: any) {
    const responseTimeMs = Date.now() - start;
    console.error("[DEBUG] Claude error:", err);
    return [];
  }
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

async function dedupeAndStore(listings: Listing[]) {
  const map = new Map<string, Listing>();
  for (const it of listings) {
    if (!map.has(it.link)) map.set(it.link, it);
  }
  const uniqueListings = Array.from(map.values());
  await supabase.from('onmarket_listings').upsert(uniqueListings, { onConflict: 'link' });
  return uniqueListings;
}

export async function POST(req: NextRequest) {
  let query: string;
  try {
    const body = await req.json();
    query = body.query;
    if (!query) throw new Error('Missing query');
    console.log("[DEBUG] Received query:", query);
  } catch (err) {
    console.error("[DEBUG] Failed to parse request body:", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Run Perplexity and Claude in parallel
  let claudeListings: Listing[] = [], perplexityListings: Listing[] = [];
  try {
    [claudeListings, perplexityListings] = await Promise.all([
      callClaude(query),
      callPerplexity(query)
    ]);
  } catch (err) {
    console.error("[DEBUG] Unexpected error in Promise.all:", err);
  }

  // Merge, dedupe, and store
  const allListings = [...claudeListings, ...perplexityListings];
  const uniqueListings = await dedupeAndStore(allListings);
  console.log("[DEBUG] Final unique listings count:", uniqueListings.length);
  return NextResponse.json({ listings: uniqueListings });
} 