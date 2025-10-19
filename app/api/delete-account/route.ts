import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase admin client for accessing auth and database
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]

    // Verify the JWT token and get user info
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get the password from request body
    const { password } = await request.json()
    
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }

    // Verify password by attempting to sign in
    const { error: verifyError } = await supabaseAdmin.auth.signInWithPassword({
      email: user.email!,
      password: password
    })

    if (verifyError) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    console.log(`Starting account deletion for user: ${user.id}`)

    // Step 1: Delete from session_user_search_join (CASCADE will handle related records)
    const { error: sessionError } = await supabaseAdmin
      .from('session_user_search_join')
      .delete()
      .eq('user_id', user.id)

    if (sessionError) {
      console.error('Error deleting session_user_search_join:', sessionError)
      return NextResponse.json({ 
        error: 'Failed to delete user search sessions' 
      }, { status: 500 })
    }

    // Step 2: Delete from search_sessions where user_id matches
    const { error: searchSessionsError } = await supabaseAdmin
      .from('search_sessions')
      .delete()
      .eq('user_id', user.id)

    if (searchSessionsError) {
      console.error('Error deleting search_sessions:', searchSessionsError)
      return NextResponse.json({ 
        error: 'Failed to delete search sessions' 
      }, { status: 500 })
    }

    // Step 3: Delete from businesses where user owns them
    const { error: businessesError } = await supabaseAdmin
      .from('businesses')
      .delete()
      .eq('user_id', user.id)

    if (businessesError) {
      console.error('Error deleting businesses:', businessesError)
      return NextResponse.json({ 
        error: 'Failed to delete user businesses' 
      }, { status: 500 })
    }

    // Step 4: Delete the user from Supabase auth (this will also delete from auth.users)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (deleteUserError) {
      console.error('Error deleting user from auth:', deleteUserError)
      return NextResponse.json({ 
        error: 'Failed to delete user account' 
      }, { status: 500 })
    }

    console.log(`Successfully deleted account for user: ${user.id}`)

    return NextResponse.json({ 
      success: true,
      message: 'Account deleted successfully' 
    })

  } catch (error) {
    console.error('Error in delete-account API:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
