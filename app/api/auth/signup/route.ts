// app/api/auth/signup/route.ts
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { createClient } from "@supabase/supabase-js"
import logger from '@/lib/logger'
import { randomBytes } from 'crypto'

// Create Supabase client for auth operations (needs service role key)
const supabaseAuth = supabaseAdmin

// Helper function to check user status
async function checkUserStatus(email: string) {
  try {
    if (!supabaseAuth) {
      logger.error("[checkUserStatus] Supabase admin client not available")
      return { exists: false, isActive: false }
    }
    
    // Check if user exists in auth.users
    const { data: existingUser, error } = await supabaseAuth.auth.admin.listUsers()
    
    if (error) {
      logger.error("[checkUserStatus] Error listing users:", error)
      return { exists: false, isActive: false }
    }
    
    // Find user by email
    const user = existingUser.users.find(u => u.email === email)
    
    if (!user) {
      return { exists: false, isActive: false }
    }
    
    return { 
      exists: true, 
      isActive: user.email_confirmed_at !== null && !user.app_metadata?.deactivated
    }
  } catch (error) {
    logger.error("[checkUserStatus] Error checking user:", error)
    return { exists: false, isActive: false }
  }
}

// Helper function to create user-business relationship
async function createUserBusinessRelationship(userId: string, businessId: string) {
  try {
    if (!supabaseAdmin) {
      logger.error("[createUserBusinessRelationship] Supabase admin client not available")
      return false
    }
    
    const { error } = await supabaseAdmin
      .from('user_businesses')
      .insert({
        user_id: userId,
        business_id: businessId
      })
    
    if (error) {
      logger.error("[createUserBusinessRelationship] Failed to create relationship:", error)
      return false
    }
    
    logger.debug("[createUserBusinessRelationship] Successfully created user-business relationship")
    return true
  } catch (error) {
    logger.error("[createUserBusinessRelationship] Error creating relationship:", error)
    return false
  }
}

interface SignupRequest {
  email: string
  password?: string
  businessId: string
  path: 'pdf-only' | 'full-access' | 'password-reset'
  pdfUrl?: string
}

export async function POST(request: Request) {
  if (!supabaseAuth) {
    logger.error("[POST /api/auth/signup] Supabase admin client not configured")
    return NextResponse.json({ 
      error: "Authentication service not configured. Check your environment variables." 
    }, { status: 500 })
  }

  try {
    const body: SignupRequest = await request.json()
    const { email, password, businessId, path, pdfUrl } = body

    logger.debug("[POST /api/auth/signup] Request received:", { email, businessId, path, hasPdfUrl: !!pdfUrl })

    // Check user status first
    const userStatus = await checkUserStatus(email)
    logger.debug("[POST /api/auth/signup] User status:", userStatus)

    // Validate required fields
    if (!email || !businessId || !path) {
      logger.error("[POST /api/auth/signup] Missing required fields:", { email: !!email, businessId: !!businessId, path })
      return NextResponse.json({ 
        error: "Email, businessId, and path are required" 
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
    if (!emailRegex.test(email)) {
      logger.error("[POST /api/auth/signup] Invalid email format:", email)
      return NextResponse.json({ 
        error: "Please enter a valid email address" 
      }, { status: 400 })
    }

    // Validate path
    if (path !== 'pdf-only' && path !== 'full-access' && path !== 'password-reset') {
      logger.error("[POST /api/auth/signup] Invalid path:", path)
      return NextResponse.json({ 
        error: "Invalid signup path" 
      }, { status: 400 })
    }

    // Handle different user states
    if (userStatus.exists && userStatus.isActive) {
      // Handle password reset request
      if (path === 'password-reset') {
        await supabaseAuth.auth.resetPasswordForEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`
        })
        
        return NextResponse.json({ 
          success: true,
          message: "Password reset email sent. Check your inbox."
        })
      }
      
      // Existing active user - handle login
      if (path === 'full-access' && password) {
        // Try to sign in with provided password
        const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
          email,
          password
        })
        
        if (signInError) {
          // Wrong password - just return error, don't send reset email yet
          return NextResponse.json({ 
            error: "WRONG_PASSWORD",
            message: "Password incorrect. Please try again."
          }, { status: 400 })
        }
        
        // Successful login - create user-business relationship
        const relationshipCreated = await createUserBusinessRelationship(signInData.user.id, businessId)
        if (!relationshipCreated) {
          logger.error("[POST /api/auth/signup] Failed to create user-business relationship, but login was successful")
        }
        
        return NextResponse.json({ 
          success: true, 
          redirect: true,
          message: "Login successful. Redirecting to dashboard...",
          userId: signInData.user.id
        })
      } else if (path === 'pdf-only') {
        // PDF-only path for existing user - update their record and allow PDF access
        // First, get the user ID from auth.users
        const { data: { users }, error: listError } = await supabaseAuth.auth.admin.listUsers()
        if (listError) {
          logger.error("[POST /api/auth/signup] Error getting user ID:", listError)
          return NextResponse.json({ error: "Failed to get user information" }, { status: 500 })
        }
        
        const existingUser = users.find(u => u.email === email)
        if (!existingUser) {
          return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        // Update existing user-business relationship
        if (!supabaseAdmin) {
          logger.error("[POST /api/auth/signup] Supabase admin client not available for update")
          return NextResponse.json({ error: "Database service not available" }, { status: 500 })
        }
        
        const { error: updateError } = await supabaseAdmin
          .from("user_businesses")
          .update({
            user_id: existingUser.id,
            pdf_url: pdfUrl || null
          })
          .eq("user_email", email)
          .eq("business_id", businessId)

        if (updateError) {
          logger.error("[POST /api/auth/signup] Failed to update user-business relationship:", updateError)
          return NextResponse.json({ error: "Failed to update user record" }, { status: 500 })
        }

        return NextResponse.json({ 
          success: true,
          message: "PDF access granted for existing user.",
          redirect: true
        })
      } else {
        // Full-access path for existing user - force them to login
        return NextResponse.json({ 
          error: "USER_EXISTS_PDF_ONLY",
          message: "You've already received your free report! Please login to access your dashboard."
        }, { status: 400 })
      }
    } else if (userStatus.exists && !userStatus.isActive) {
      // Existing but inactive user - send activation email
      await supabaseAuth.auth.signInWithOtp({
        email,
        options: {
          data: { businessId, signupPath: 'account-activation' },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`
        }
      })
      
      return NextResponse.json({ 
        error: "USER_INACTIVE",
        message: "Account activation email sent. Check your inbox."
      }, { status: 200 })
    } else {
      // New user - proceed with normal signup
      // Generate password for pdf-only path
      let finalPassword: string
      let isAutoPassword = false

      if (path === 'pdf-only') {
        // Generate secure random password for PDF-only users
        finalPassword = randomBytes(16).toString('hex')
        isAutoPassword = true
        logger.debug("[POST /api/auth/signup] Generated auto-password for pdf-only user")
      } else {
        // Validate user-provided password for full-access
        if (!password) {
          logger.error("[POST /api/auth/signup] Password required for full-access path")
          return NextResponse.json({ 
            error: "Password is required for full dashboard access" 
          }, { status: 400 })
        }
        if (password.length < 6) {
          logger.error("[POST /api/auth/signup] Password too short")
          return NextResponse.json({ 
            error: "Password must be at least 6 characters long" 
          }, { status: 400 })
        }
        finalPassword = password
        isAutoPassword = false
        logger.debug("[POST /api/auth/signup] Using user-provided password for full-access user")
      }

      // Get business info for email template
    let businessName = 'Business Analysis'
    if (businessId && supabaseAdmin) {
      try {
        const { data: businessData } = await supabaseAdmin
          .from('businesses')
          .select('name')
          .eq('id', businessId)
          .single()
        
        if (businessData?.name) {
          businessName = businessData.name
        }
      } catch (err) {
        logger.debug('[POST /api/auth/signup] Could not fetch business name:', err)
      }
    }

    // Create account with Supabase Auth
    logger.debug("[POST /api/auth/signup] Creating Supabase account...")
    const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
      email,
      password: finalPassword,
      options: {
        data: {
          isAutoPassword,
          businessId,
          signupPath: path,
          createdAt: new Date().toISOString(),
          // NEW: Store PDF URL in user metadata for email template
          pdfUrl: pdfUrl, // This becomes {{ .Data.pdfUrl }} in email
          businessName: businessName
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
      }
    })

    if (authError) {
      logger.error("[POST /api/auth/signup] Supabase auth error:", authError)
      
      // Handle specific error cases
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ 
          error: "An account with this email already exists" 
        }, { status: 409 })
      }
      
      return NextResponse.json({ 
        error: authError.message || "Failed to create account" 
      }, { status: 400 })
    }

    if (!authData.user) {
      logger.error("[POST /api/auth/signup] No user data returned from Supabase")
      return NextResponse.json({ 
        error: "Account creation failed - no user data" 
      }, { status: 500 })
    }

    logger.debug("[POST /api/auth/signup] Account created successfully:", { 
      userId: authData.user.id, 
      email: authData.user.email,
      path 
    })

    // Create or update user-business relationship
    try {
      if (!supabaseAdmin) {
        logger.error("[POST /api/auth/signup] Supabase admin client not available for business linking")
        return NextResponse.json({ 
          error: "Service temporarily unavailable" 
        }, { status: 500 })
      }
      
      // First, try to update existing record (for free analysis users)
      const { data: updateResult, error: updateError } = await supabaseAdmin
        .from("user_businesses")
        .update({
          user_id: authData.user.id,
          user_email: email,
          pdf_url: pdfUrl || null
        })
        .eq('business_id', businessId)
        .eq('user_email', email)
        .is('user_id', null) // Only update records without user_id
        .select()

      if (updateError) {
        logger.error("[POST /api/auth/signup] Failed to update existing user-business record:", updateError)
      } else if (updateResult && updateResult.length > 0) {
        logger.debug("[POST /api/auth/signup] Updated existing user-business relationship:", updateResult[0])
      } else {
        // No existing record found, create new one
        logger.debug("[POST /api/auth/signup] No existing record found, creating new user-business relationship")
        
        const { error: insertError } = await supabaseAdmin
          .from("user_businesses")
          .insert({
            user_id: authData.user.id,
            user_email: email,
            business_id: businessId,
            payment_type: 'free', // Default for new records
            amount_paid: 0,
            analysis_complete: false,
            pdf_requested: false,
            pdf_url: pdfUrl || null
          })

        if (insertError) {
          logger.error("[POST /api/auth/signup] Failed to create new user-business relationship:", insertError)
        } else {
          logger.debug("[POST /api/auth/signup] Created new user-business relationship with PDF URL:", !!pdfUrl)
        }
      }
    } catch (err) {
      logger.error("[POST /api/auth/signup] Unexpected error linking user to business:", err)
      // Don't fail the whole request for this
    }

    // Return success response
    logger.debug("[POST /api/auth/signup] Signup process completed successfully")
    return NextResponse.json({
      success: true,
      message: "Account created successfully. Check your email for confirmation.",
      user: {
        id: authData.user.id,
        email: authData.user.email
      },
      path
    })

    } // End of new user logic

  } catch (error) {
    logger.error("[POST /api/auth/signup] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return NextResponse.json({
      error: "An unexpected error occurred. Please try again.",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
