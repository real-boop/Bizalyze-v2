import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing or invalid sessionId' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('session_user_search_join')
    .select('businesses(url)')
    .eq('search_session_id', sessionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const analyzedBusinessUrls = (data || [])
    .map((row: any) => row.businesses?.url)
    .filter((url: string | undefined) => !!url)

  return NextResponse.json({ analyzedBusinessUrls })
} 