import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ 
        eligible: false, 
        reason: 'Invalid email format' 
      })
    }

    // Check if user already has an account using service role
    const { data: existingUser, error: userCheckError } = await supabaseAdmin
      .rpc('get_user_by_email', { user_email: email })

    if (userCheckError) {
      console.error('Error checking user existence:', userCheckError)
      return NextResponse.json({ 
        eligible: false, 
        reason: 'Server error checking user' 
      })
    }

    if (existingUser && existingUser.length > 0) {
      return NextResponse.json({ 
        eligible: false, 
        reason: 'User already has an account' 
      })
    }

    // Check if invite was sent recently (last 24 hours)
    const { data: recentInvite } = await supabaseAdmin
      .from('user_invites')
      .select('*')
      .eq('email', email)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .single()

    if (recentInvite) {
      return NextResponse.json({ 
        eligible: false, 
        reason: 'Invite already sent recently' 
      })
    }

    return NextResponse.json({ 
      eligible: true, 
      reason: 'Email is eligible for invite' 
    })

  } catch (error) {
    console.error('Invite eligibility check failed:', error)
    return NextResponse.json({ 
      eligible: false, 
      reason: 'Server error' 
    }, { status: 500 })
  }
}
