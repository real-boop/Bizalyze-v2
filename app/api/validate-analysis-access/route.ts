import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 });
  }

  try {
    const { email, listing_url } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Normalize email to lowercase for consistent comparison
    const normalizedEmail = email.toLowerCase();

    // Validate email format
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ 
        error: "Invalid email format",
        canGetFree: false,
        hasAccount: false,
        needsPayment: true
      }, { status: 400 });
    }

    // 1. Check if email has any analysis (free or paid) - case insensitive
    const { data: userBusinesses, error: userBusinessError } = await supabaseAdmin
      .from('user_businesses')
      .select('id, business_id, payment_type, analysis_complete, pdf_requested, listing_url')
      .ilike('user_email', normalizedEmail);
    
    if (userBusinessError) {
      console.error('[Email Validation] Error checking user business:', userBusinessError);
      return NextResponse.json({ error: 'Failed to check user business status' }, { status: 500 });
    }

    // 2. Check if email has account in Supabase Auth - use direct email lookup
    let userAccount = null;
    let hasAccount = false;
    
    // Use the PostgreSQL function to get user by email directly
    const { data: userData, error: authError } = await supabaseAdmin.rpc('get_user_by_email', { 
      user_email: normalizedEmail 
    });
    
    if (authError) {
      console.error('[Email Validation] Error checking auth user:', authError);
      return NextResponse.json({ error: 'Failed to check user account status' }, { status: 500 });
    }

    // If user found, use the data directly from the function
    if (userData && userData.length > 0) {
      const userRecord = userData[0];
      userAccount = {
        id: userRecord.id,
        email: userRecord.email,
        email_confirmed_at: userRecord.email_confirmed_at
      };
      hasAccount = true;
    }
    
    // DEBUG: Log the full user object to see available fields
    console.log('[Email Validation] Full user object:', JSON.stringify(userAccount, null, 2));
    
    // NEW: Check if account is verified - treat unverified accounts as 'new users'
    // Check for email_confirmed_at field - if it exists and is not null, user is verified
    // If email_confirmed_at is not available, assume unverified (treat as new user)
    const isAccountVerified = userAccount?.email_confirmed_at != null && userAccount?.email_confirmed_at !== undefined;
    const shouldTreatAsNewUser = hasAccount && !isAccountVerified;
    
    // Override hasAccount for unverified users - treat them as new users
    const effectiveHasAccount = shouldTreatAsNewUser ? false : hasAccount;
    
    // 3. Determine analysis eligibility
    // Check if user already paid for this specific listing
    const hasPaidForThisListing = listing_url ? userBusinesses?.some(ub => 
      ub.listing_url === listing_url && ub.payment_type === 'paid'
    ) : false;
    
    const canGetFree = hasPaidForThisListing; // Only allow access if already paid for this listing

    console.log('[Email Validation] User status:', {
      email: normalizedEmail,
      hasAccount,
      isAccountVerified,
      shouldTreatAsNewUser,
      effectiveHasAccount,
      hasPaidForThisListing,
      emailConfirmedAt: userAccount?.email_confirmed_at
    });

    return NextResponse.json({
      canGetFree,
      hasAccount: effectiveHasAccount, // Use the effective value (false for unverified users)
      isAccountVerified: userAccount?.email_confirmed_at ? true : false,
      email: normalizedEmail, // Return normalized email
      hasPaidForThisListing,
      hasAnalyzedThisListing: hasPaidForThisListing  // For UserAnalysisModal duplicate check
    });

  } catch (error) {
    console.error('[Email Validation] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}