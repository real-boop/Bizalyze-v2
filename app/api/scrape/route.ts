import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import FirecrawlApp from "@mendable/firecrawl-js"
import logger from '@/lib/logger'
import { businessJsonSchema } from "@/lib/businessJsonSchema"

// Log environment variables (do not log secrets)
logger.debug("SUPABASE_URL present:", !!process.env.SUPABASE_URL)
logger.debug("FIRECRAWL_API_KEY present:", !!process.env.FIRECRAWL_API_KEY)

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Supabase admin client is not configured. Check your environment variables." }, { status: 500 });
    }
    
    const { url } = await request.json()
    if (!url) {
      logger.error("Missing URL in request body")
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }
    
    const apiKey = process.env.FIRECRAWL_API_KEY
    if (!apiKey) {
      logger.error("Firecrawl API key is not set in environment variables")
      return NextResponse.json({ error: "Firecrawl API key not set" }, { status: 500 })
    }
    
    // Initialize Firecrawl SDK
    logger.debug("Initializing FirecrawlApp with API key...")
    const app = new FirecrawlApp({ apiKey })
    
    const prompt = "Identify and extract all relevant business listing information. Formats and data quality may vary. There should be a listing name, location (look for city / ZIP / county or state), business metrics (like price, revenue, etc), and additional descriptions. Return data in the included schema."
    
    logger.debug("Firecrawl prompt:", prompt)
    logger.debug("Firecrawl schema (JSON):", businessJsonSchema)
    
    try {
      // Try with array of URLs - this is likely correct based on the API
      const extractResult = await app.extract([url], {
        prompt,
        schema: businessJsonSchema
      })
      
      logger.debug("Extract result:", JSON.stringify(extractResult, null, 2))
      
      if (!extractResult || !extractResult.success) {
        const errorMessage = extractResult?.error || "Unknown error from extraction service"
        logger.error("Firecrawl extraction failed:", errorMessage)
        // If the error looks like HTML, log the first 200 chars
        if (typeof errorMessage === 'string' && errorMessage.trim().startsWith('<')) {
          logger.error("Firecrawl returned HTML:", errorMessage.slice(0, 200))
        }
        return NextResponse.json({ error: errorMessage }, { status: 400 })
      }
      
      // The extracted data should be in extractResult.data
      const data = extractResult.data
      
      if (!data) {
        logger.error("No data returned from Firecrawl")
        logger.error("Full extract result structure:", JSON.stringify(extractResult, null, 2))
        return NextResponse.json({ error: "No data returned from Firecrawl" }, { status: 400 })
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
        .single()
        
      if (supabaseError) {
        logger.error("Supabase storing data:", {
          error: supabaseError instanceof Error ? supabaseError.message : String(supabaseError),
          id: business && typeof business === 'object' && business !== null && 'id' in business ? (business as any).id : null
        })
        return NextResponse.json({ error: "Failed to store data" }, { status: 500 })
      }
      
      const businessId = business && typeof business === 'object' && business !== null && 'id' in business ? (business as any).id : null
      logger.debug(`Successfully extracted data from URL and stored with ID: ${businessId ?? "unknown"}`)
      
      return NextResponse.json({ id: businessId })
      
    } catch (sdkError) {
      logger.error("SDK method error:", sdkError)
      
      // If the SDK method fails, try calling the API directly
      logger.debug("Falling back to direct API call...")
      
      const response = await fetch('https://api.firecrawl.dev/v1/extract', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: [url],  // Changed from 'url' to 'urls' as an array
          prompt,
          schema: businessJsonSchema
          // Removed 'formats' as it's not a valid parameter for extract endpoint
        })
      })
      
      const responseText = await response.text()
      logger.debug("Direct API response status:", response.status)
      logger.debug("Direct API response:", responseText)
      
      if (!response.ok) {
        return NextResponse.json({ error: `Firecrawl API error: ${responseText}` }, { status: response.status })
      }
      
      const result = JSON.parse(responseText)
      
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Extraction failed" }, { status: 400 })
      }
      
      const data = result.data
      
      if (!data) {
        logger.error("No data in direct API response")
        return NextResponse.json({ error: "No data returned from Firecrawl" }, { status: 400 })
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
        .single()
        
      if (supabaseError) {
        logger.error("Supabase storing data:", {
          error: supabaseError instanceof Error ? supabaseError.message : String(supabaseError)
        })
        return NextResponse.json({ error: "Failed to store data" }, { status: 500 })
      }
      
      const businessId = business?.id
      logger.debug(`Successfully extracted data from URL and stored with ID: ${businessId ?? "unknown"}`)
      
      return NextResponse.json({ id: businessId })
    }
    
  } catch (error) {
    logger.error("Unexpected error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}