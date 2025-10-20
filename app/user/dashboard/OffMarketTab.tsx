import React, { useEffect, useState, useRef } from "react"
import { UserOffMarketTable, BusinessResult as OffMarketBusinessResult } from "@/components/UserOffMarketTable"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Loader } from "@/components/Loader"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface OffMarketTabProps {
  userId: string
  onDataReady?: () => void
}

interface UserBusiness {
  id: string
  name: string
  city: string
  state: string
  county: string
  location: string
  category_name: string
  analysis_status: string
  created_at: string
  updated_at: string
  url: string
}

// Utility to parse address string into components (very basic, can be improved)
function parseAddress(address: string) {
  // Example: "123 Main St, San Francisco, CA 94110"
  const parts = address.split(',').map(p => p.trim());
  let street = '', city = '', state = '', zip = '', county = '';
  if (parts.length === 3) {
    street = parts[0];
    city = parts[1];
    const stateZip = parts[2].split(' ');
    state = stateZip[0];
    zip = stateZip[1] || '';
  } else if (parts.length === 2) {
    street = parts[0];
    const stateZip = parts[1].split(' ');
    city = '';
    state = stateZip[0];
    zip = stateZip[1] || '';
  } else {
    street = address;
  }
  return { street, city, state, zip, county };
}

const OffMarketTab: React.FC<OffMarketTabProps> = ({ userId, onDataReady }) => {
  const [userBusinesses, setUserBusinesses] = useState<UserBusiness[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bookmarkedLocations, setBookmarkedLocations] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    const fetchUserBusinesses = async () => {
      try {
        // Get current session to get auth token
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error('No active session')
        }

        // Fetch user's businesses
        const response = await fetch('/api/user-businesses', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch user businesses')
        }
        
        const data = await response.json()
        // Filter for off-market businesses (those with URLs starting with "offmarket:")
        const offMarketBusinesses = (data.businesses || []).filter((business: any) => 
          business.url && business.url.startsWith('offmarket:')
        )
        setUserBusinesses(offMarketBusinesses)
        
        if (onDataReady) onDataReady();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        toast.error('Failed to load your off-market businesses')
      } finally {
        setLoading(false)
      }
    }
    fetchUserBusinesses()
  }, [userId])

  // Load bookmarks from localStorage on mount
  useEffect(() => {
    const key = `bookmarks_offmarket_${userId}`;
    const stored = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (stored) {
      try {
        setBookmarkedLocations(JSON.parse(stored));
      } catch {
        setBookmarkedLocations([]);
      }
    }
  }, [userId]);

  // Helper to update bookmarks in state and localStorage
  const toggleBookmark = (business: OffMarketBusinessResult) => {
    const key = `bookmarks_offmarket_${userId}`;
    setBookmarkedLocations(prev => {
      const loc = business.location;
      let updated: string[];
      if (prev.includes(loc)) {
        updated = prev.filter(u => u !== loc);
        toast.success(`Removed bookmark for ${business.title}`);
      } else {
        updated = [...prev, loc];
        toast.success(`Bookmarked ${business.title}`);
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleAnalyze = (business: OffMarketBusinessResult) => {
    // For user dashboard, we just navigate to the existing business dashboard
    // since the business is already analyzed
    // Extract business ID from the URL
    const businessId = business.url.split('/').pop()
    if (businessId) {
      router.push(`/dashboard/${businessId}`)
    }
  };

  // No polling needed for user businesses since they're already analyzed

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="py-8">
            <p className="text-red-500">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (userBusinesses.length === 0 && !loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="py-8">
            <p className="text-gray-500">No analyzed off-market businesses found. Feature coming soon.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Transform user businesses to match table format
  const transformedResults = userBusinesses.map(business => {
    const link = `/dashboard/${business.id}`;
    return {
      title: business.name || 'Unknown Business',
      address: business.location || 'No address',
      website: '', // Not available in user_businesses table
      url: link,
      phones: [], // Not available in user_businesses table
      emails: [], // Not available in user_businesses table
      facebooks: [], // Not available in user_businesses table
      instagrams: [], // Not available in user_businesses table
      twitters: [], // Not available in user_businesses table
      totalScore: 0, // Not available in user_businesses table
      reviewsCount: 0, // Not available in user_businesses table
      checked: true, // All user businesses are analyzed
      bookmarked: bookmarkedLocations.includes(business.location || ''),
      location: business.location || '',
    }
  });

  return (
    <Card>
      <CardContent className="pt-6">
        {transformedResults.length > 0 ? (
          <UserOffMarketTable 
            results={transformedResults as OffMarketBusinessResult[]}
            onViewDashboard={handleAnalyze as (business: OffMarketBusinessResult) => void}
            onBookmark={toggleBookmark as (business: OffMarketBusinessResult) => void}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No analyzed off-market businesses found</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default OffMarketTab
