import { ApifyClient } from "apify-client";

// GMaps Off-market Scraper (formerly Apify)
export async function callApifyOffMarket(query: string): Promise<any[]> {
  try {
    const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN! });
    const input = {
      searchStringsArray: [query],
      maxCrawledPlacesPerSearch: 50,
      language: "en",
      searchMatching: "all",
      website: "allPlaces",
      skipClosedPlaces: false,
      scrapePlaceDetailPage: false,
      scrapeTableReservationProvider: false,
      includeWebResults: false,
      scrapeDirectories: false,
      maxQuestions: 0,
      scrapeContacts: true,
      maximumLeadsEnrichmentRecords: 0,
      maxReviews: 0,
      reviewsSort: "newest",
      reviewsFilterString: "",
      reviewsOrigin: "all",
      scrapeReviewsPersonalData: true,
      scrapeImageAuthors: false,
      allPlacesNoSearchAction: ""
    };
    console.log('[Apify] Calling actor with input:', input);
    const run = await apifyClient.actor("nwua9Gu5YrADL7ZDj").call(input);
    console.log('[Apify] Actor run started:', run.id);
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    console.log('[Apify] Results fetched:', items.length, 'items');
    return items;
  } catch (err) {
    console.error('[Apify] API error:', err);
    return [];
  }
} 