import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { runAssistant, BUSINESS_SCORE_ASSISTANT_ID, RECOMMENDATION_ASSISTANT_ID, runPerplexityDemographics, runPerplexityCompetition } from "../analyze-api-assistant"

export async function POST(request: Request) {
  try {
    const { businessId, analysisType } = await request.json()
    if (!businessId || !analysisType) {
      return NextResponse.json({ error: "businessId and analysisType are required" }, { status: 400 })
    }
    // Fetch business data from Supabase
    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .select("id, scrape_data, state, city, county, zip")
      .eq("id", businessId)
      .single()
    if (error || !business) {
      return NextResponse.json({ error: "Business not found or required data missing" }, { status: 404 })
    }
    const scrapeData = business.scrape_data
    // Map analysisType to handler
    if (analysisType === "demographics") {
      // Prepare location object
      const location = {
        state: business.state,
        city: business.city ?? null,
        county: business.county ?? null,
        zip: business.zip ?? null
      }
      let result
      try {
        result = await runPerplexityDemographics(businessId, location)
      } catch (err) {
        return NextResponse.json({ error: "AI analysis error", details: err instanceof Error ? err.message : String(err) }, { status: 500 })
      }
      // Insert handled by runPerplexityDemographics, but return result
      return NextResponse.json({ status: "success", data: result })
    }
    if (analysisType === "competition") {
      // Prepare location object
      const location = {
        state: business.state,
        city: business.city ?? null,
        county: business.county ?? null,
        zip: business.zip ?? null
      }
      let result
      try {
        result = await runPerplexityCompetition(businessId, location)
      } catch (err) {
        return NextResponse.json({ error: "AI analysis error", details: err instanceof Error ? err.message : String(err) }, { status: 500 })
      }
      // Insert handled by runPerplexityCompetition, but return result
      return NextResponse.json({ status: "success", data: result })
    }
    // Existing logic for other types
    const analysisTypeMap = {
      business_score: {
        assistantId: BUSINESS_SCORE_ASSISTANT_ID,
        insertTable: "business_analyses",
        statusField: "analysis_status",
        statusValue: "complete"
      },
      recommendation: {
        assistantId: RECOMMENDATION_ASSISTANT_ID,
        insertTable: "recommendations",
        statusField: "recommendation_status",
        statusValue: "complete"
      }
    }
    const config = analysisTypeMap[analysisType]
    if (!config) {
      return NextResponse.json({ error: "Unsupported analysisType" }, { status: 400 })
    }
    if (!scrapeData) {
      return NextResponse.json({ error: "No scrape_data found for this business" }, { status: 404 })
    }
    // Run the assistant
    let result
    try {
      result = await runAssistant(config.assistantId, scrapeData)
    } catch (err) {
      return NextResponse.json({ error: "AI analysis error", details: err instanceof Error ? err.message : String(err) }, { status: 500 })
    }
    // Insert into the correct table
    const insertObj = {
      business_id: businessId,
      ...result,
      [config.statusField]: config.statusValue
    }
    const { error: insertError } = await supabaseAdmin.from(config.insertTable).insert(insertObj)
    if (insertError) {
      return NextResponse.json({ error: `Failed to insert ${analysisType} result`, details: insertError.message }, { status: 500 })
    }
    return NextResponse.json({ status: "success", data: result })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
} 