import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email, businessData } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate business data
    if (!businessData?.categoryId || !businessData?.listingUrl || !businessData?.listingText) {
      return NextResponse.json({ error: 'Business data is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();
    console.log('Creating temp account for:', normalizedEmail);
    console.log('Business data:', { categoryId: businessData.categoryId, listingUrl: businessData.listingUrl });

    // Check if user already exists
    const { data: { users }, error: listError } = await supabaseAdmin!.auth.admin.listUsers();

    if (!listError) {
      const existingUser = users.find(u => u.email?.toLowerCase() === normalizedEmail);
      
      if (existingUser) {
        console.log('⚠️ User already exists, creating pending record only:', existingUser.id);
        
        // Just create the pending user_businesses record for existing user
        const { error: upsertError } = await supabaseAdmin!
          .from('user_businesses')
          .upsert({
            user_id: existingUser.id,
            business_id: null,
            user_email: normalizedEmail,
            listing_url: businessData.listingUrl,
            business_category_id: businessData.categoryId,
            payment_type: 'pending',
            amount_paid: 49,
            polar_checkout_id: null,
            polar_order_id: null,
            paid_at: null,
            analysis_complete: false,
            pdf_requested: false,
            status: 'pending_payment',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,listing_url',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error('Error upserting user_businesses record:', upsertError);
          return NextResponse.json({ error: 'Failed to create user business record' }, { status: 500 });
        }

        console.log('✅ Pending record created for existing user');
        return NextResponse.json({
          user_id: existingUser.id,
          success: true,
          existingUser: true
        });
      }
    }

    // Generate random 32-char password (same as PaywallModal)
    const randomPassword = randomBytes(16).toString('hex');

    // Create account with auth.signUp() (same as PaywallModal) - this automatically sends confirmation email
    const { data: authData, error: authError } = await supabaseAdmin!.auth.signUp({
      email: normalizedEmail,
      password: randomPassword,
      options: {
        data: {
          isAutoPassword: true,
          signupPath: 'payment',
          createdAt: new Date().toISOString(),
          isTempAccount: true
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
      }
    });

    if (authError) {
      console.error('Error creating temp account:', authError);
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'No user data returned' }, { status: 500 });
    }

    console.log('✅ Temp account created:', authData.user.id);
    console.log('✅ Confirmation email sent automatically');

    // Create or update user_businesses record with all form data (upsert to prevent duplicates)
    const { error: upsertError } = await supabaseAdmin!
      .from('user_businesses')
      .upsert({
        user_id: authData.user.id,
        business_id: null, // Will be set when analysis runs
        user_email: normalizedEmail,
        listing_url: businessData.listingUrl,
        business_category_id: businessData.categoryId,
        payment_type: 'pending', // Will be updated to 'paid' after payment
        amount_paid: 49, // Will be updated after payment
        polar_checkout_id: null, // Will be updated after payment
        polar_order_id: null,
        paid_at: null,
        analysis_complete: false,
        pdf_requested: false,
        status: 'pending_payment', // Status tracking
        updated_at: new Date().toISOString() // Update timestamp
      }, {
        onConflict: 'user_id,listing_url', // Prevent duplicates based on user + listing
        ignoreDuplicates: false // Update existing record if found
      });

    if (upsertError) {
      console.error('Error upserting user_businesses record:', upsertError);
      return NextResponse.json({ error: 'Failed to create user business record' }, { status: 500 });
    }

    console.log('✅ User_businesses record created/updated with form data');

    // Return user_id only (no session tokens - user remains unverified)
    return NextResponse.json({
      user_id: authData.user.id,
      success: true
    });

  } catch (error) {
    console.error('Temp account creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
