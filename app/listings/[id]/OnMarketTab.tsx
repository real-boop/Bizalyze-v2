import React, { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { OnMarketResultsTable } from "@/components/OnMarketResultsTable"
import { useRouter } from "next/navigation"
import { AnalysisTriggerLoader } from "../analysis-trigger-loader"

interface OnMarketTabProps {
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

interface BusinessResult {
  title: string;
  address: string;
  website: string;
  url: string;
  phones: string[];
  emails: string[];
  facebooks: string[];
  instagrams: string[];
  twitters: string[];
  totalScore: number;
  reviewsCount: number;
  link: string;
  price: string;
  location: string;
}

const OnMarketTab: React.FC<OnMarketTabProps> = ({ sessionId, onDataReady }) => {
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onMarket, setOnMarket] = useState<boolean | null>(null)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [showLoader, setShowLoader] = useState(false)
  const [loaderStatus, setLoaderStatus] = useState<{ scrapeStatus: "pending" | "complete" | "processing" | "failed"; analysisStatuses: ("pending" | "complete" | "processing" | "failed")[] }>({ scrapeStatus: "pending", analysisStatuses: [] })
  const [loaderBusinessId, setLoaderBusinessId] = useState<string | null>(null)
  const [analysisCompleteInstant, setAnalysisCompleteInstant] = useState(false)
  const redirectTimeout = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const [analyzedUrls, setAnalyzedUrls] = useState<string[]>([])
  const [bookmarkedLinks, setBookmarkedLinks] = useState<string[]>([])

  useEffect(() => {
    const fetchSearchResults = async () => {
      try {
        // Fetch session to get on_market flag
        const sessionRes = await fetch(`/api/search-status?id=${sessionId}`)
        const sessionData = await sessionRes.json()
        // If steps include Perplexity, on_market was selected
        const hasOnMarket = sessionData.steps && sessionData.steps.some((step: any) => step.label === 'Perplexity')
        setOnMarket(hasOnMarket)
        // Fetch results
        const response = await fetch(`/api/search-results?id=${sessionId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch search results')
        }
        const data = await response.json()
        setSearchResult({ id: sessionId, status: 'complete', results: data.on_market || [] })
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
    const key = `bookmarks_${sessionId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setBookmarkedLinks(JSON.parse(stored));
      } catch {
        setBookmarkedLinks([]);
      }
    }
  }, [sessionId]);

  // Helper to update bookmarks in state and localStorage
  const toggleBookmark = (business: BusinessResult) => {
    const key = `bookmarks_${sessionId}`;
    setBookmarkedLinks(prev => {
      const link = business.link;
      let updated: string[];
      if (prev.includes(link)) {
        updated = prev.filter(u => u !== link);
        toast.success(`Removed bookmark for ${business.title}`);
      } else {
        updated = [...prev, link];
        toast.success(`Bookmarked ${business.title}`);
      }
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    });
  };

  const handleAnalyze = async (business: BusinessResult) => {
    setShowLoader(true)
    setLoaderBusinessId(null)
    setAnalysisCompleteInstant(false)
    try {
      // TODO: Replace with actual user_id from auth context
      const user_id = "demo-user-id";
      const res = await fetch("/api/trigger-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id,
          url: business.url,
          search_session_id: sessionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze business")
      if (data.business_id) {
        console.log('[Parent] Setting loaderBusinessId:', data.business_id);
        setLoaderBusinessId(data.business_id)
        if (data.status === "complete") {
          setLoaderStatus({ scrapeStatus: "complete", analysisStatuses: ["complete"] })
          setAnalysisCompleteInstant(true)
          redirectTimeout.current = setTimeout(() => {
            router.push(`/dashboard/${data.business_id}?from=listings`)
          }, 1000)
          return
        }
        // If not complete, polling will handle redirect
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to analyze business")
      setShowLoader(false)
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (showLoader && loaderBusinessId && !analysisCompleteInstant) {
      interval = setInterval(async () => {
        try {
          console.log('[Parent] Polling business ID:', loaderBusinessId);
          const res = await fetch(`/api/scrape-analysis-status?id=${loaderBusinessId}`)
          const data = await res.json()
          console.log('[Parent] API response:', data);
          setLoaderStatus({
            scrapeStatus: data.scrapeStatus,
            analysisStatuses: data.analysisStatuses
          })
          console.log('[Parent] Setting loaderStatus:', {
            scrapeStatus: data.scrapeStatus,
            analysisStatuses: data.analysisStatuses
          });
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

  // Move transformedResults and debugging useEffect here, before any return
  const transformedResults = Array.isArray(searchResult?.results) ? searchResult.results.map(item => {
    const link = item.link || item.website || item.url || '';
    return {
      title: item.title || item.name || 'Unknown',
      address: item.address || item.formattedAddress || 'No address',
      website: item.website || '',
      url: item.url || item.placeUrl || '',
      phones: Array.isArray(item.phones) ? item.phones : [item.phone].filter(Boolean),
      emails: Array.isArray(item.emails) ? item.emails : [item.email].filter(Boolean),
      facebooks: Array.isArray(item.facebooks) ? item.facebooks : [item.facebook].filter(Boolean),
      instagrams: Array.isArray(item.instagrams) ? item.instagrams : [item.instagram].filter(Boolean),
      twitters: Array.isArray(item.twitters) ? item.twitters : [item.twitter].filter(Boolean),
      totalScore: parseFloat(item.totalScore) || parseFloat(item.rating) || 0,
      reviewsCount: parseInt(item.reviewsCount) || parseInt(item.reviews) || 0,
      link,
      price: item.price || 'N/A',
      location: typeof item.location === 'object' && item.location !== null ? `${item.location.lat}, ${item.location.lng}` : item.location || '',
      checked: analyzedUrls.includes(item.url || item.placeUrl || ''),
      bookmarked: bookmarkedLinks.includes(link),
    }
  }) : [];

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

  if (onMarket === false) {
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

  return (
    <Card>
      <CardContent className="pt-6">
        {showLoader || analysisCompleteInstant ? (
          <AnalysisTriggerLoader
            status={loaderStatus}
            onComplete={() => {
              if (loaderBusinessId) {
                router.push(`/dashboard/${loaderBusinessId}?from=listings`)
              }
            }}
            instantComplete={analysisCompleteInstant}
          />
        ) : null}
        {transformedResults.length > 0 ? (
          <OnMarketResultsTable 
            results={transformedResults}
            onAnalyze={handleAnalyze}
            onBookmark={toggleBookmark}
            onContact={(business) => {
              toast.success(`Marked ${business.title} as contacted`)
            }}
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

export default OnMarketTab 