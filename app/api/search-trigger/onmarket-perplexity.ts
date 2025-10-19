import { z } from "zod";

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

export type Listing = z.infer<typeof ListingSchema>;

// Helper: Extract first JSON array from a string
function extractFirstJsonArray(text: string): string | null {
  const match = text.match(/\[\s*[\{\[]([\s\S]*?)\][\s\]]*/);
  return match ? match[0] : null;
}

// Deduplication logic for listings (by link)
export function dedupeListings(listings: Listing[]): Listing[] {
  const map = new Map<string, Listing>();
  for (const it of listings) {
    if (!map.has(it.link)) map.set(it.link, it);
  }
  return Array.from(map.values());
}

export async function callPerplexity(query: string): Promise<Listing[]> {
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