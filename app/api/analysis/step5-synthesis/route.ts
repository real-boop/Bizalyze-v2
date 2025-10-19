import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import logger from "@/lib/logger";
import { runAssistant } from "@/app/api/analyze/analyze-api-assistant";

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
      .update({ step5_status: 'processing' })
      .eq('id', businessId);
    // Fetch business and category
    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("id, business_category_id")
      .eq("id", businessId)
      .single();
    if (businessError || !business) {
      logger.error("[step5-synthesis] Business not found:", businessError);
      await supabaseAdmin
        .from('businesses')
        .update({ step5_status: 'failed' })
        .eq('id', businessId);
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }
    if (!business.business_category_id) {
      return NextResponse.json({ error: "Business category not set for this business." }, { status: 400 });
    }

    // Fetch business category for weights and agent ID
    const { data: category, error: categoryError } = await supabaseAdmin
      .from("business_categories")
      .select("id, price_synthesizer_agent_id, operational_weight, soft_factors_weight, demographics_weight, location_weight")
      .eq("id", business.business_category_id)
      .single();
    if (categoryError || !category) {
      logger.error("[step5-synthesis] Business category not found:", categoryError);
      return NextResponse.json({ error: "Business category not found." }, { status: 404 });
    }

    // Fetch latest operational_score
    const { data: operationalScore, error: opError } = await supabaseAdmin
      .from("operational_score")
      .select("raw_response")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (opError || !operationalScore) {
      logger.error("[step5-synthesis] Operational score not found:", opError);
      return NextResponse.json({ error: "Operational score not found." }, { status: 404 });
    }

    // Fetch latest demographics_score
    const { data: demographicsScore, error: demoError } = await supabaseAdmin
      .from("demographics_score")
      .select("raw_response")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (demoError || !demographicsScore) {
      logger.error("[step5-synthesis] Demographics score not found:", demoError);
      return NextResponse.json({ error: "Demographics score not found." }, { status: 404 });
    }

    // Build prompt
    const weights = {
      operational_weight: category.operational_weight,
      soft_factors_weight: category.soft_factors_weight,
      demographics_weight: category.demographics_weight,
      location_weight: category.location_weight,
    };
    const prompt = `Scoring weights: ${JSON.stringify(weights)}\nOperational score: ${JSON.stringify(operationalScore.raw_response)}\nDemographics score: ${JSON.stringify(demographicsScore.raw_response)}`;

    // Call price synthesizer assistant
    let assistantResponse = null;
    let assistantError = null;
    try {
      assistantResponse = await runAssistant(category.price_synthesizer_agent_id, prompt);
    } catch (e) {
      assistantError = e instanceof Error ? e.message : String(e);
      logger.error("[step5-synthesis] Assistant error:", assistantError);
    }

    // Extract fields from assistant response (fallback to null if missing)
    let extracted = {};
    if (assistantResponse && typeof assistantResponse === "object") {
      extracted = {
        current_price: assistantResponse.current_price ?? null,
        revenue: assistantResponse.revenue ?? null,
        sde: assistantResponse.sde ?? null,
        weighted_average_score: assistantResponse.weighted_average_score ?? null,
        price_multiplier: assistantResponse.price_multiplier ?? null,
        ideal_revenue_range: assistantResponse.ideal_revenue_range ?? null,
        ideal_sde_range: assistantResponse.ideal_sde_range ?? null,
      };
    }

    // Store in recommendation table
    try {
      await supabaseAdmin.from("recommendation").insert({
        business_id: businessId,
        business_category_id: business.business_category_id,
        raw_response: assistantResponse || { error: assistantError },
        ...extracted,
        analysis_status: assistantResponse ? "completed" : "failed",
      });
    } catch (e) {
      logger.error("[step5-synthesis] Failed to insert recommendation:", e);
    }

    // Update step5_status in businesses
    try {
      await supabaseAdmin.from("businesses").update({ step5_status: assistantResponse ? "completed" : "failed" }).eq("id", businessId);
    } catch (e) {
      logger.error("[step5-synthesis] Failed to update business step5_status:", e);
    }

    // Update user_businesses status to analysis_complete when step5 completes
    if (assistantResponse) {
      try {
        // TIER 1: Try updating by business_id (normal path)
        const { data: tier1Data, error: tier1Error } = await supabaseAdmin
          .from("user_businesses")
          .update({ 
            analysis_complete: true,
            status: 'analysis_complete'
          })
          .eq("business_id", businessId)
          .select();
        
        if (tier1Data && tier1Data.length > 0) {
          logger.info(`[step5-synthesis] ✅ Updated ${tier1Data.length} record(s) by business_id`);
        } else {
          // TIER 2: Fallback for race condition - find orphaned record by listing_url
          logger.info("[step5-synthesis] ⚠️ No records found by business_id, attempting fallback...");
          
          // Get the listing_url from this business
          const { data: businessData, error: businessError } = await supabaseAdmin
            .from("businesses")
            .select("listing_url")
            .eq("id", businessId)
            .single();
          
          if (businessError || !businessData?.listing_url) {
            logger.error("[step5-synthesis] ❌ Could not fetch business listing_url:", businessError);
          } else {
            logger.info(`[step5-synthesis] 🔍 Found listing_url: ${businessData.listing_url}`);
            
            // Find and update orphaned record(s) with matching listing_url
            const { data: tier2Data, error: tier2Error } = await supabaseAdmin
              .from("user_businesses")
              .update({ 
                business_id: businessId,        // Link it now
                analysis_complete: true,
                status: 'analysis_complete'
              })
              .eq("listing_url", businessData.listing_url)
              .is("business_id", null)          // Only orphaned records
              .gte("created_at", new Date(Date.now() - 3600000).toISOString()) // Last hour only
              .select();
            
            if (tier2Data && tier2Data.length > 0) {
              logger.info(`[step5-synthesis] ✅ RECOVERED: Linked ${tier2Data.length} orphaned record(s) via fallback`);
            } else {
              logger.error("[step5-synthesis] ❌ Fallback found no matching records");
              logger.error(`[step5-synthesis] 🔍 Searched for: listing_url=${businessData.listing_url}, business_id=null, created in last hour`);
            }
          }
        }
      } catch (e) {
        logger.error("[step5-synthesis] Failed to update user_businesses status:", e);
      }
    }

    // Return status and extracted fields
    return NextResponse.json({
      status: assistantResponse ? "completed" : "failed",
      ...extracted,
      error: assistantError,
    });
  } catch (error) {
    logger.error('[step5-synthesis] Unexpected error:', error);
    if (businessId) {
      await supabaseAdmin
        .from('businesses')
        .update({ step5_status: 'failed' })
        .eq('id', businessId);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 