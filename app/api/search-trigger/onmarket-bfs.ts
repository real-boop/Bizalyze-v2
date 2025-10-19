import { ApifyClient } from "apify-client";

// BusinessesForSale On-market Scraper
export async function callApifyBFS(input: { businessType: string; state: string }): Promise<any[]> {
  try {
    const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN! });
    const actorInput = {
      businessType: input.businessType,
      state: input.state,
    };
    console.log('[Apify][BFS] Calling actor with input:', actorInput);
    const run = await apifyClient.actor("bongobongo~businessesforsale-working-v1").call(actorInput);
    console.log('[Apify][BFS] Actor run started:', run.id);
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    console.log('[Apify][BFS] Results fetched:', items.length, 'items');
    return items;
  } catch (err) {
    console.error('[Apify][BFS] API error:', err);
    return [];
  }
} 