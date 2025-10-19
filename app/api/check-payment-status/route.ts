import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const checkoutId = request.nextUrl.searchParams.get('checkoutId');
  
  if (!checkoutId) {
    return NextResponse.json({ error: 'Missing checkoutId' }, { status: 400 });
  }

  try {
    // Check if payment has been processed for this checkout
    const { data, error } = await supabaseAdmin
      .from('user_businesses')
      .select('payment_type, polar_checkout_id, status')
      .eq('polar_checkout_id', checkoutId)
      .single();

    if (error) {
      // If no record found, payment not yet processed
      return NextResponse.json({ 
        paid: false,
        status: 'pending' 
      });
    }

    // Check if payment_type is 'paid'
    const isPaid = data?.payment_type === 'paid';

    return NextResponse.json({ 
      paid: isPaid,
      status: data?.status || 'unknown'
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    return NextResponse.json({ 
      paid: false,
      status: 'error' 
    }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { checkoutId, email, action } = await request.json();
    
    if (action === 'update_payment_status' && checkoutId && email) {
      console.log('🔄 [FRONTEND] Updating payment status immediately:', { checkoutId, email });
      
      // Update database immediately
      const { data: updateData, error: updateError } = await supabaseAdmin
        .from('user_businesses')
        .update({
          payment_type: 'paid',
          polar_checkout_id: checkoutId,
          status: 'payment_complete',
          paid_at: new Date().toISOString()
        })
        .eq('user_email', email.toLowerCase())
        .eq('payment_type', 'pending')
        .select();

      if (updateError) {
        console.error('❌ [FRONTEND] Database update failed:', updateError);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      if (updateData && updateData.length > 0) {
        console.log('✅ [FRONTEND] Database updated immediately for', updateData.length, 'record(s)');
        return NextResponse.json({ success: true, updated: updateData.length });
      } else {
        console.log('⚠️ [FRONTEND] No pending records found to update');
        return NextResponse.json({ success: false, message: 'No pending records found' });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('❌ [FRONTEND] Update payment status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

