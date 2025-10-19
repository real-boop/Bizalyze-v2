import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { businessId, step } = await request.json();
    
    if (!businessId || !step) {
      return NextResponse.json({ error: 'Missing businessId or step' }, { status: 400 });
    }

    // Reset failed step to pending
    const statusField = `step${step}_status`;
    await supabaseAdmin
      .from('businesses')
      .update({ [statusField]: 'pending' })
      .eq('id', businessId);

    // Trigger appropriate step endpoint
    const stepRoutes = {
      '2': '/api/analysis/step2-location-data',
      '3': '/api/analysis/step3-4-location-business-analysis',
      '4': '/api/analysis/step3-4-location-business-analysis',
      '5': '/api/analysis/step5-synthesis'
    };

    const routeUrl = stepRoutes[step as keyof typeof stepRoutes];
    if (routeUrl) {
      // Trigger step in background
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL}${routeUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId })
      }).catch(console.error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Retry failed' }, { status: 500 });
  }
} 