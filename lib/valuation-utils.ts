import { supabase } from '@/lib/supabase'

export interface ValuationCategory {
  id: number
  title: string
}

export async function fetchValuationCategories(): Promise<ValuationCategory[]> {
  const { data, error } = await supabase
    .from('lead_magnet_valuations')
    .select('id, title')
    .order('title', { ascending: true })
  
  if (error) {
    console.error('Error fetching valuation categories:', error)
    throw error
  }
  
  if (!data || data.length === 0) {
    return []
  }
  
  return data.map(row => ({
    id: row.id,
    title: row.title
  }))
}

