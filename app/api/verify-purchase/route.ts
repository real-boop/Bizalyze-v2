import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { checkoutId, businessId } = await request.json();
    
    if (!checkoutId || !businessId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log('🔍 [API] verify-purchase called:', { checkoutId, businessId });

    if (!supabaseAdmin) {
      console.error('❌ [API] supabaseAdmin not available');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Server-side query with admin bypass (no RLS issues)
    const { data: purchase, error } = await supabaseAdmin
      .from('user_businesses')
      .select('paid_at, user_email, payment_type, polar_checkout_id')
      .eq('polar_checkout_id', checkoutId)
      .eq('business_id', businessId)
      .eq('payment_type', 'paid')
      .maybeSingle();

    console.log('🔍 [API] Database query result:', { 
      purchase: !!purchase, 
      error,
      hasData: !!purchase 
    });

    if (error) {
      console.error('❌ [API] Database error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!purchase) {
      console.log('🔍 [API] No purchase found for checkout_id');
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    // Calculate grace period server-side
    const paidAt = new Date(purchase.paid_at);
    const elapsed = Date.now() - paidAt.getTime();
    const remaining = (60 * 60 * 1000) - elapsed; // 1 hour in milliseconds

    console.log('⏱️ [API] Grace period calculation:', {
      paidAt: paidAt.toISOString(),
      elapsedMs: elapsed,
      remainingMs: remaining,
      remainingMinutes: Math.floor(remaining / 60000)
    });

    const result = {
      email: purchase.user_email,
      secondsRemaining: remaining > 0 ? Math.floor(remaining / 1000) : 0,
      isExpired: remaining <= 0,
      paidAt: purchase.paid_at
    };

    console.log('✅ [API] Returning result:', result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ [API] verify-purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
