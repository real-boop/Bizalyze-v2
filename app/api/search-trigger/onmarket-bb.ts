import { ApifyClient } from "apify-client";

// BizBen On-market Scraper
export async function callApifyBB(input: { maxItems: number; state: string; subcategory: string[] }): Promise<any[]> {
  if (process.env.ENABLE_BB_SCRAPER === "false") {
    console.log('[Apify][BB] Disabled via ENABLE_BB_SCRAPER env variable');
    return [];
  }
  try {
    const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN! });
    const actorInput = {
      maxItems: input.maxItems,
      state: input.state,
      subcategory: input.subcategory,
    };
    console.log('[Apify][BB] Calling actor with input:', actorInput);
    const run = await apifyClient.actor("bongobongo~bizben-working-v1-1").call(actorInput);
    console.log('[Apify][BB] Actor run started:', run.id);
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    console.log('[Apify][BB] Results fetched:', items.length, 'items');
    return items;
  } catch (err) {
    console.error('[Apify][BB] API error:', err);
    return [];
  }
} 