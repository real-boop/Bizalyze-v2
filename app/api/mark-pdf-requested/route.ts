import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 });
  }

  try {
    const { email, businessId } = await request.json();
    
    if (!email || !businessId) {
      return NextResponse.json({ error: "Email and businessId are required" }, { status: 400 });
    }

    // Update pdf_requested flag to true
    const { error: updateError } = await supabaseAdmin
      .from('user_businesses')
      .update({ pdf_requested: true })
      .eq('user_email', email)
      .eq('business_id', businessId);
    
    if (updateError) {
      console.error('[Mark PDF Requested] Error updating record:', updateError);
      return NextResponse.json({ error: 'Failed to mark PDF as requested' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Mark PDF Requested] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
