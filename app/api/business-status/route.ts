import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('id');
  if (!businessId) {
    return NextResponse.json({ error: 'Missing businessId' }, { status: 400 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client not configured.' }, { status: 500 });
  }
  const { data, error } = await supabaseAdmin
    .from('businesses')
    .select('step1_status, step2_status, step3_status, step4_status, step5_status')
    .eq('id', businessId)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
  }
  return NextResponse.json({ 
    step1_status: data.step1_status,
    step2_status: data.step2_status,
    step3_status: data.step3_status,
    step4_status: data.step4_status,
    step5_status: data.step5_status
  });
} 