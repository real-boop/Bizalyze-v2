import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client not configured.' }, { status: 500 });
  }
  const { data, error } = await supabaseAdmin
    .from('business_categories')
    .select('id, display_name')
    .order('display_name', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ categories: data }, { status: 200 });
} 