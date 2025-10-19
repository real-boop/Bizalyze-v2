import React, { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { UserOnMarketTable, BusinessResult } from "@/components/UserOnMarketTable"
import { useRouter } from "next/navigation"
import { AnalysisTriggerLoader } from "./analysis-trigger-loader"
import { UserAnalysisModal } from "@/components/UserAnalysisModal"
import { supabase } from "@/lib/supabase"

interface OnMarketTabProps {
  userId: string
  onDataReady?: () => void
  paymentSuccess?: boolean
  paymentCheckoutId?: string | null
  autoOpenModal?: boolean
  onPaymentSuccessHandled?: () => void
}

interface UserBusiness {
  id: string
  name: string
  city: string
  state: string
  county: string
  location: string
  category: string
  analysis_status: string
  created_at: string
  analysis_completed_at: string
  listing_url: string
  url: string
  asking_price: string
}


const OnMarketTab: React.FC<OnMarketTabProps> = ({ userId, onDataReady, paymentSuccess, paymentCheckoutId, autoOpenModal, onPaymentSuccessHandled }) => {
  const [userBusinesses, setUserBusinesses] = useState<UserBusiness[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showLoader, setShowLoader] = useState(false)
  const [loaderStatus, setLoaderStatus] = useState<{ scrapeStatus: "pending" | "complete" | "processing" | "failed"; analysisStatuses: ("pending" | "complete" | "processing" | "failed")[] }>({ scrapeStatus: "pending", analysisStatuses: [] })
  const [loaderBusinessId, setLoaderBusinessId] = useState<string | null>(null)
  const [analysisCompleteInstant, setAnalysisCompleteInstant] = useState(false)
  const redirectTimeout = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const [bookmarkedLinks, setBookmarkedLinks] = useState<string[]>([])
  const [contactedLinks, setContactedLinks] = useState<string[]>([])
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)
  const [userEmail, setUserEmail] = useState<string>("")

  // Get user email from session
  useEffect(() => {
    const getUserEmail = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        setUserEmail(session.user.email)
      }
    }
    getUserEmail()
  }, [])

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
        setUserBusinesses(data.businesses || [])
        
        if (onDataReady) onDataReady();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        toast.error('Failed to load your businesses')
      } finally {
        setLoading(false)
      }
    }
    fetchUserBusinesses()
  }, [userId, onDataReady])

  // Load bookmarks and contacted links from localStorage on mount
  useEffect(() => {
    const bookmarksKey = `bookmarks_${userId}`;
    const contactedKey = `contacted_${userId}`;
    
    // Load bookmarks
    const storedBookmarks = localStorage.getItem(bookmarksKey);
    if (storedBookmarks) {
      try {
        setBookmarkedLinks(JSON.parse(storedBookmarks));
      } catch {
        setBookmarkedLinks([]);
      }
    }
    
    // Load contacted links
    const storedContacted = localStorage.getItem(contactedKey);
    if (storedContacted) {
      try {
        setContactedLinks(JSON.parse(storedContacted));
      } catch {
        setContactedLinks([]);
      }
    }
  }, [userId]);

  // Auto-open modal when payment success is detected
  useEffect(() => {
    if (autoOpenModal && paymentSuccess) {
      setShowAnalysisModal(true);
      toast.success('Payment successful! Ready to start your analysis.');
    }
  }, [autoOpenModal, paymentSuccess]);

  // Helper to update bookmarks in state and localStorage
  const toggleBookmark = (business: BusinessResult) => {
    const key = `bookmarks_${userId}`;
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

  // Helper to handle contact tracking
  const handleContact = (business: BusinessResult) => {
    const key = `contacted_${userId}`;
    setContactedLinks(prev => {
      const link = business.link;
      let updated: string[];
      if (prev.includes(link)) {
        updated = prev.filter(u => u !== link);
        toast.success(`Removed contact status for ${business.title}`);
      } else {
        updated = [...prev, link];
        toast.success(`Marked ${business.title} as contacted`);
      }
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    });
  };

  const handleAnalyze = async (business: BusinessResult) => {
    // For user dashboard, we just navigate to the existing business dashboard
    // since the business is already analyzed
    // Extract business ID from the URL
    const businessId = business.url.split('/').pop()
    if (businessId) {
      router.push(`/dashboard/${businessId}`)
    }
  };

  // No polling needed for user businesses since they're already analyzed

  // Transform user businesses to match table format
  const transformedResults = userBusinesses.map(business => {
    const dashboardLink = `/dashboard/${business.id}`;
    return {
      title: business.name || 'Unknown Business',
      address: business.location || 'No address',
      website: business.listing_url || '', // FIXED: Use listing_url for external URL
      url: dashboardLink, // Dashboard link for "View Dashboard" button
      phones: [], // Not available in user_businesses table
      emails: [], // Not available in user_businesses table
      facebooks: [], // Not available in user_businesses table
      instagrams: [], // Not available in user_businesses table
      twitters: [], // Not available in user_businesses table
      totalScore: 0, // Not available in user_businesses table
      reviewsCount: 0, // Not available in user_businesses table
      link: dashboardLink,
      price: business.asking_price || 'N/A', // FIXED: Use extracted asking price
      location: business.location || '',
      checked: true, // All user businesses are analyzed
      bookmarked: bookmarkedLinks.includes(dashboardLink),
      contacted: contactedLinks.includes(dashboardLink),
    }
  });

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
            <p className="text-gray-500">No analyzed businesses found. Start by analyzing a business from the search page.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          {transformedResults.length > 0 ? (
            <UserOnMarketTable 
              results={transformedResults}
              onViewDashboard={handleAnalyze}
              onBookmark={toggleBookmark}
              onContact={handleContact}
              onAnalyzeNew={() => setShowAnalysisModal(true)}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No analyzed businesses found</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {showAnalysisModal && (
        <UserAnalysisModal
          isOpen={showAnalysisModal}
          onClose={() => {
            setShowAnalysisModal(false);
            if (onPaymentSuccessHandled) {
              onPaymentSuccessHandled();
            }
          }}
          userEmail={userEmail}
          paymentSuccess={paymentSuccess}
          checkoutId={paymentCheckoutId}
        />
      )}
    </>
  )
}

export default OnMarketTab 