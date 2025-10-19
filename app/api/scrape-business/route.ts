import { NextResponse } from "next/server";
import { scrapeBusinessByUrl } from "@/lib/scrapers/dispatcher";
import { supabaseAdmin } from "@/lib/supabase";
import logger from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }
    if (!supabaseAdmin) {
      logger.error("[scrape-business] Supabase admin client is not configured.");
      return NextResponse.json({ error: "Supabase admin client is not configured. Check your environment variables." }, { status: 500 });
    }
    logger.info(`[scrape-business] Scraping business for URL: ${url}`);
    const data = await scrapeBusinessByUrl(url);
    if (!data || !data.name || (typeof data === 'object' && Object.keys(data).length === 0)) {
      logger.error("[scrape-business] No valid data returned from scraper", data);
      return NextResponse.json({ error: "No valid data returned from scraper" }, { status: 400 });
    }
    // Store in Supabase (businesses table)
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
    if (supabaseError || !business || !business.id) {
      logger.error("[scrape-business] Supabase storing data error:", supabaseError, business);
      return NextResponse.json({ error: "Failed to store data" }, { status: 500 });
    }
    const businessId = business.id;
    logger.info(`[scrape-business] Successfully scraped and stored business with ID: ${businessId}`);
    return NextResponse.json({ ...data, id: businessId, scrape_status: "complete" });
  } catch (error) {
    logger.error("[scrape-business] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 