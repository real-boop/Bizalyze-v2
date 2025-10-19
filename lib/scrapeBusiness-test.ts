import { supabaseAdmin } from "@/lib/supabase";
import FirecrawlApp from "@mendable/firecrawl-js";
import logger from '@/lib/logger';
import { businessJsonSchema } from "@/lib/businessJsonSchema";

export async function scrapeBusinessByUrl(url: string): Promise<{ id: string }> {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured. Check your environment variables.");
  }
  if (!url) {
    throw new Error("URL is required");
  }
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Firecrawl API key not set");
  }
  logger.debug("Initializing FirecrawlApp with API key...");
  const app = new FirecrawlApp({ apiKey });
  logger.debug("Firecrawl schema (JSON):", businessJsonSchema);

  async function scrapeWithRetry(url: string) {
    try {
      // Always use stealth proxy, enforce schema, no prompt, and increase timeout
      const scrapeResult = await app.scrapeUrl(url, {
        formats: ["json"],
        jsonOptions: { schema: businessJsonSchema as unknown as import('zod').ZodType<any, any, any> },
        proxy: 'stealth',
        timeout: 90000,
      });
      logger.debug("Scrape result (stealth):", JSON.stringify(scrapeResult, null, 2));
      // Type assertion to 'any' to avoid SDK type errors for .data access
      const resultAny = scrapeResult as any;
      // Handle both possible response structures
      const jsonData = resultAny?.data?.json || resultAny?.json;
      if (!resultAny.success || !jsonData || (typeof jsonData === 'object' && Object.keys(jsonData).length === 0)) {
        logger.error("Stealth scrape failed or returned empty.");
        throw new Error("No data returned from Firecrawl scrape");
      }
      return resultAny;
    } catch (error) {
      logger.error(`Scrape error: ${error instanceof Error ? error.message : error}`);
      // Retry with stealth proxy on exception
      try {
        // Cast businessJsonSchema to satisfy SDK type, as runtime supports plain JSON schema
        const stealthResult = await app.scrapeUrl(url, {
          formats: ["json"],
          jsonOptions: { schema: businessJsonSchema as unknown as import('zod').ZodType<any, any, any> },
          proxy: 'stealth',
          timeout: 90000,
        });
        logger.debug("Scrape result (stealth after error):", JSON.stringify(stealthResult, null, 2));
        return stealthResult;
      } catch (retryError) {
        logger.error(`Stealth proxy also failed: ${retryError instanceof Error ? retryError.message : retryError}`);
        throw retryError;
      }
    }
  }

  try {
    const scrapeResult = await scrapeWithRetry(url) as any;
    if (!scrapeResult || !scrapeResult.success) {
      const errorMessage = scrapeResult?.error || "Unknown error from scraping service";
      logger.error("Firecrawl scraping failed:", errorMessage);
      throw new Error(errorMessage);
    }
    // Handle both possible response structures
    const data = scrapeResult.data?.json || scrapeResult.json;
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      logger.error("No data or empty data returned from Firecrawl scrape");
      logger.error("Full scrape result structure:", JSON.stringify(scrapeResult, null, 2));
      throw new Error("No data returned from Firecrawl scrape");
    }
    const { data: business, error: supabaseError } = await supabaseAdmin
      .from("businesses")
      .insert({
        url,
        name: data.name ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        county: data.county ?? null,
        zip: data.zip ?? null,
        scrape_data: data,
        scrape_status: "complete"
      })
      .select()
      .single();
    if (supabaseError) {
      logger.error("Supabase storing data:", {
        error: supabaseError instanceof Error ? supabaseError.message : String(supabaseError),
        id: business && typeof business === 'object' && business !== null && 'id' in business ? (business as any).id : null
      });
      throw new Error("Failed to store data");
    }
    const businessId = business && typeof business === 'object' && business !== null && 'id' in business ? (business as any).id : null;
    logger.debug(`Successfully scraped data from URL and stored with ID: ${businessId ?? "unknown"}`);
    logger.info(`[scrapeBusiness] Set scrape_status to complete for business id: ${businessId}`);
    return { id: businessId };
  } catch (error) {
    logger.error("Final scrape error:", error);
    throw error;
  }
} 