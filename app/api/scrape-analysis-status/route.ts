import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase admin client is not configured. Check your environment variables." }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Fetch business scrape status and data
    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("scrape_status, scrape_data")
      .eq("id", id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Fetch all analysis statuses for this business
    const { data: analyses, error: analysesError } = await supabaseAdmin
      .from("business_analyses")
      .select("analysis_status, raw_response")
      .eq("business_id", id);

    if (analysesError) {
      return NextResponse.json({ error: "Failed to fetch analyses" }, { status: 500 });
    }

    const analysisStatuses = analyses ? analyses.map(a => a.analysis_status) : [];
    const analysisRawPresent = analyses ? analyses.some(a => a.raw_response && Object.keys(a.raw_response).length > 0) : false;
    const scrapeDataPresent = !!business.scrape_data && Object.keys(business.scrape_data).length > 0;

    return NextResponse.json({
      scrapeStatus: business.scrape_status || "pending",
      analysisStatuses,
      scrapeDataPresent,
      analysisRawPresent
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 