import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    console.log('📧 [Resend Verification] Sending verification email to:', email)

    // Check if email exists in any account
    const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (userError) {
      console.error('❌ [Resend Verification] Error checking users:', userError)
      return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 })
    }

    const userExists = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    
    if (!userExists) {
      console.log('❌ [Resend Verification] Email not found in any account:', email)
      return NextResponse.json({ 
        error: 'No account found. Please check your email.' 
      }, { status: 404 })
    }

    // Check if account is already verified
    if (userExists.email_confirmed_at) {
      console.log('✅ [Resend Verification] Account already verified:', email)
      return NextResponse.json({ 
        error: 'This account is already verified. Please try signing in instead.' 
      }, { status: 409 })
    }

    // ✅ Use auth.resend to actually send the verification email
    // This is the correct method for resending confirmation emails (like auth.signUp does)
    const { error } = await supabaseAdmin.auth.resend({
      type: 'signup',
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`
      }
    })

    if (error) {
      console.error('❌ [Resend Verification] Error sending verification email:', error)
      return NextResponse.json({ error: 'Failed to resend verification email' }, { status: 500 })
    }

    console.log('✅ [Resend Verification] Verification email sent successfully to:', email)
    
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('❌ [Resend Verification] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

