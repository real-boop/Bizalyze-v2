import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    // Extract the JWT token
    const token = authHeader.split(' ')[1]
    
    // Verify the JWT token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // First, get user_businesses for this user
    const { data: userBusinesses, error: userBusinessesError } = await supabase
      .from('user_businesses')
      .select('business_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (userBusinessesError) {
      console.error('[user-businesses] Error fetching user_businesses:', userBusinessesError)
      return NextResponse.json({ error: 'Failed to fetch user businesses' }, { status: 500 })
    }

    if (!userBusinesses || userBusinesses.length === 0) {
      return NextResponse.json({ 
        businesses: [],
        count: 0
      })
    }

    // Extract business IDs, filtering out null values
    const businessIds = userBusinesses
      .map(ub => ub.business_id)
      .filter(id => id !== null && id !== undefined)

    // If no valid business IDs, return empty result
    if (businessIds.length === 0) {
      return NextResponse.json({ 
        businesses: [],
        count: 0
      })
    }

    // Then, get the businesses data
    const { data: businesses, error: businessesError } = await supabase
      .from('businesses')
      .select(`
        id,
        name,
        city,
        state,
        county,
        zip,
        listing_url,
        url,
        created_at,
        step1_status,
        step2_status,
        step3_status,
        step4_status,
        step5_status,
        business_category_id,
        listing_structured
      `)
      .in('id', businessIds)

    if (businessesError) {
      console.error('[user-businesses] Error fetching businesses:', businessesError)
      return NextResponse.json({ error: 'Failed to fetch businesses' }, { status: 500 })
    }

    // Get business categories
    const categoryIds = [...new Set(businesses?.map(b => b.business_category_id).filter(Boolean) || [])]
    let categories: any[] = []
    
    if (categoryIds.length > 0) {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('business_categories')
        .select('id, display_name')
        .in('id', categoryIds)
      
      if (!categoriesError) {
        categories = categoriesData || []
      }
    }

    // Create a map of categories for quick lookup
    const categoryMap = new Map(categories.map(cat => [cat.id, cat.display_name]))

    // Transform the data to a cleaner format
    const transformedBusinesses = (businesses || []).map(business => {
      const userBusiness = userBusinesses.find(ub => ub.business_id === business.id)
      
      // Extract price from listing_structured
      let askingPrice = 'N/A'
      if (business.listing_structured && business.listing_structured.business_metrics) {
        const price = business.listing_structured.business_metrics.asking_price
        if (price) {
          // Format price with commas
          askingPrice = `$${parseInt(price).toLocaleString()}`
        }
      }
      
      return {
        id: business.id,
        name: business.name || 'Unknown Business',
        city: business.city || '',
        state: business.state || '',
        county: business.county || '',
        zip: business.zip || '',
        listing_url: business.listing_url || '',
        url: business.url || '',
        category: categoryMap.get(business.business_category_id) || 'Unknown Category',
        created_at: business.created_at,
        analysis_completed_at: userBusiness?.created_at,
        asking_price: askingPrice,
        // Check if analysis is complete
        analysis_status: getAnalysisStatus(business),
        // Business location for display
        location: formatLocation(business.city, business.state, business.county)
      }
    })

    return NextResponse.json({ 
      businesses: transformedBusinesses,
      count: transformedBusinesses.length
    })

  } catch (error) {
    console.error('[user-businesses] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to determine analysis status
function getAnalysisStatus(business: any): 'complete' | 'processing' | 'failed' | 'pending' {
  if (!business) return 'pending'
  
  const statuses = [
    business.step1_status,
    business.step2_status,
    business.step3_status,
    business.step4_status,
    business.step5_status
  ]
  
  // If all steps are complete
  if (statuses.every(status => status === 'completed')) {
    return 'complete'
  }
  
  // If any step failed
  if (statuses.some(status => status === 'failed')) {
    return 'failed'
  }
  
  // If any step is processing
  if (statuses.some(status => status === 'processing' || status === 'running')) {
    return 'processing'
  }
  
  return 'pending'
}

// Helper function to format location
function formatLocation(city?: string, state?: string, county?: string): string {
  const parts = []
  if (city) parts.push(city)
  if (county && county !== city) parts.push(county)
  if (state) parts.push(state)
  return parts.join(', ') || 'Location not specified'
}