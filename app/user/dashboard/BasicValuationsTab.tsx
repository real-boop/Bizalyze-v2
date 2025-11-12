import React, { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { UserValuationsTable, ValuationResult } from "@/components/UserValuationsTable"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import { UserAnalysisModal } from "@/components/UserAnalysisModal"

interface BasicValuationsTabProps {
  userId: string
  onDataReady?: () => void
  paymentSuccess?: boolean
  paymentCheckoutId?: string | null
  autoOpenModal?: boolean
  onPaymentSuccessHandled?: () => void
}

interface ValuationEntry {
  id: string
  email: string
  business_name: string
  business_category_title: string
  revenue: string | number
  sde: string | number
  location_city: string
  location_state: string
  additional_information: string | null
  user_type: 'buyer' | 'seller' | null
  wants_contact: boolean
  pdf_sent: boolean
  pdf_sent_at: string | null
  converted_to_paid: boolean
  converted_at: string | null
  created_at: string
}


const BasicValuationsTab: React.FC<BasicValuationsTabProps> = ({ userId, onDataReady, paymentSuccess, paymentCheckoutId, autoOpenModal, onPaymentSuccessHandled }) => {
  const [valuations, setValuations] = useState<ValuationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const [bookmarkedLinks, setBookmarkedLinks] = useState<string[]>([])
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)
  const [userEmail, setUserEmail] = useState<string>("")
  const [selectedValuation, setSelectedValuation] = useState<ValuationResult | null>(null)

  useEffect(() => {
    const fetchValuations = async () => {
      try {
        // Get current session to get auth token
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error('No active session')
        }

        // Fetch user's valuations
        const response = await fetch('/api/user-valuations', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch valuations')
        }
        
        const data = await response.json()
        setValuations(data.valuations || [])
        
        if (onDataReady) onDataReady();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        toast.error('Failed to load your valuations')
      } finally {
        setLoading(false)
      }
    }
    fetchValuations()
  }, [userId])

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

  // Load bookmarks from localStorage on mount
  useEffect(() => {
    const bookmarksKey = `bookmarks_valuations_${userId}`;
    
    // Load bookmarks
    const storedBookmarks = localStorage.getItem(bookmarksKey);
    if (storedBookmarks) {
      try {
        setBookmarkedLinks(JSON.parse(storedBookmarks));
      } catch {
        setBookmarkedLinks([]);
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
  const toggleBookmark = (valuation: ValuationResult) => {
    const key = `bookmarks_valuations_${userId}`;
    setBookmarkedLinks(prev => {
      const link = valuation.link;
      let updated: string[];
      if (prev.includes(link)) {
        updated = prev.filter(u => u !== link);
        toast.success(`Removed bookmark for ${valuation.title}`);
      } else {
        updated = [...prev, link];
        toast.success(`Bookmarked ${valuation.title}`);
      }
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    });
  };

  const handleViewValuation = async (valuation: ValuationResult) => {
    // Navigate to the valuation results page
    router.push(valuation.url)
  };

  const handleUpgrade = (valuation: ValuationResult) => {
    setSelectedValuation(valuation)
    setShowAnalysisModal(true)
  };

  // Transform valuations to match table format
  const transformedResults = valuations.map(valuation => {
    const valuationLink = `/valuations/${valuation.id}`;
    const location = `${valuation.location_city}, ${valuation.location_state}`;
    // Parse revenue - it comes as string from database
    const revenue = typeof valuation.revenue === 'string' 
      ? parseFloat(valuation.revenue) 
      : valuation.revenue || 0;
    
    return {
      title: valuation.business_name || 'Unknown Business',
      address: location,
      url: valuationLink,
      link: valuationLink,
      revenue: revenue, // For sorting
      price: revenue > 0 ? `$${revenue.toLocaleString()}` : 'N/A', // Formatted display
      location: location,
      category: valuation.business_category_title || 'N/A',
      createdAt: valuation.created_at || new Date().toISOString(),
      checked: true,
      bookmarked: bookmarkedLinks.includes(valuationLink),
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

  if (valuations.length === 0 && !loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <p className="text-gray-500 text-center">It seems you have not created any valuations yet. Get started here:</p>
            <Button 
              size="lg" 
              className="rounded-full h-12 px-8 text-base"
              onClick={() => router.push('/valuations')}
            >
              New Valuation
              <ChevronRight className="ml-1 size-4" />
            </Button>
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
            <UserValuationsTable 
              results={transformedResults}
              onViewValuation={handleViewValuation}
              onBookmark={toggleBookmark}
              onNewValuation={() => router.push('/valuations')}
              onUpgrade={handleUpgrade}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No valuations found</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {showAnalysisModal && (
        <UserAnalysisModal
          isOpen={showAnalysisModal}
          onClose={() => {
            setShowAnalysisModal(false)
            setSelectedValuation(null)
            if (onPaymentSuccessHandled) {
              onPaymentSuccessHandled()
            }
          }}
          userEmail={userEmail}
          paymentSuccess={paymentSuccess}
          checkoutId={paymentCheckoutId || undefined}
        />
      )}
    </>
  )
}

export default BasicValuationsTab

