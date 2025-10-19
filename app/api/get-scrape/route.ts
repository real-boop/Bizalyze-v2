import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import logger from '@/lib/logger'

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase admin client is not configured. Check your environment variables." }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    logger.debug("[GET /api/get-scrape] Request received:", { id })

    if (!id) {
      logger.error("[GET /api/get-scrape] Missing ID parameter")
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    // Fetch from Supabase
    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .select("url, scrape_data, created_at")
      .eq("id", id)
      .single()

    if (error || !business) {
      logger.error("[GET /api/get-scrape] Data not found in Supabase:", { id })
      return NextResponse.json({ error: "Scraped data not found" }, { status: 404 })
    }

    logger.debug("[GET /api/get-scrape] Successfully retrieved data:", {
      id,
      hasJson: !!business.scrape_data,
      timestamp: business.created_at
    })

    // Return JSON data
    return NextResponse.json({
      url: business.url,
      json: business.scrape_data,
      timestamp: business.created_at
    })
  } catch (error) {
    logger.error("[GET /api/get-scrape] Error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { 
        error: "Failed to fetch scraped data",
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    )
  }
} 
