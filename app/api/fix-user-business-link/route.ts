import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { userId, businessId } = await request.json()
    
    if (!userId || !businessId) {
      return NextResponse.json({ 
        error: 'userId and businessId are required' 
      }, { status: 400 })
    }

    // Check if relationship already exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('user_businesses')
      .select('id')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .single()

    if (existing) {
      return NextResponse.json({ 
        success: true,
        message: 'Relationship already exists',
        relationshipId: existing.id
      })
    }

    // Create the relationship
    const { data: newRelationship, error: insertError } = await supabaseAdmin
      .from('user_businesses')
      .insert({
        user_id: userId,
        business_id: businessId
      })
      .select('id')
      .single()

    if (insertError) {
      logger.error('[fix-user-business-link] Failed to create relationship:', insertError)
      return NextResponse.json({ 
        error: 'Failed to create user-business relationship',
        details: insertError.message
      }, { status: 500 })
    }

    logger.info('[fix-user-business-link] Successfully created relationship:', {
      userId,
      businessId,
      relationshipId: newRelationship.id
    })

    return NextResponse.json({
      success: true,
      message: 'User-business relationship created successfully',
      relationshipId: newRelationship.id
    })

  } catch (error) {
    logger.error('[fix-user-business-link] Unexpected error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
