import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@supabase/supabase-js'
import { analyzeBusinessById } from '@/lib/analyzeBusiness'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Example DB client import (replace with your actual DB client)
// import { db } from '@/lib/db'

// Helper to validate UUID
function isValidUUID(id: any) {
  return typeof id === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, address, session_id, user_id } = body
    console.log('[OffMarket] Received request:', { name, address, session_id, user_id })

    if (!name || !address || !address.street || !address.city || !address.state || !address.zip || !session_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Build synthetic URL
    const syntheticUrl = `offmarket:${name}:${address.street},${address.city},${address.state},${address.zip}`
    console.log('[OffMarket] Synthetic URL:', syntheticUrl)

    // 1. Check for existing business by synthetic URL
    const { data: existingBusinesses, error: findBizError } = await supabase
      .from('businesses')
      .select('id')
      .eq('url', syntheticUrl)
      .order('created_at', { ascending: false })
    if (findBizError) {
      console.error('[OffMarket] Error checking for business:', findBizError)
      return NextResponse.json({ error: 'Failed to check for business', details: findBizError.message }, { status: 500 })
    }
    let business_id: string
    if (existingBusinesses && existingBusinesses.length > 0) {
      business_id = existingBusinesses[0].id
      console.log('[OffMarket] Found existing business:', business_id)
    } else {
      business_id = uuidv4()
      const scrape_data = {
        address: {
          street: address.street,
          city: address.city,
          state: address.state,
          zip: address.zip,
          county: address.county || '',
        },
      }
      const { error: bizError } = await supabase
        .from('businesses')
        .insert([{
          id: business_id,
          url: syntheticUrl,
          name,
          city: address.city,
          state: address.state,
          county: address.county || '',
          zip: address.zip,
          scrape_data,
          scrape_status: 'complete',
        }])
      if (bizError) {
        console.error('[OffMarket] Error inserting business:', bizError)
        return NextResponse.json({ error: 'Failed to insert business', details: bizError.message }, { status: 500 })
      }
      console.log('[OffMarket] Created new business:', business_id)
    }

    // 2. Check for existing join row
    let joinQuery = supabase
      .from('session_user_search_join')
      .select('id, analysis_id, status')
      .eq('business_id', business_id)
      .eq('search_session_id', session_id)
    if (user_id && isValidUUID(user_id)) {
      joinQuery = joinQuery.eq('user_id', user_id)
    }
    const { data: joinRows, error: joinFindError } = await joinQuery
    if (joinFindError) {
      console.error('[OffMarket] Error checking for join row:', joinFindError)
      return NextResponse.json({ error: 'Failed to check for join row', details: joinFindError.message }, { status: 500 })
    }
    let join_id: string | null = null
    let join_analysis_id: string | null = null
    let join_status: string | null = null
    if (joinRows && joinRows.length > 0) {
      join_id = joinRows[0].id
      join_analysis_id = joinRows[0].analysis_id
      join_status = joinRows[0].status
      console.log('[OffMarket] Found existing join row:', join_id)
    } else {
      // Insert join row (pending, no analysis yet)
      const { data: joinInsert, error: joinInsertError } = await supabase
        .from('session_user_search_join')
        .insert([{
          user_id: isValidUUID(user_id) ? user_id : null,
          search_session_id: session_id || null,
          business_id,
          analysis_id: null,
          status: 'pending',
        }])
        .select('id')
        .single()
      if (joinInsertError) {
        console.error('[OffMarket] Error inserting join row:', joinInsertError)
        return NextResponse.json({ error: 'Failed to insert join row', details: joinInsertError.message }, { status: 500 })
      }
      join_id = joinInsert.id
      join_analysis_id = null
      join_status = 'pending'
      console.log('[OffMarket] Created new join row:', join_id)
    }

    // 3. Check for existing analysis
    const { data: analyses, error: findAnalysisError } = await supabase
      .from('business_analyses')
      .select('id, analysis_status')
      .eq('business_id', business_id)
      .eq('analysis_status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
    if (findAnalysisError) {
      console.error('[OffMarket] Error checking for analysis:', findAnalysisError)
      return NextResponse.json({ error: 'Failed to check for analysis', details: findAnalysisError.message }, { status: 500 })
    }
    let analysis_id: string | null = null
    if (analyses && analyses.length > 0) {
      analysis_id = analyses[0].id
      console.log('[OffMarket] Found existing analysis:', analysis_id)
      // Update join row with analysis_id and status: complete
      const { error: joinUpdateError } = await supabase
        .from('session_user_search_join')
        .update({ analysis_id, status: 'complete' })
        .eq('id', join_id)
      if (joinUpdateError) {
        console.error('[OffMarket] Error updating join row:', joinUpdateError)
        return NextResponse.json({ error: 'Failed to update join row', details: joinUpdateError.message }, { status: 500 })
      }
      return NextResponse.json({ business_id, analysis_id, status: 'complete', redirect: true })
    }

    // 4. Run analysis inline (location-only)
    try {
      console.log('[OffMarket] Running inline analysis for business:', business_id)
      const analysisResult = await analyzeBusinessById(business_id, 'location-only')
      analysis_id = analysisResult.analysisId
      // Update join row with analysis_id and status: complete
      const { error: joinUpdateError } = await supabase
        .from('session_user_search_join')
        .update({ analysis_id, status: 'complete' })
        .eq('id', join_id)
      if (joinUpdateError) {
        console.error('[OffMarket] Error updating join row after analysis:', joinUpdateError)
        return NextResponse.json({ error: 'Failed to update join row after analysis', details: joinUpdateError.message }, { status: 500 })
      }
      console.log('[OffMarket] Analysis complete, updated join row:', join_id)
      return NextResponse.json({ business_id, analysis_id, status: 'complete', redirect: true })
    } catch (err) {
      console.error('[OffMarket] Error running inline analysis:', err)
      return NextResponse.json({ error: 'Failed to run analysis', details: err instanceof Error ? err.message : String(err) }, { status: 500 })
    }
  } catch (error) {
    console.error('[OffMarket] Error in trigger-offmarket-analysis:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error)?.message || String(error) },
      { status: 500 }
    )
  }
} 