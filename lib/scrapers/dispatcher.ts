import { scrapeBizBuySell } from "./actors/bizbuysell";
import { scrapeGeneric } from "./actors/generic";
import logger from "@/lib/logger";

export async function scrapeBusinessByUrl(url: string): Promise<{ id: string }> {
  if (!url) {
    throw new Error("URL is required");
  }
  
  logger.debug('[Dispatcher] Scraping business for URL:', url);
  
  let result: { id: string };
  
  if (url.includes("bizbuysell.com")) {
    logger.info('[Dispatcher] Using BizBuySell actor for URL:', url);
    result = await scrapeBizBuySell(url);
  } else {
    logger.info('[Dispatcher] Using generic actor for URL:', url);
    result = await scrapeGeneric(url);
  }
  
  // Validate that we got the expected format
  if (!result || typeof result !== 'object' || !result.id) {
    logger.error('[Dispatcher] Invalid result from scraper:', result);
    throw new Error('Scraper did not return valid { id: string } format');
  }
  
  logger.info(`[Dispatcher] Successfully scraped business with ID: ${result.id}`);
  return result;
}