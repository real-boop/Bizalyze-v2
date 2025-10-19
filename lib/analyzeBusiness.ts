import { supabaseAdmin } from "@/lib/supabase";
import { BUSINESS_SCORE_ASSISTANT_ID, RECOMMENDATION_ASSISTANT_ID, runAssistant, runPerplexityDemographics, runPerplexityCompetition } from "@/app/api/analyze/analyze-api-assistant";
import logger from '@/lib/logger';

function mapBusinessAnalysisToDb(businessId: string, result: any, rawResponse: any, status: 'complete' | 'failed', errorMsg?: string) {
  return {
    business_id: businessId,
    name: result?.name ?? null,
    asking_price: result?.asking_price ?? null,
    revenue: result?.revenue ?? null,
    ebitda: result?.ebitda ?? null,
    cash_flow: result?.cash_flow ?? null,
    lease_remaining_years: result?.lease_remaining_years ?? null,
    lease_renewal_options: result?.lease_renewal_options ?? null,
    equipment_age: result?.equipment_age ?? null,
    equipment_description: result?.equipment_description ?? null,
    washer_count: result?.washer_count ?? null,
    dryer_count: result?.dryer_count ?? null,
    payment_system_type: result?.payment_system_type ?? null,
    payment_system_description: result?.payment_system_description ?? null,
    years_in_operation: result?.years_in_operation ?? null,
    monthly_rent: result?.monthly_rent ?? null,
    square_footage: result?.square_footage ?? null,
    ff_and_e: result?.ff_and_e ?? null,
    employees: result?.employees ?? null,
    misc_details: result?.misc_details ?? null,
    revenue_per_sqft_result: result?.revenue_per_sqft_result ?? null,
    revenue_per_sqft_score: result?.revenue_per_sqft_score ?? null,
    profit_margin_result: result?.profit_margin_result ?? null,
    profit_margin_score: result?.profit_margin_score ?? null,
    price_per_sqft_result: result?.price_per_sqft_result ?? null,
    price_per_sqft_score: result?.price_per_sqft_score ?? null,
    revenue_multiple_result: result?.revenue_multiple_result ?? null,
    revenue_multiple_score: result?.revenue_multiple_score ?? null,
    sde_multiple_result: result?.sde_multiple_result ?? null,
    sde_multiple_score: result?.sde_multiple_score ?? null,
    equipment_age_result: result?.equipment_age_result ?? null,
    equipment_age_score: result?.equipment_age_score ?? null,
    lease_terms_result: result?.lease_terms_result ?? null,
    lease_terms_score: result?.lease_terms_score ?? null,
    score_achieved: result?.score_achieved ?? null,
    score_maximum: result?.score_maximum ?? null,
    score_percentage: result?.score_percentage ?? null,
    score_classification: result?.score_classification ?? null,
    analysis_status: status,
    raw_response: errorMsg ? { error: errorMsg, raw: rawResponse } : rawResponse
  }
}

function mapRecommendationToDb(businessId: string, result: any, rawResponse: any, status: 'complete' | 'failed', errorMsg?: string) {
  return {
    business_id: businessId,
    ideal_range_low: result?.ideal_range_low ?? null,
    ideal_range_high: result?.ideal_range_high ?? null,
    ideal_range_description: result?.ideal_range_description ?? null,
    great_deal_price: result?.great_deal_price ?? null,
    great_deal_description: result?.great_deal_description ?? null,
    current_price: result?.current_price ?? null,
    current_price_description: result?.current_price_description ?? null,
    strength_1: result?.strength_1 ?? null,
    strength_2: result?.strength_2 ?? null,
    strength_3: result?.strength_3 ?? null,
    weakness_1: result?.weakness_1 ?? null,
    weakness_2: result?.weakness_2 ?? null,
    weakness_3: result?.weakness_3 ?? null,
    question_1: result?.question_1 ?? null,
    question_2: result?.question_2 ?? null,
    question_3: result?.question_3 ?? null,
    question_4: result?.question_4 ?? null,
    question_5: result?.question_5 ?? null,
    verdict: result?.verdict ?? null,
    negotiation_focus: result?.negotiation_focus ?? null,
    growth_opportunities: result?.growth_opportunities ?? null,
    recommendation_status: status,
    raw_response: errorMsg ? { error: errorMsg, raw: rawResponse } : rawResponse
  }
}

export async function analyzeBusinessById(id: string, analysis_type?: string) : Promise<{ analysisId: string }> {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured. Check your environment variables.");
  }
  if (!id) {
    throw new Error("Business ID is required");
  }
  // Fetch scrape_data and location from Supabase
  const { data: business, error } = await supabaseAdmin
    .from("businesses")
    .select("id, scrape_data, state, city, county, zip")
    .eq("id", id)
    .single();
  if (error || !business) {
    throw new Error("Business not found or scrape_data missing");
  }
  const scrapeData = business.scrape_data;
  if (!scrapeData) {
    throw new Error("No scrape_data found for this business");
  }
  // Prepare location for Perplexity
  const location = {
    state: business.state,
    city: business.city ?? null,
    county: business.county ?? null,
    zip: business.zip ?? null,
    street: scrapeData?.address?.street ?? null
  };

  // If analysis_type is 'location-only', only run Perplexity analyses
  if (analysis_type === 'location-only') {
    const analysisPromises = [
      {
        name: 'demographics',
        promise: runPerplexityDemographics(business.id, location).then(result => ({ type: 'demographics', result })).catch(err => { logger.error('Demographics Error:', err); return { type: 'demographics', error: err instanceof Error ? err.message : String(err) } })
      },
      {
        name: 'competition',
        promise: runPerplexityCompetition(business.id, location).then(result => ({ type: 'competition', result })).catch(err => { logger.error('Competition Error:', err); return { type: 'competition', error: err instanceof Error ? err.message : String(err) } })
      }
    ];
    await Promise.all(analysisPromises.map(a => a.promise));
    // Insert placeholder in business_analyses if not present
    let analysisId: string | undefined = undefined;
    const { data: latest } = await supabaseAdmin
      .from("business_analyses")
      .select("id")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (latest) {
      analysisId = latest.id;
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin.from("business_analyses").insert({
        business_id: business.id,
        analysis_status: "complete",
        name: business.scrape_data?.name || business.id,
        raw_response: {
          note: "Off-market: No OpenAI analysis",
          address: business.scrape_data?.address || null
        }
      }).select().single();
      if (insertError) throw insertError;
      if (inserted) analysisId = inserted.id;
    }
    // Insert placeholder in recommendations if not present
    const { data: recLatest } = await supabaseAdmin
      .from("recommendations")
      .select("id")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!recLatest) {
      const { error: recInsertError } = await supabaseAdmin.from("recommendations").insert({
        business_id: business.id,
        recommendation_status: "complete",
        raw_response: {
          note: "Off-market: No OpenAI recommendation",
          address: business.scrape_data?.address || null
        }
      });
      if (recInsertError) throw recInsertError;
    }
    if (analysisId) return { analysisId };
    throw new Error("Analysis did not complete successfully");
  }

  // --- OpenAI Business Analysis ---
  let businessAnalysisResult = null;
  let businessAnalysisRaw = null;
  let businessAnalysisError = null;
  let businessAnalysisSuccess = false;
  let analysisId = null;
  try {
    businessAnalysisResult = await runAssistant(BUSINESS_SCORE_ASSISTANT_ID!, scrapeData);
    businessAnalysisRaw = businessAnalysisResult;
    const { data: inserted, error: insertError } = await supabaseAdmin.from("business_analyses").insert(
      mapBusinessAnalysisToDb(business.id, businessAnalysisResult, businessAnalysisRaw, "complete")
    ).select().single();
    if (insertError) throw insertError;
    businessAnalysisSuccess = true;
    analysisId = inserted.id;
    logger.info(`[analyzeBusiness] Set analysis_status to complete for business id: ${business.id}, analysis id: ${analysisId}`);
  } catch (err: any) {
    businessAnalysisError = err instanceof Error ? err.message : String(err);
    const { data: inserted, error: insertError } = await supabaseAdmin.from("business_analyses").insert(
      mapBusinessAnalysisToDb(business.id, null, businessAnalysisRaw, "failed", businessAnalysisError)
    ).select().single();
    if (!analysisId && inserted) analysisId = inserted.id;
  }
  // --- OpenAI Recommendation ---
  let recommendationResult = null;
  let recommendationRaw = null;
  let recommendationError = null;
  let recommendationSuccess = false;
  try {
    recommendationResult = await runAssistant(RECOMMENDATION_ASSISTANT_ID!, scrapeData);
    recommendationRaw = recommendationResult;
    await supabaseAdmin.from("recommendations").insert(
      mapRecommendationToDb(business.id, recommendationResult, recommendationRaw, "complete")
    );
    recommendationSuccess = true;
  } catch (err: any) {
    recommendationError = err instanceof Error ? err.message : String(err);
    await supabaseAdmin.from("recommendations").insert(
      mapRecommendationToDb(business.id, null, recommendationRaw, "failed", recommendationError)
    );
  }
  // --- Perplexity analyses (unchanged) ---
  const analysisPromises = [
    {
      name: 'demographics',
      promise: runPerplexityDemographics(business.id, location).then(result => ({ type: 'demographics', result })).catch(err => { logger.error('Demographics Error:', err); return { type: 'demographics', error: err instanceof Error ? err.message : String(err) } })
    },
    {
      name: 'competition',
      promise: runPerplexityCompetition(business.id, location).then(result => ({ type: 'competition', result })).catch(err => { logger.error('Competition Error:', err); return { type: 'competition', error: err instanceof Error ? err.message : String(err) } })
    }
  ];
  await Promise.all(analysisPromises.map(a => a.promise));
  if (!analysisId) {
    // Try to find the latest analysis for this business
    const { data: latest } = await supabaseAdmin
      .from("business_analyses")
      .select("id")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (latest) analysisId = latest.id;
  }
  if (!analysisId) {
    throw new Error("Analysis did not complete successfully");
  }
  return { analysisId };
} 