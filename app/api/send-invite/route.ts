import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { email, inviterId } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid email format' 
      })
    }

    if (!inviterId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Inviter ID is required' 
      })
    }

    // Send the invite using admin client
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
    
    if (error) {
      console.error('Failed to send invite:', error)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to send invite' 
      })
    }

    // Log the invite in our database
    await supabaseAdmin
      .from('user_invites')
      .insert({
        inviter_id: inviterId,
        email: email,
        status: 'pending'
      })

    return NextResponse.json({ 
      success: true, 
      message: 'Invite sent successfully' 
    })

  } catch (error) {
    console.error('Send invite failed:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Server error' 
    }, { status: 500 })
  }
}
