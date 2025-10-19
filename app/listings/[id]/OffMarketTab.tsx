import React, { useEffect, useState, useRef } from "react"
import { OffMarketResultsTable, BusinessResult as OffMarketBusinessResult } from "@/components/OffMarketResultsTable"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Loader } from "@/components/Loader"
import { useRouter } from "next/navigation"

interface OffMarketTabProps {
  sessionId: string
  query: string
  location: string
  onDataReady?: () => void
}

interface SearchResult {
  id: string
  status: string
  results: any[]
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

const OffMarketTab: React.FC<OffMarketTabProps> = ({ sessionId, onDataReady }) => {
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offMarket, setOffMarket] = useState<boolean | null>(null)
  const [showLoader, setShowLoader] = useState(false)
  const [loaderStatus, setLoaderStatus] = useState<{ scrapeStatus: "pending" | "complete" | "processing" | "failed"; analysisStatuses: ("pending" | "complete" | "processing" | "failed")[] }>({ scrapeStatus: "pending", analysisStatuses: [] })
  const [loaderBusinessId, setLoaderBusinessId] = useState<string | null>(null)
  const [analysisCompleteInstant, setAnalysisCompleteInstant] = useState(false)
  const redirectTimeout = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const [analyzedUrls, setAnalyzedUrls] = useState<string[]>([])
  const [bookmarkedLocations, setBookmarkedLocations] = useState<string[]>([])

  useEffect(() => {
    const fetchSearchResults = async () => {
      try {
        // Fetch session to get off_market flag
        const sessionRes = await fetch(`/api/search-status?id=${sessionId}`)
        const sessionData = await sessionRes.json()
        // If steps include Off-market, off_market was selected
        const hasOffMarket = sessionData.steps && sessionData.steps.some((step: any) => step.label === 'Off-market')
        setOffMarket(hasOffMarket)
        // Fetch results
        const response = await fetch(`/api/search-results?id=${sessionId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch search results')
        }
        const data = await response.json()
        setSearchResult({ id: sessionId, status: 'complete', results: data.off_market || [] })
        // Fetch analyzed URLs
        const analyzedRes = await fetch(`/api/analyzed-businesses?sessionId=${sessionId}`)
        if (analyzedRes.ok) {
          const analyzedData = await analyzedRes.json()
          setAnalyzedUrls(analyzedData.analyzedBusinessUrls || [])
        }
        if (onDataReady) onDataReady();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        toast.error('Failed to load search results')
      } finally {
        setLoading(false)
      }
    }
    fetchSearchResults()
  }, [sessionId])

  // Load bookmarks from localStorage on mount
  useEffect(() => {
    const key = `bookmarks_offmarket_${sessionId}`;
    const stored = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (stored) {
      try {
        setBookmarkedLocations(JSON.parse(stored));
      } catch {
        setBookmarkedLocations([]);
      }
    }
  }, [sessionId]);

  // Helper to update bookmarks in state and localStorage
  const toggleBookmark = (business: OffMarketBusinessResult) => {
    const key = `bookmarks_offmarket_${sessionId}`;
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
    (async () => {
      setShowLoader(true)
      setLoaderBusinessId(null)
      setAnalysisCompleteInstant(false)
      try {
        // Always pass null for user_id (no auth yet)
        const user_id = null;
        const addressObj = parseAddress(business.address);
        // 1. Call the new off-market analysis API (with duplicate logic)
        const res = await fetch("/api/trigger-offmarket-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: business.title,
            address: addressObj,
            session_id: sessionId,
            user_id,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to analyze business");
        // Always redirect to dashboard after analysis (analysis is now inline in the API)
        if (data.business_id) {
          setShowLoader(false);
          router.push(`/dashboard/${data.business_id}?from=listings`);
          return;
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to analyze business")
        setShowLoader(false)
      }
    })();
  };

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (showLoader && loaderBusinessId && !analysisCompleteInstant) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/scrape-analysis-status?id=${loaderBusinessId}`)
          const data = await res.json()
          setLoaderStatus({
            scrapeStatus: data.scrapeStatus,
            analysisStatuses: data.analysisStatuses
          })
          if (
            data.scrapeDataPresent &&
            (data.analysisStatuses.some((s: string) => s === "complete") || data.analysisRawPresent)
          ) {
            clearInterval(interval)
            router.push(`/dashboard/${loaderBusinessId}?from=listings`)
          }
        } catch (err) {
          // Optionally handle polling errors
        }
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [showLoader, loaderBusinessId, analysisCompleteInstant])

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

  if (offMarket === false) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="py-8">
            <p className="text-gray-500">Not searched for this query</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!searchResult || searchResult.status !== 'complete') {
    return (
      <Card>
        <CardContent>
          <p>Please wait while we process your search results...</p>
        </CardContent>
      </Card>
    )
  }

  const transformedResults = Array.isArray(searchResult.results) ? searchResult.results.map(item => {
    // Parse address for synthetic URL
    const parsedAddress = parseAddress(item.address || item.formattedAddress || '');
    const syntheticUrl = `offmarket:${item.title || item.name || 'Unknown'}:${parsedAddress.street},${parsedAddress.city},${parsedAddress.state},${parsedAddress.zip}`;
    return {
      title: item.title || item.name || 'Unknown',
      address: item.address || item.formattedAddress || 'No address',
      website: item.website || '',
      url: item.url || item.placeUrl || '',
      link: item.link || '',
      price: item.price || 'N/A',
      location: typeof item.location === 'object' && item.location !== null ? `${item.location.lat}, ${item.location.lng}` : item.location || '',
      phones: Array.isArray(item.phones) ? item.phones : [item.phone].filter(Boolean),
      emails: Array.isArray(item.emails) ? item.emails : [item.email].filter(Boolean),
      facebooks: Array.isArray(item.facebooks) ? item.facebooks : [item.facebook].filter(Boolean),
      instagrams: Array.isArray(item.instagrams) ? item.instagrams : [item.instagram].filter(Boolean),
      twitters: Array.isArray(item.twitters) ? item.twitters : [item.twitter].filter(Boolean),
      totalScore: parseFloat(item.totalScore) || parseFloat(item.rating) || 0,
      reviewsCount: parseInt(item.reviewsCount) || parseInt(item.reviews) || 0,
      checked: analyzedUrls.includes(syntheticUrl),
      bookmarked: bookmarkedLocations.includes(
        typeof item.location === 'object' && item.location !== null ? `${item.location.lat}, ${item.location.lng}` : item.location || ''
      ),
    }
  }) : []

  return (
    <Card>
      <CardContent className="pt-6">
        {showLoader && <Loader />}
        {transformedResults.length > 0 ? (
          <OffMarketResultsTable 
            results={transformedResults as OffMarketBusinessResult[]}
            onAnalyze={handleAnalyze as (business: OffMarketBusinessResult) => void}
            onBookmark={toggleBookmark as (business: OffMarketBusinessResult) => void}
            onContact={(business) => { toast.success(`Marked ${business.title} as contacted`); }}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No results found</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default OffMarketTab