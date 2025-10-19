import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import logger from "@/lib/logger";
import { runAssistant } from "@/app/api/analyze/analyze-api-assistant";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Helper to extract fields for operational_score
function extractOperationalFields(result: any) {
  return {
    asking_price: result?.asking_price ?? null,
    revenue: result?.revenue ?? null,
    ebitda: result?.ebitda ?? null,
    cash_flow: result?.cash_flow ?? null,
    revenue_multiple_result: result?.revenue_multiple_result ?? null,
    revenue_per_sqft_result: result?.revenue_per_sqft_result ?? null,
    profit_margin_result: result?.profit_margin_result ?? null,
    sde_multiple_result: result?.sde_multiple_result ?? null,
    years_operation_result: result?.years_operation_result ?? null,
    lease_terms_result: result?.lease_terms_result ?? null,
    operational_score: result?.operational_score_total ?? result?.operational_score ?? null, // updated
    soft_factors_score: result?.soft_factors_score ?? null,
  };
}

// Helper to extract fields for demographics_score
function extractDemographicsFields(result: any) {
  return {
    city: result?.location?.city ?? null, // added
    state: result?.location?.state ?? null, // added
    demographics_score: result?.demographics_score ?? null,
    demographics_assessment: result?.demographics_assessment ?? null,
    location_score: result?.location_score ?? null,
    location_assessment: result?.location_assessment ?? null,
  };
}

// Helper to deduplicate location data from location_data_collection
function deduplicateLocationData(locationData: any) {
  // Extract the core location info (only once)
  const coreLocation = {
    city: locationData.city,
    state: locationData.state,
    county: locationData.county,
    zip: locationData.zip,
  };

  // Extract the actual data from each agent's response, removing redundant location objects
  const demographicsData = locationData.demographics_raw_data;
  const economicsData = locationData.location_economics_raw_data;
  const competitionData = locationData.competition_raw_data;

  // Remove location objects from each agent's data to avoid redundancy
  const cleanDemographics = demographicsData ? { ...demographicsData } : null;
  const cleanEconomics = economicsData ? { ...economicsData } : null;
  const cleanCompetition = competitionData ? { ...competitionData } : null;

  if (cleanDemographics && cleanDemographics.location) {
    delete cleanDemographics.location;
  }
  if (cleanEconomics && cleanEconomics.location) {
    delete cleanEconomics.location;
  }
  if (cleanCompetition && cleanCompetition.location) {
    delete cleanCompetition.location;
  }

  // Return a clean structure with location info once, plus the agent data
  return {
    location: coreLocation,
    demographics: cleanDemographics,
    economics: cleanEconomics,
    competition: cleanCompetition,
    // Include the extracted fields for convenience
    extracted_fields: {
      area_median_income: locationData.area_median_income,
      area_median_age: locationData.area_median_age,
      area_average_household_size: locationData.area_average_household_size,
      area_cost_of_living_index: locationData.area_cost_of_living_index,
    }
  };
}

export async function POST(request: Request) {
  let businessId: string | undefined;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 });
  }
  try {
    const body = await request.json();
    businessId = body.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
    }
    // Set processing status immediately
    await supabaseAdmin
      .from('businesses')
      .update({ step3_status: 'processing', step4_status: 'processing' })
      .eq('id', businessId);
    // Fetch business data
    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id, business_category_id, listing_structured')
      .eq('id', businessId)
      .single();
    if (businessError || !business) {
      logger.error("[step3-4-location-business-analysis] Business not found:", businessError);
      await supabaseAdmin
        .from('businesses')
        .update({ step3_status: 'failed', step4_status: 'failed' })
        .eq('id', businessId);
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }
    if (!business.business_category_id) {
      return NextResponse.json({ error: "Business category not set for this business." }, { status: 400 });
    }
    if (!business.listing_structured) {
      return NextResponse.json({ error: "listing_structured data missing for this business." }, { status: 400 });
    }

    // Fetch business category to get assistant IDs
    const { data: category, error: categoryError } = await supabaseAdmin
      .from("business_categories")
      .select("id, operational_agent_id, demographics_location_agent_id")
      .eq("id", business.business_category_id)
      .single();
    if (categoryError || !category) {
      logger.error("[step3-4-location-business-analysis] Business category not found:", categoryError);
      return NextResponse.json({ error: "Business category not found." }, { status: 404 });
    }

    // Fetch latest location_data_collection for this business
    const { data: locationData, error: locationError } = await supabaseAdmin
      .from("location_data_collection")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (locationError || !locationData) {
      logger.error("[step3-4-location-business-analysis] Location data not found:", locationError);
      return NextResponse.json({ error: "Location data not found for this business." }, { status: 404 });
    }

    // Prepare agent calls
    const operationalAgentId = category.operational_agent_id;
    const demographicsAgentId = category.demographics_location_agent_id;
    const listingStructured = business.listing_structured;
    
    // Deduplicate location data to avoid sending redundant location info
    const locationAgentInput = deduplicateLocationData(locationData);

    // Run both agents in parallel
    let operationalResult = null;
    let operationalError = null;
    let demographicsResult = null;
    let demographicsError = null;

    const [operational, demographics] = await Promise.all([
      runAssistant(operationalAgentId, listingStructured).catch((e) => {
        operationalError = e instanceof Error ? e.message : String(e);
        return null;
      }),
      runAssistant(demographicsAgentId, locationAgentInput).catch((e) => {
        demographicsError = e instanceof Error ? e.message : String(e);
        return null;
      })
    ]);
    operationalResult = operational;
    demographicsResult = demographics;

    // Store results in operational_score and demographics_score tables
    const now = new Date().toISOString();
    let operationalStatus: 'completed' | 'failed' = operationalResult ? 'completed' : 'failed';
    let demographicsStatus: 'completed' | 'failed' = demographicsResult ? 'completed' : 'failed';

    // Insert operational_score
    try {
      await supabaseAdmin.from("operational_score").insert({
        business_id: businessId,
        business_category_id: business.business_category_id,
        ...extractOperationalFields(operationalResult),
        raw_response: operationalResult || { error: operationalError },
        analysis_status: operationalStatus,
        created_at: now,
        updated_at: now
      });
    } catch (e) {
      logger.error("[step3-4-location-business-analysis] Failed to insert operational_score:", e);
    }

    // Insert demographics_score
    try {
      await supabaseAdmin.from("demographics_score").insert({
        business_id: businessId,
        business_category_id: business.business_category_id,
        ...extractDemographicsFields(demographicsResult),
        raw_response: demographicsResult || { error: demographicsError },
        analysis_status: demographicsStatus,
        created_at: now,
        updated_at: now
      });
    } catch (e) {
      logger.error("[step3-4-location-business-analysis] Failed to insert demographics_score:", e);
    }

    // Update business status fields (step3_status for operational, step4_status for demographics)
    let step3Status: 'completed' | 'failed' | 'error' = operationalStatus === 'completed' ? 'completed' : 'failed';
    let step4Status: 'completed' | 'failed' | 'error' = demographicsStatus === 'completed' ? 'completed' : 'failed';
    if (operationalStatus === 'failed' && demographicsStatus === 'failed') {
      step3Status = 'failed';
      step4Status = 'failed';
    } else {
      if (operationalStatus === 'failed') step3Status = 'failed';
      if (demographicsStatus === 'failed') step4Status = 'failed';
    }
    await supabaseAdmin
      .from('businesses')
      .update({ step3_status: step3Status, step4_status: step4Status })
      .eq('id', businessId);

    // After successful step3-4 completion, trigger step5 synthesis
    if (step3Status === 'completed' && step4Status === 'completed') {
      fetch(`${baseUrl}/api/analysis/step5-synthesis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId })
      }).catch((err) => {
        logger.error("Failed to trigger step5-synthesis:", err);
      });
    }

    // Log results
    logger.info('[step3-4-location-business-analysis] Results:', {
      operationalStatus,
      demographicsStatus,
      operationalError,
      demographicsError
    });

    // Return status and errors
    return NextResponse.json({
      operational_status: operationalStatus,
      demographics_status: demographicsStatus,
      step3_status: step3Status,
      step4_status: step4Status,
      errors: {
        operational: operationalError,
        demographics: demographicsError
      }
    });
  } catch (error) {
    logger.error('[step3-4-location-business-analysis] Unexpected error:', error);
    if (businessId) {
      await supabaseAdmin
        .from('businesses')
        .update({ step3_status: 'failed', step4_status: 'failed' })
        .eq('id', businessId);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 

