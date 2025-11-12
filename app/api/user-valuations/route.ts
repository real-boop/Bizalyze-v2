import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    // Extract the JWT token
    const token = authHeader.split(' ')[1]
    
    // Verify the JWT token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Get user's email (normalize to lowercase for matching)
    const userEmail = user.email?.toLowerCase().trim()
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    // Query lead_magnet_entries by email (case-insensitive match)
    // Since emails are stored in lowercase, we can use eq
    const { data: valuations, error: valuationsError } = await supabaseAdmin
      .from('lead_magnet_entries')
      .select('*')
      .eq('email', userEmail)
      .order('created_at', { ascending: false })

    if (valuationsError) {
      console.error('[user-valuations] Error fetching valuations:', valuationsError)
      return NextResponse.json({ error: 'Failed to fetch valuations' }, { status: 500 })
    }

    if (!valuations || valuations.length === 0) {
      return NextResponse.json({ 
        valuations: [],
        count: 0
      })
    }

    // Return the valuations data
    return NextResponse.json({ 
      valuations: valuations,
      count: valuations.length
    })

  } catch (error) {
    console.error('[user-valuations] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

