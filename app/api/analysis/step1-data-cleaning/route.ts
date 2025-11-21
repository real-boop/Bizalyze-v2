import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { runAssistant } from '../../analyze/analyze-api-assistant';

export async function POST(request: Request) {
  console.log('[Step1] Started');
  
  try {
    const { businessId, listingText } = await request.json();
    
    if (!businessId || !listingText) {
      console.log('[Step1] Failed: Missing required fields');
      return NextResponse.json({ error: 'Missing businessId or listingText' }, { status: 400 });
    }
    
    if (!supabaseAdmin) {
      console.log('[Step1] Failed: Supabase not configured');
      return NextResponse.json({ error: 'Supabase admin client not configured.' }, { status: 500 });
    }
    
    // NOTE: Business record already exists (created by pre-validation endpoint)
    // Step1 UPDATES the existing business record, it does NOT create it
    const { data: business, error: fetchError } = await supabaseAdmin
      .from('businesses')
      .select('listing_structured')
      .eq('id', businessId)
      .single();
    
    if (fetchError || !business) {
      console.log('[Step1] Failed: Business not found');
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    }
    
    if (business.listing_structured) {
      console.log('[Step1] Failed: Already structured');
      await supabaseAdmin.from('businesses').update({ step1_status: 'failed', scrape_status: 'failed' }).eq('id', businessId);
      return NextResponse.json({ error: 'Listing already structured. Not overwriting.' }, { status: 409 });
    }
    
    const promptId = process.env.OPENAI_LISTING_CLEANER_PROMPT_ID;
    if (!promptId) {
      console.log('[Step1] Failed: OpenAI prompt ID not configured');
      await supabaseAdmin.from('businesses').update({ step1_status: 'failed', scrape_status: 'failed' }).eq('id', businessId);
      return NextResponse.json({ error: 'OpenAI prompt ID not configured.' }, { status: 500 });
    }
    
    let structuredResult;
    try {
      structuredResult = await runAssistant(promptId, { listingText });
      if (!structuredResult) throw new Error('No result from assistant');
    } catch (err) {
      console.log('[Step1] Failed:', err instanceof Error ? err.message : String(err));
      await supabaseAdmin.from('businesses').update({ step1_status: 'failed', scrape_status: 'failed' }).eq('id', businessId);
      return NextResponse.json({ error: 'Data cleaning failed: ' + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
    }
    
    const { error: updateError } = await supabaseAdmin
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
      .eq('id', businessId);
      
    if (updateError) {
      console.log('[Step1] Failed: Database update error');
      return NextResponse.json({ error: "Failed to update business record" }, { status: 500 });
    }
    
    console.log('[Step1] Completed');
    return NextResponse.json({ status: 'complete' });
  } catch (error) {
    console.log('[Step1] Failed:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 

