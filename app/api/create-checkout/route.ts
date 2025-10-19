import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { analysisId, customerEmail, businessData, successUrl } = await request.json();
    
    if (!analysisId || !customerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log('Creating checkout for analysis:', analysisId);

    // Create checkout session with Polar (SANDBOX URL)
    const response = await fetch('https://sandbox-api.polar.sh/v1/checkouts/', {  // ← Fixed: removed /custom
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: process.env.POLAR_PRODUCT_ID,
        customer_email: customerEmail,
        success_url: successUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/start?payment_success=true&token={CHECKOUT_ID}`,
        embed_origin: process.env.NEXT_PUBLIC_BASE_URL, // Allow iframe messages back to parent window
        require_billing_address: false,  // This won't help for US customers
        metadata: {
          analysisId,
          customerEmail,
          categoryId: businessData.categoryId,
          listingUrl: businessData.listingUrl,
          created_at: new Date().toISOString()
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Polar API error:', errorText);
      throw new Error(`Polar API error: ${response.status}`);
    }

    const checkout = await response.json();
    console.log('Checkout session created:', checkout.id);
    
    return NextResponse.json({ 
      checkoutUrl: checkout.url,
      checkoutId: checkout.id 
    });
    
  } catch (error) {
    console.error('Checkout creation error:', error);
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}
