import { Webhooks } from "@polar-sh/nextjs";
import { supabaseAdmin } from "@/lib/supabase";
import { randomBytes } from 'crypto';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

// Helper function to process payment with retry logic
async function processPaymentWithRetry({
  checkoutData,
  checkoutId,
  metadata,
  customerEmail
}: {
  checkoutData: any;
  checkoutId: string;
  metadata: any;
  customerEmail: string;
}) {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`🔄 Processing payment attempt ${attempt + 1}/${MAX_RETRIES}`);
      
      // Check if already processed (idempotent)
      const { data: existingRecord } = await supabaseAdmin!!
        .from('user_businesses')
        .select('id, amount_paid')
        .eq('polar_checkout_id', checkoutId)
        .single();

      if (existingRecord) {
        // Always update the amount, even if record exists
        const orderAmount = checkoutData?.totalAmount ? checkoutData.totalAmount / 100 : 49;
        
        if (existingRecord.amount_paid !== orderAmount) {
          console.log('🔄 Updating amount for existing record:', { 
            current: existingRecord.amount_paid, 
            new: orderAmount 
          });
          
          const { error: updateError } = await supabaseAdmin!!
            .from('user_businesses')
            .update({ amount_paid: orderAmount })
            .eq('polar_checkout_id', checkoutId);
            
          if (updateError) {
            console.error('❌ Failed to update amount:', updateError);
          } else {
            console.log('✅ Amount updated successfully');
          }
        } else {
          console.log('✅ Amount already correct, no update needed');
        }
        
        console.log('✅ Checkout already processed, amount verified/updated');
        return { success: true, retries: attempt };
      }

      // Process new payment (record doesn't exist yet)
      const orderId = checkoutData?.order_id || null;
      const orderAmount = checkoutData?.totalAmount ? checkoutData.totalAmount / 100 : 49;
      
      console.log('🎉 Payment succeeded for:', customerEmail);
      console.log('Metadata:', metadata);
      
      // Update existing user_businesses record with payment info
      const { data: updateData, error: updateError } = await supabaseAdmin!!
        .from('user_businesses')
        .update({
          payment_type: 'paid',
          amount_paid: orderAmount,
          polar_checkout_id: checkoutId,
          polar_order_id: orderId,
          paid_at: new Date().toISOString(),
          status: 'payment_complete'
        })
        .eq('user_email', customerEmail)
        .eq('listing_url', metadata.listingUrl)
        .eq('payment_type', 'pending')
        .select();

      if (updateError) {
        throw new Error(`Error updating payment info: ${updateError.message}`);
      }

      if (!updateData || updateData.length === 0) {
        console.error('⚠️ No pending record found to update. Email:', customerEmail, 'URL:', metadata.listingUrl);
        throw new Error(`No pending user_businesses record found for email: ${customerEmail}`);
      }
      
      console.log('✅ Payment info updated successfully for', updateData.length, 'record(s)');
      
      console.log(`✅ Payment processed successfully on attempt ${attempt + 1}`);
      return { success: true, retries: attempt };
      
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ Attempt ${attempt + 1} failed:`, error);
      
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}


export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onCheckoutUpdated: async (checkout) => {
    const startTime = Date.now();
    
    try {
      console.log('Checkout updated - Full payload:', JSON.stringify(checkout, null, 2));
      console.log('Checkout status:', checkout.data?.status);
      
      if (checkout.data?.status === 'succeeded') {
        // Check if already processed (idempotent)
        const checkoutId = checkout.data?.id;
        if (!checkoutId) {
          console.log('❌ Missing checkout ID');
          return;
        }
        
        // Process payment with retry logic
        const customerEmail = checkout.data?.customerEmail?.toLowerCase();
        if (!customerEmail) {
          console.log('❌ Missing customer email');
          return;
        }
        
        const result = await processPaymentWithRetry({
          checkoutData: checkout.data,
          checkoutId,
          metadata: checkout.data?.metadata,
          customerEmail
        });
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ Webhook processed in ${processingTime}ms with ${result.retries} retries`);
      } else {
        console.log('Checkout status is not succeeded:', checkout.data?.status);
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Webhook failed after ${processingTime}ms:`, error);
    }
  },
  onOrderCreated: async (order) => {
    console.log('Order created:', order.data?.id);
  }
});
