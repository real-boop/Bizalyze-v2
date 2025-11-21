import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export async function POST(request: Request) {
  console.log('[pre-validate-business] 🚀 Route hit - Request received');
  
  if (!supabaseAdmin) {
    console.error('[pre-validate-business] ❌ Supabase admin client not configured');
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 });
  }

  try {
    const requestBody = await request.json();
    console.log('[pre-validate-business] 📥 Request body received:', {
      categoryId: requestBody.categoryId,
      listingType: requestBody.listingType,
      hasListingUrl: !!requestBody.listingUrl,
      listingTextLength: requestBody.listingText?.length,
      hasUserId: !!requestBody.userId,
      email: requestBody.email
    });
    
    const { 
      categoryId, 
      listingUrl, 
      listingText, 
      listingType, 
      state, 
      city, 
      revenue, 
      sde, 
      email,
      userId  // Required for authenticated users
    } = requestBody;

    // Validate required fields
    if (!categoryId || !listingText || !listingType || !state || !city || !email) {
      console.error('[pre-validate-business] ❌ Missing required fields:', {
        categoryId: !!categoryId,
        listingText: !!listingText,
        listingType: !!listingType,
        state: !!state,
        city: !!city,
        email: !!email
      });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // userId is required for authenticated users (dashboard flow)
    if (!userId) {
      console.error('[pre-validate-business] ❌ User ID missing');
      return NextResponse.json({ error: "User ID is required. Please ensure you are logged in." }, { status: 401 });
    }
    
    console.log('[pre-validate-business] ✅ All validations passed');

    // Determine final listing URL (hash for private, provided URL for public)
    let finalListingUrl: string;

    if (listingType === 'public') {
      // User provided a URL - use it directly (already unique)
      if (!listingUrl) {
        return NextResponse.json({ error: "Listing URL is required for public listings" }, { status: 400 });
      }
      finalListingUrl = listingUrl;
    } else {
      // Private listing - generate hash from inputs
      const inputString = [
        categoryId,
        state.trim().toLowerCase(),
        city.trim().toLowerCase(),
        revenue?.trim() || '',
        sde?.trim() || '',
        listingText.trim()
      ].join('|');
      
      const hash = createHash('sha256')
        .update(inputString)
        .digest('hex')
        .substring(0, 16); // First 16 chars is enough
      
      finalListingUrl = `internal://offmarket/${hash}`;
    }

    console.log('[pre-validate-business] Final listing URL:', finalListingUrl);
    console.log('[pre-validate-business] User ID:', userId);

    // Check for existing business by listing URL
    const { data: existingBusinesses, error: findBizError } = await supabaseAdmin
      .from('businesses')
      .select('id, step1_status, step2_status, step3_status, step4_status, step5_status')
      .eq('listing_url', finalListingUrl)
      .order('created_at', { ascending: false })
      .limit(1);

    if (findBizError) {
      console.error('[pre-validate-business] Error checking for business:', findBizError);
      return NextResponse.json({ error: 'Failed to check for business' }, { status: 500 });
    }

    let business_id: string;
    let isExistingBusiness = false;

    if (existingBusinesses && existingBusinesses.length > 0) {
      // Duplicate found - check if user already has access
      business_id = existingBusinesses[0].id;
      isExistingBusiness = true;
      console.log('[pre-validate-business] Found existing business:', business_id);

      // Check if user already has access to this business
      const { data: userBusiness, error: userBizError } = await supabaseAdmin
        .from('user_businesses')
        .select('payment_type, business_id')
        .eq('user_id', userId)
        .eq('business_id', business_id)
        .single();

      if (userBizError && userBizError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('[pre-validate-business] Error checking user access:', userBizError);
        return NextResponse.json({ error: 'Failed to check user access' }, { status: 500 });
      }

      if (userBusiness && userBusiness.payment_type === 'paid') {
        // User already analyzed this exact business
        return NextResponse.json({ 
          error: "You already analyzed this exact business. Please check your dashboard.",
          existingBusinessId: business_id 
        }, { status: 409 });
      }

      // Business exists but user hasn't paid yet, or different user
      // Reuse existing business_id
      console.log('[pre-validate-business] Reusing existing business for user');
    } else {
      // No duplicate - create new business
      // NOTE: Pre-validation creates the business record with business_id
      // Step1 will UPDATE this record (not create it)
      business_id = uuidv4();
      const businessInsert: any = {
        id: business_id,
        business_category_id: categoryId,
        listing_url: finalListingUrl,
        listing_text: listingText, // Contains all data including user inputs in metadata block
        step1_status: 'pending',
        step2_status: 'pending',
        step3_status: 'pending',
        step4_status: 'pending',
        step5_status: 'pending'
      };

      console.log('[pre-validate-business] 📝 Creating new business record:', {
        business_id,
        categoryId,
        listing_url: finalListingUrl,
        listing_text_length: listingText.length
      });

      const { error: bizError } = await supabaseAdmin
        .from('businesses')
        .insert([businessInsert]);

      if (bizError) {
        console.error('[pre-validate-business] ❌ Error inserting business:', bizError);
        return NextResponse.json({ error: 'Failed to create business' }, { status: 500 });
      }
      console.log('[pre-validate-business] ✅ Created new business record:', business_id);
    }

    // Run step1 synchronously (only if not already completed)
    // NOTE: Step1 UPDATES the existing business record (does not create it)
    // Pre-validation already created the business with business_id
    if (!isExistingBusiness || existingBusinesses[0].step1_status !== 'completed') {
      console.log('[pre-validate-business] 🔄 Running step1 data cleaning synchronously...');
      console.log('[pre-validate-business] 📤 Calling step1-data-cleaning with:', {
        businessId: business_id,
        listingTextLength: listingText.length,
        listingTextPreview: listingText.substring(0, 200) + '...'
      });
      
      // Call step1-data-cleaning endpoint synchronously
      // listingText contains: metadata block (user inputs) + actual listing text/PDF content
      const step1Response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/analysis/step1-data-cleaning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business_id, listingText })
      });
      
      console.log('[pre-validate-business] 📥 Step1 response status:', step1Response.status);

      if (!step1Response.ok) {
        const errorData = await step1Response.json();
        console.error('[pre-validate-business] Step1 failed:', errorData);
        
        // Update business status to failed
        await supabaseAdmin
          .from('businesses')
          .update({ step1_status: 'failed' })
          .eq('id', business_id);

        return NextResponse.json({ 
          error: errorData.error || 'Data validation failed. Please check your inputs and try again.' 
        }, { status: 500 });
      }

      const step1Result = await step1Response.json();
      console.log('[pre-validate-business] Step1 completed:', step1Result);
    } else {
      console.log('[pre-validate-business] Step1 already completed, skipping');
    }

    // Verify step1 completed successfully
    const { data: businessCheck, error: checkError } = await supabaseAdmin
      .from('businesses')
      .select('step1_status')
      .eq('id', business_id)
      .single();

    if (checkError || !businessCheck) {
      console.error('[pre-validate-business] Error verifying business:', checkError);
      return NextResponse.json({ error: 'Failed to verify business status' }, { status: 500 });
    }

    if (businessCheck.step1_status !== 'completed') {
      return NextResponse.json({ 
        error: 'Data validation did not complete successfully. Please try again.' 
      }, { status: 500 });
    }

    // Create or update user_businesses record with user_id + business_id set
    // Uses same conflict key as create-temp-account: 'user_id,listing_url'
    const { error: upsertError } = await supabaseAdmin
      .from('user_businesses')
      .upsert({
        user_id: userId, // Required - authenticated user
        user_email: email.toLowerCase(),
        business_id: business_id, // Set immediately (not null)
        listing_url: finalListingUrl,
        business_category_id: categoryId,
        payment_type: 'pending', // Will be updated to 'paid' by webhook after payment
        amount_paid: 49,
        polar_checkout_id: null, // Will be updated by webhook after payment
        polar_order_id: null,
        paid_at: null,
        analysis_complete: false,
        pdf_requested: false,
        status: 'pending_payment',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,listing_url', // Same conflict key as create-temp-account
        ignoreDuplicates: false // Update existing record if found
      });

    if (upsertError) {
      console.error('[pre-validate-business] Error creating user_businesses record:', upsertError);
      return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
    }

    console.log('[pre-validate-business] Successfully pre-validated business:', business_id);
    console.log('[pre-validate-business] User_businesses record created/updated with user_id and business_id');

    return NextResponse.json({ 
      business_id,
      success: true,
      listingUrl: finalListingUrl
    });

  } catch (error) {
    console.error('[pre-validate-business] Unexpected error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

