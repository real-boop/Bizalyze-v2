import { ApifyClient } from "apify-client";

// BizBuySell On-market Scraper
export async function callApifyBBS(input: { state: string; businessType: string; maxItems: number }): Promise<any[]> {
  try {
    const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN! });
    const actorInput = {
      state: input.state,
      businessType: input.businessType,
      maxItems: input.maxItems,
    };
    console.log('[Apify][BBS] Calling actor with input:', actorInput);
    const run = await apifyClient.actor("bongobongo~bizbuysell-working-v1-1").call(actorInput);
    console.log('[Apify][BBS] Actor run started:', run.id);
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    console.log('[Apify][BBS] Results fetched:', items.length, 'items');
    return items;
  } catch (err) {
    console.error('[Apify][BBS] API error:', err);
    return [];
  }
} 