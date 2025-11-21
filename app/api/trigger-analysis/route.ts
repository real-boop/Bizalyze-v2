import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { v4 as uuidv4 } from 'uuid';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 });
  }
  try {
    const { categoryId, listingUrl, listingText, businessId, checkoutId, userId, email, state, city } = await request.json();
    
    // Handle dashboard retry OR pre-validated business (businessId provided)
    if (businessId) {
      const { data: existingBusiness, error: findError } = await supabaseAdmin
        .from('businesses')
        .select('id, listing_url, listing_text, business_category_id, step1_status, step2_status, step3_status, step4_status, step5_status')
        .eq('id', businessId)
        .single();
      
      if (findError || !existingBusiness) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 });
      }
      
      // Check if this is a pre-validated business (step1 already completed)
      const isPreValidated = existingBusiness.step1_status === 'completed';
      
      // Link user_businesses record if payment info provided (for pre-validated businesses)
      if (isPreValidated && (checkoutId || email)) {
        console.log('[Analysis] Pre-validated business detected, linking payment...');
        
        if (checkoutId && checkoutId.startsWith('disabled-payment-')) {
          // Payment bypass: update by business_id + email
          console.log('[Analysis] Payment bypass detected, updating by business_id + email');
          
          const { data: updateData, error } = await supabaseAdmin
            .from('user_businesses')
            .update({ 
              status: 'analysis_running',
              payment_type: 'paid',
              polar_checkout_id: checkoutId
            })
            .eq('business_id', businessId)
            .eq('user_email', email.toLowerCase())
            .select();
          
          if (error) {
            console.error('[Analysis] Error updating bypass payment:', error);
          } else if (updateData && updateData.length > 0) {
            console.log('[Analysis] ✅ Updated bypass payment:', updateData);
          } else {
            console.log('[Analysis] ⚠️ No record found for bypass payment');
          }
        } else if (checkoutId) {
          // Normal payment: Try by business_id + polar_checkout_id first (webhook already ran)
          console.log('[Analysis] Normal payment detected, attempting to update status...');
          
          let updateData = null;
          let updateError = null;
          
          const { data: data1, error: error1 } = await supabaseAdmin
            .from('user_businesses')
            .update({ status: 'analysis_running' })
            .eq('business_id', businessId)
            .eq('polar_checkout_id', checkoutId)
            .select();
          
          updateData = data1;
          updateError = error1;
          
          // Fallback: If webhook hasn't run yet, update by business_id + email
          // (We'll set polar_checkout_id ourselves, but webhook will overwrite it later - that's fine)
          if (!updateData || updateData.length === 0) {
            console.log('[Analysis] ⚠️ Webhook not processed yet, updating by business_id + email');
            
            const { data: data2, error: error2 } = await supabaseAdmin
              .from('user_businesses')
              .update({ 
                status: 'analysis_running',
                polar_checkout_id: checkoutId  // Set it ourselves (webhook will verify later)
              })
              .eq('business_id', businessId)
              .eq('user_email', email.toLowerCase())
              .eq('payment_type', 'pending')  // Only update if still pending
              .select();
            
            updateData = data2;
            updateError = error2;
          }
          
          if (updateError) {
            console.error('[Analysis] Error updating status:', updateError);
          } else if (updateData && updateData.length > 0) {
            console.log('[Analysis] ✅ Updated status:', updateData);
          } else {
            console.log('[Analysis] ⚠️ No record found');
          }
        } else if (email) {
          // No checkoutId, link by business_id + email
          console.log('[Analysis] No checkoutId, updating by business_id + email');
          
          const { data: updateData, error: linkError } = await supabaseAdmin
            .from('user_businesses')
            .update({ 
              status: 'analysis_running'
            })
            .eq('business_id', businessId)
            .eq('user_email', email.toLowerCase())
            .select();
          
          if (linkError) {
            console.error('[Analysis] Error updating by email:', linkError);
          } else if (updateData && updateData.length > 0) {
            console.log('[Analysis] ✅ Updated by email:', updateData);
          } else {
            console.log('[Analysis] ⚠️ No record found');
          }
        }
      }
      
      // Use existing business data for retry logic
      const statuses = existingBusiness as Record<string, string>;
      const allComplete = ['step1_status', 'step2_status', 'step3_status', 'step4_status', 'step5_status']
        .every(step => statuses[step] === 'completed');
        
      if (allComplete) {
        return NextResponse.json({ business_id: businessId, status: 'completed', redirect: true });
      }
      
      // Reset failed steps and trigger pipeline
      const updates: Record<string, string> = {};
      (['step1_status', 'step2_status', 'step3_status', 'step4_status', 'step5_status'] as const).forEach((step) => {
        if (statuses[step] === 'failed') {
          updates[step] = 'pending';
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from('businesses').update(updates).eq('id', businessId);
      }
      
      // Trigger appropriate step
      // For pre-validated businesses: skip step1, start at step2
      const firstIncomplete = (['step1_status', 'step2_status', 'step3_status', 'step4_status', 'step5_status'] as const)
        .find((step) => statuses[step] !== 'completed');

      if (firstIncomplete === 'step1_status' && !isPreValidated) {
        // Only trigger step1 if NOT pre-validated (retry case)
        console.log('[Analysis] Triggering step1 (retry case)');
        fetch(`${baseUrl}/api/analysis/step1-data-cleaning`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId, listingText: existingBusiness.listing_text })
        }).then(response => {
          console.log('[Analysis] Step1 triggered (retry), status:', response.status);
        }).catch(error => {
          console.error('[Analysis] Step1 trigger failed:', error);
        });
      } else if (firstIncomplete === 'step2_status') {
        // Trigger step2 (first time for pre-validated, or retry)
        console.log('[Analysis] Triggering step2 (pre-validated or retry)');
        fetch(`${baseUrl}/api/analysis/step2-location-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId })
        }).catch(console.error);
      } else if (firstIncomplete === 'step3_status' || firstIncomplete === 'step4_status') {
        fetch(`${baseUrl}/api/analysis/step3-4-location-business-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId })
        }).catch(console.error);
      } else if (firstIncomplete === 'step5_status') {
        fetch(`${baseUrl}/api/analysis/step5-synthesis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId })
        }).catch(console.error);
      }
      
      return NextResponse.json({ business_id: businessId, status: 'processing' });
    }
   
    // Original form submission logic
    // listingUrl is optional for private listings (virtual URLs start with internal://offmarket)
    if (!categoryId || !listingText) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // For private listings, listingUrl might be a virtual URL - that's fine
    // For public listings, listingUrl should be provided
    const isVirtualUrl = listingUrl && listingUrl.startsWith('internal://offmarket');
    if (!isVirtualUrl && !listingUrl) {
      return NextResponse.json({ error: "Listing URL is required for public listings" }, { status: 400 });
    }

    // 1. Check for existing business by listing URL
    const { data: existingBusinesses, error: findBizError } = await supabaseAdmin
      .from('businesses')
      .select('id, step1_status, step2_status, step3_status, step4_status, step5_status')
      .eq('listing_url', listingUrl)
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (findBizError) {
      console.error('[Analysis] Error checking for business:', findBizError);
      return NextResponse.json({ error: 'Failed to check for business' }, { status: 500 });
    }

    let business_id: string;
    
    if (existingBusinesses && existingBusinesses.length > 0) {
      business_id = existingBusinesses[0].id;
      console.log('[Analysis] Found existing business:', business_id);
      
       // ALWAYS link paid analysis if checkoutId provided (regardless of completion status)
       if (checkoutId) {
         console.log('[Analysis] Attempting to link checkoutId:', checkoutId, 'to business_id:', business_id);
         
         // TIER 1: Try linking by polar_checkout_id first (normal case)
         const { data: updateData, error: linkError } = await supabaseAdmin
           .from('user_businesses')
           .update({ 
             business_id: business_id,
             status: 'analysis_running'
           })
           .eq('polar_checkout_id', checkoutId)
           .select();
           
         console.log('[Analysis] Update result:', updateData);
         
         if (updateData && updateData.length > 0) {
           console.log('[Analysis] Linked payment record to business:', business_id);
         } else {
           // TIER 2: Fallback for race condition - link by email + listing_url
           console.log('[Analysis] ⚠️ No records found by polar_checkout_id, attempting fallback...');
           
           const { data: fallbackData, error: fallbackError } = await supabaseAdmin
             .from('user_businesses')
             .update({ 
               business_id: business_id,
               status: 'analysis_running'
             })
             .eq('user_email', email.toLowerCase())
             .eq('listing_url', listingUrl)
             .is('business_id', null)
             .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour only
             .select();
           
           if (fallbackData && fallbackData.length > 0) {
             console.log('[Analysis] ✅ RECOVERED: Linked', fallbackData.length, 'orphaned record(s) via fallback');
           } else {
             console.log('[Analysis] ❌ Fallback found no matching records');
             console.log('[Analysis] 🔍 Searched for: email=', email, 'listing_url=', listingUrl, 'business_id=null, created in last hour');
           }
         }
       } else if (email && listingUrl) {
         // FALLBACK: Update by email + listing_url when no checkoutId
         console.log('[Analysis] No checkoutId, attempting to link by email + listing_url:', email, listingUrl);
         
         const { data: updateData, error: linkError } = await supabaseAdmin
           .from('user_businesses')
           .update({ 
             business_id: business_id,
             business_category_id: categoryId,
             status: 'analysis_running'
           })
           .eq('user_email', email.toLowerCase())
           .eq('listing_url', listingUrl)
           .is('business_id', null)
           .select();
           
         if (linkError) {
           console.error('[Analysis] Error linking by email:', linkError);
         } else if (updateData && updateData.length > 0) {
           console.log('[Analysis] Successfully linked by email/url:', updateData);
         } else {
           console.log('[Analysis] No matching record found to update');
         }
       } else {
         console.log('[Analysis] No checkoutId or email provided, skipping linking');
       }
      
      // Check if all steps are completed
      const statuses = existingBusinesses[0] as Record<string, string>;
      const allComplete = ['step1_status', 'step2_status', 'step3_status', 'step4_status', 'step5_status']
        .every(step => statuses[step] === 'completed');
        
      if (allComplete) {
        console.log('[Analysis] All steps complete, redirecting immediately');
        
        // Manually update analysis_complete and status for paid analyses
        if (checkoutId) {
          const { error: updateError } = await supabaseAdmin
            .from('user_businesses')
            .update({ 
              analysis_complete: true,
              status: 'analysis_complete'
            })
            .eq('polar_checkout_id', checkoutId);
            
          if (updateError) {
            console.error('[Analysis] Error updating analysis_complete:', updateError);
          } else {
            console.log('[Analysis] Updated analysis_complete to true for paid analysis');
          }
        } else if (email && listingUrl) {
          // FALLBACK: Update by email + listing_url
          const { error: updateError } = await supabaseAdmin
            .from('user_businesses')
            .update({ 
              analysis_complete: true,
              status: 'analysis_complete'
            })
            .eq('user_email', email.toLowerCase())
            .eq('listing_url', listingUrl);
            
          if (updateError) {
            console.error('[Analysis] Error updating analysis_complete by email:', updateError);
          } else {
            console.log('[Analysis] Updated analysis_complete to true by email/url');
          }
        }
        
        return NextResponse.json({ business_id, status: 'completed', redirect: true });
      }
      
      // Reset any failed steps to pending for retry
      const updates: Record<string, string> = {};
      (['step1_status', 'step2_status', 'step3_status', 'step4_status', 'step5_status'] as const).forEach((step) => {
        if (statuses[step] === 'failed') {
          updates[step] = 'pending';
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin
          .from('businesses')
          .update(updates)
          .eq('id', business_id);
        console.log('[Analysis] Reset failed steps:', updates);
      }
      
      // Determine where to resume pipeline
      const firstIncomplete = (['step1_status', 'step2_status', 'step3_status', 'step4_status', 'step5_status'] as const)
        .find((step) => statuses[step] !== 'completed');

      // Trigger the appropriate step
      if (firstIncomplete === 'step1_status') {
        const step1Url = `${baseUrl}/api/analysis/step1-data-cleaning`;
        console.log('[Analysis] 🔍 DEBUG: About to trigger step1', {
          url: step1Url,
          baseUrl: baseUrl,
          envBaseUrl: process.env.NEXT_PUBLIC_BASE_URL,
          businessId: business_id,
          hasListingText: !!listingText,
          listingTextLength: listingText?.length,
          listingTextPreview: listingText?.substring(0, 100)
        });
        
        try {
          const fetchResponse = await fetch(step1Url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessId: business_id, listingText })
          });
          
          console.log('[Analysis] Step1 triggered, status:', fetchResponse.status, fetchResponse.statusText);
          
          if (!fetchResponse.ok) {
            const errorText = await fetchResponse.text();
            console.error('[Analysis] ❌ Step1 error response:', {
              status: fetchResponse.status,
              statusText: fetchResponse.statusText,
              error: errorText,
              url: step1Url
            });
          } else {
            const responseData = await fetchResponse.json();
            console.log('[Analysis] ✅ Step1 success:', responseData);
          }
        } catch (error: any) {
          console.error('[Analysis] ❌ Step1 fetch failed completely:', {
            error: error?.message,
            stack: error?.stack,
            name: error?.name,
            url: step1Url,
            baseUrl: baseUrl
          });
        }
      } else if (firstIncomplete === 'step2_status') {
        fetch(`${baseUrl}/api/analysis/step2-location-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId: business_id })
        }).catch(console.error);
      } else if (firstIncomplete === 'step3_status' || firstIncomplete === 'step4_status') {
        fetch(`${baseUrl}/api/analysis/step3-4-location-business-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId: business_id })
        }).catch(console.error);
      } else if (firstIncomplete === 'step5_status') {
        fetch(`${baseUrl}/api/analysis/step5-synthesis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId: business_id })
        }).catch(console.error);
      }
    } else {
      // Create new business
      business_id = uuidv4();
      const businessInsert: any = {
        id: business_id,
        business_category_id: categoryId,
        listing_url: listingUrl,
        listing_text: listingText,  // Contains all data including user inputs in metadata block
        step1_status: 'pending',
        step2_status: 'pending',
        step3_status: 'pending',
        step4_status: 'pending',
        step5_status: 'pending'
      };
      
      // DO NOT save city/state directly - step1-data-cleaning will extract from listing_text
      const { error: bizError } = await supabaseAdmin
        .from('businesses')
        .insert([businessInsert]);
        
      if (bizError) {
        console.error('[Analysis] Error inserting business:', bizError);
        return NextResponse.json({ error: 'Failed to create business' }, { status: 500 });
      }
      console.log('[Analysis] Created new business:', business_id);
      
       // Link paid analysis if checkoutId provided
       if (checkoutId) {
         console.log('[Analysis] Attempting to link checkoutId:', checkoutId, 'to business_id:', business_id);
         
         const { data: updateData, error: linkError } = await supabaseAdmin
           .from('user_businesses')
           .update({ 
             business_id: business_id,
             business_category_id: categoryId,
             status: 'analysis_running'
           })
           .eq('polar_checkout_id', checkoutId)
           .select();
           
         if (linkError) {
           console.error('[Analysis] Error linking payment records:', linkError);
         } else {
           console.log('[Analysis] Update result:', updateData);
           console.log('[Analysis] Successfully linked payment record to business:', business_id);
         }
       } else if (email && listingUrl) {
         // FALLBACK: Update by email + listing_url when no checkoutId
         console.log('[Analysis] No checkoutId, attempting to link by email + listing_url:', email, listingUrl);
         
         const { data: updateData, error: linkError } = await supabaseAdmin
           .from('user_businesses')
           .update({ 
             business_id: business_id,
             status: 'analysis_running'
           })
           .eq('user_email', email.toLowerCase())
           .eq('listing_url', listingUrl)
           .is('business_id', null)
           .select();
           
         if (linkError) {
           console.error('[Analysis] Error linking by email:', linkError);
         } else if (updateData && updateData.length > 0) {
           console.log('[Analysis] Successfully linked by email/url:', updateData);
         } else {
           console.log('[Analysis] No matching record found to update');
         }
       } else {
         console.log('[Analysis] No checkoutId or email provided, skipping linking');
       }
      
      // Start pipeline with step 1
      fetch(`${baseUrl}/api/analysis/step1-data-cleaning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business_id, listingText })
      }).then(response => {
        console.log('[Analysis] Step1 triggered, status:', response.status);
      }).catch(error => {
        console.error('[Analysis] Step1 trigger failed:', error);
      });
    }

    return NextResponse.json({ business_id, status: 'processing' });
    
  } catch (error) {
    console.error('[Analysis] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
