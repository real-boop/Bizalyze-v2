import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { runAssistant } from '../../analyze/analyze-api-assistant';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function POST(request: Request) {
  try {
    const { businessId, listingText } = await request.json();
    if (!businessId || !listingText) {
      return NextResponse.json({ error: 'Missing businessId or listingText' }, { status: 400 });
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not configured.' }, { status: 500 });
    }
    // Check if listing_structured is already set
    const { data: business, error: fetchError } = await supabaseAdmin
      .from('businesses')
      .select('listing_structured')
      .eq('id', businessId)
      .single();
    if (fetchError || !business) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    }
    if (business.listing_structured) {
      // Already structured, do not overwrite
      await supabaseAdmin.from('businesses').update({ step1_status: 'failed', scrape_status: 'failed' }).eq('id', businessId);
      return NextResponse.json({ error: 'Listing already structured. Not overwriting.' }, { status: 409 });
    }
    // Call OpenAI assistant using runAssistant helper
    const assistantId = process.env.OPENAI_LISTING_CLEANER_ASSISTANT_ID;
    if (!assistantId) {
      await supabaseAdmin.from('businesses').update({ step1_status: 'failed', scrape_status: 'failed' }).eq('id', businessId);
      return NextResponse.json({ error: 'OpenAI assistant ID not configured.' }, { status: 500 });
    }
    let structuredResult;
    try {
      structuredResult = await runAssistant(assistantId, { listingText });
      if (!structuredResult) throw new Error('No result from assistant');
    } catch (err) {
      await supabaseAdmin.from('businesses').update({ step1_status: 'failed', scrape_status: 'failed' }).eq('id', businessId);
      return NextResponse.json({ error: 'Data cleaning failed: ' + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
    // Log before update
    console.log("[step1-data-cleaning] Updating business record", { businessId, structuredResult });
    const { error: updateError, data: updatedBusiness } = await supabaseAdmin
      .from('businesses')
      .update({
        name: structuredResult.name ?? null,
        city: structuredResult.city ?? null,
        state: structuredResult.state ?? null,
        county: structuredResult.county ?? null,
        zip: structuredResult.zip ?? null,
        listing_structured: structuredResult,
        step1_status: 'completed',
        scrape_status: 'completed'
      })
      .eq('id', businessId)
      .select()
      .single();
    if (updateError || !updatedBusiness) {
      console.error("[step1-data-cleaning] Failed to update business record", { businessId, updateError, structuredResult });
      return NextResponse.json({ error: "Failed to update business record" }, { status: 500 });
    }
    console.log("[step1-data-cleaning] Successfully updated business record", { businessId, updatedBusiness });

    // After successful step1 completion, trigger step2
    fetch(`${baseUrl}/api/analysis/step2-location-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId })
    }).catch((err) => {
      console.error("Failed to trigger step2-location-data:", err);
    });

    return NextResponse.json({ status: 'complete' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 

