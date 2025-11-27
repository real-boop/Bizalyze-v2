"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  MapPin,
  Star,
  DollarSign,
  Users,
  Calendar,
  Settings,
  Home,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  BarChart3,
  Users2,
  Building,
  Map,
  Menu,
  Download,
  Home as HomeIcon,
  LogOut,
} from "lucide-react"
import BusinessScoreTab from "../BusinessScoreTab"
import RecommendationTab from "../RecommendationTab"
import DemographicsTab from "../DemographicsTab"
import CompetitionTab from "../CompetitionTab"
import { formatCurrency } from "../utils/formatCurrency"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { useParams, useRouter } from "next/navigation"
import { exportDashboardToPDF } from '@/lib/pdfExport'
import { PaywallModal } from "@/components/PaywallModal"
import { OneHourWarningBanner } from "@/components/one-hour-warning-banner"
import { OneHourExceededBanner } from "@/components/one-hour-exceeded-banner"

// TypeScript interfaces for better type safety
interface DemographicsData {
  income: {
    median: number
    comparison: { percentDifference: number }
  }
  age: { median: number }
  population: { density: number }
  housing: {
    ownedHomes: number
    rentedHomes: number
    medianHomeValue: number
    medianRent: number
  }
  ethnicityDistribution: Array<{
    group: string
    percentage: number
  }>
}

interface CompetitorData {
  name: string
  address: string
  distance: number
  rating: number
  reviewCount: number
  summary: string
  services: string[]
}

interface CompetitionData {
  totalInRadius: number
  competitors: CompetitorData[]
  notes: string
}

// Props interface for DashboardContent
interface DashboardContentProps {
  // State
  exporting: boolean
  exportError: string | null
  menuOpen: boolean
  businessInfo: { name?: string; city?: string; county?: string; state?: string; listing_url?: string } | null
  askingPrice: number | null
  activeTab: string
  businessId: string
  isExportingScoreTab: boolean
  showMapExportOverlay: boolean
  
  // Refs
  headerRef: React.RefObject<HTMLDivElement | null>
  menuRef: React.RefObject<HTMLDivElement | null>
  scoreTabRef: React.RefObject<HTMLDivElement | null>
  demographicsTabRef: React.RefObject<HTMLDivElement | null>
  locationTabRef: React.RefObject<HTMLDivElement | null>
  recommendationTabRef: React.RefObject<HTMLDivElement | null>
  
  // Setters
  setExportError: (error: string | null) => void
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  setActiveTab: (tab: string) => void
  
  // Handlers
  handleExportPDF: () => void
  handleBackHome: () => void
  handleLogout: () => void
  formatCurrency: (value: number) => string
}

// ✅ DashboardContent now defined at module level (stable reference)
const DashboardContent: React.FC<DashboardContentProps> = ({
  exporting,
  exportError,
  menuOpen,
  businessInfo,
  askingPrice,
  activeTab,
  businessId,
  isExportingScoreTab,
  showMapExportOverlay,
  headerRef,
  menuRef,
  scoreTabRef,
  demographicsTabRef,
  locationTabRef,
  recommendationTabRef,
  setExportError,
  setMenuOpen,
  setActiveTab,
  handleExportPDF,
  handleBackHome,
  handleLogout,
  formatCurrency,
}) => (
  <>
    {/* Loading overlay */}
    {exporting && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white rounded-lg p-8 flex flex-col items-center shadow-lg">
          <svg className="animate-spin h-8 w-8 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
          <span className="text-gray-700 font-medium">Exporting PDF, please wait...</span>
        </div>
      </div>
    )}
    {/* Export error message */}
    {exportError && (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 border border-red-400 text-red-700 px-6 py-3 rounded shadow-lg flex items-center gap-4">
        <span>{exportError}</span>
        <button className="ml-2 text-red-700 hover:underline" onClick={() => setExportError(null)}>Dismiss</button>
      </div>
    )}
    {/* Unified Header and Navigation Container */}
    <div ref={headerRef} className="sticky top-0 left-0 right-0 z-40 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
          {/* Header top row: title/price and menu icon */}
          <div className="flex flex-row items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                {businessInfo?.name || "Business"}
              </h1>
              {askingPrice !== null && (
                <Badge className="bg-blue-600 text-white text-base font-semibold px-4 py-1 rounded-full shadow-sm">
                  {formatCurrency(askingPrice)}
                </Badge>
              )}
            </div>
            {/* Hamburger menu */}
            <div className="relative ml-2 flex-shrink-0" ref={menuRef}>
              <button
                className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Open menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Menu className="w-7 h-7 text-gray-700" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <button
                    className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-100 focus:outline-none"
                    onClick={() => {
                      setMenuOpen(false)
                      handleExportPDF()
                    }}
                  >
                    <Download className="w-5 h-5 mr-3 text-blue-600" />
                    Export to PDF
                  </button>
                  <button
                    className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-100 focus:outline-none"
                    onClick={() => {
                      setMenuOpen(false)
                      handleBackHome()
                    }}
                  >
                    <HomeIcon className="w-5 h-5 mr-3 text-blue-600" />
                    Dashboard
                  </button>
                  {/* Add logout button */}
                  <button
                    className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-100 focus:outline-none border-t border-gray-100"
                    onClick={() => {
                      setMenuOpen(false)
                      handleLogout()
                    }}
                  >
                    <LogOut className="w-5 h-5 mr-3 text-red-600" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Location line below */}
          <div className="flex items-center text-gray-600 mt-1 text-sm flex-wrap">
            <MapPin className="w-4 h-4 mr-1" />
            <span className="truncate">
              {[businessInfo?.city, businessInfo?.county, businessInfo?.state].filter(Boolean).join(", ")}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation - Icon-only on mobile */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl">
          <nav className="grid grid-cols-4 w-full">
            <button
              onClick={() => setActiveTab("score")}
              className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${
                activeTab === "score" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
              }`}
              aria-label="Business Score"
            >
              <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                <BarChart3
                  className={`w-5 h-5 sm:mr-2 ${activeTab === "score" ? "text-blue-600" : "text-gray-400"}`}
                />
                <span className="hidden sm:inline">Business</span>
                <span className="text-[10px] mt-1 sm:hidden">Biz</span>
              </div>
              {activeTab === "score" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
            </button>
            <button
              onClick={() => setActiveTab("demographics")}
              className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${
                activeTab === "demographics" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
              }`}
              aria-label="Demographics"
            >
              <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                <Users
                  className={`w-5 h-5 sm:mr-2 ${activeTab === "demographics" ? "text-blue-600" : "text-gray-400"}`}
                />
                <span className="hidden sm:inline">Demographics</span>
                <span className="text-[10px] mt-1 sm:hidden">Demo</span>
              </div>
              {activeTab === "demographics" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab("location")}
              className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${
                activeTab === "location" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
              }`}
              aria-label="Location"
            >
              <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                <MapPin
                  className={`w-5 h-5 sm:mr-2 ${activeTab === "location" ? "text-blue-600" : "text-gray-400"}`}
                />
                <span className="hidden sm:inline">Location</span>
                <span className="text-[10px] mt-1 sm:hidden">Loc</span>
              </div>
              {activeTab === "location" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab("recommendation")}
              className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${
                activeTab === "recommendation" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
              }`}
              aria-label="Recommendation"
            >
              <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                <CheckCircle
                  className={`w-5 h-5 sm:mr-2 ${activeTab === "recommendation" ? "text-blue-600" : "text-gray-400"}`}
                />
                <span className="hidden sm:inline">Recommendation</span>
                <span className="text-[10px] mt-1 sm:hidden">Rec</span>
              </div>
              {activeTab === "recommendation" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
              )}
            </button>
          </nav>
        </div>
      </div>
    </div>

    {/* Tab Content - Consistent spacing */}
    <div className="max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex-grow">
      {typeof businessId === 'string' && businessId ? (
        <>
          <div
            ref={scoreTabRef}
            style={{
              visibility: activeTab === 'score' ? 'visible' : 'hidden',
              position: activeTab === 'score' ? 'static' : 'absolute',
              left: activeTab === 'score' ? 'auto' : '-9999px',
              width: '100%',
            }}
          >
            <BusinessScoreTab businessId={businessId} expandAllDetails={isExportingScoreTab} />
          </div>
          <div
            ref={demographicsTabRef}
            style={{
              visibility: activeTab === 'demographics' ? 'visible' : 'hidden',
              position: activeTab === 'demographics' ? 'static' : 'absolute',
              left: activeTab === 'demographics' ? 'auto' : '-9999px',
              width: '100%',
            }}
          >
            <DemographicsTab businessId={businessId} expandAllDetails={isExportingScoreTab} />
          </div>
          <div
            ref={locationTabRef}
            style={{
              visibility: activeTab === 'location' ? 'visible' : 'hidden',
              position: activeTab === 'location' ? 'static' : 'absolute',
              left: activeTab === 'location' ? 'auto' : '-9999px',
              width: '100%',
            }}
          >
            <CompetitionTab businessId={businessId} showMapExportOverlay={showMapExportOverlay} expandAllDetails={isExportingScoreTab} />
          </div>
          <div
            ref={recommendationTabRef}
            style={{
              visibility: activeTab === 'recommendation' ? 'visible' : 'hidden',
              position: activeTab === 'recommendation' ? 'static' : 'absolute',
              left: activeTab === 'recommendation' ? 'auto' : '-9999px',
              width: '100%',
            }}
          >
            <RecommendationTab businessId={businessId} expandAllDetails={isExportingScoreTab} />
          </div>
        </>
      ) : (
        <div className="p-8 text-center text-red-500">Invalid or missing business ID in URL.</div>
      )}
    </div>
  </>
)

const Dashboard = () => {
  const params = useParams();
  const businessId = typeof params.businessId === 'string' ? params.businessId : Array.isArray(params.businessId) ? params.businessId[0] : undefined;
  const [activeTab, setActiveTab] = useState("score")
  const [windowWidth, setWindowWidth] = useState(0)
  const [headerHeight, setHeaderHeight] = useState(0)
  const headerRef = useRef<HTMLDivElement>(null)
  const scoreTabRef = useRef<HTMLDivElement>(null)
  const recommendationTabRef = useRef<HTMLDivElement>(null)
  const demographicsTabRef = useRef<HTMLDivElement>(null)
  const locationTabRef = useRef<HTMLDivElement>(null)

  // New state for business info and price
  const [businessInfo, setBusinessInfo] = useState<{ name?: string; city?: string; county?: string; state?: string; listing_url?: string } | null>(null)
  const [askingPrice, setAskingPrice] = useState<number | null>(null)
  const [loadingBusiness, setLoadingBusiness] = useState(true)

  // Dropdown menu state
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Loading overlay state
  const [exporting, setExporting] = useState(false)

  // Error state for export
  const [exportError, setExportError] = useState<string | null>(null)

  // Track if we are exporting (to pass expandAllDetails to BusinessScoreTab)
  const [isExportingScoreTab, setIsExportingScoreTab] = useState(false)
  const [showMapExportOverlay, setShowMapExportOverlay] = useState(false)

  // Improved TypeScript types with discriminated unions
  type DashboardState = 
    | { state: 1 }
    | { state: 2; secondsRemaining: number; email: string }
    | { state: 3; email: string }
    | { state: 4 };

  const [dashboardState, setDashboardState] = useState<DashboardState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitializing = useRef(false);

  const router = useRouter();

  // Handle window resize and header height calculation
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth)
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight)
      }
    }

    // Set initial width and calculate header height
    setWindowWidth(window.innerWidth)
    handleResize()

    // Add event listener
    window.addEventListener("resize", handleResize)

    // Clean up
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    let isMounted = true
    setLoadingBusiness(true)
    // Fetch business info
    const fetchBusiness = async () => {
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("name, city, county, state, listing_url")
        .eq("id", businessId)
        .single()
      if (!isMounted) return
      if (businessError) {
        setBusinessInfo(null)
      } else {
        setBusinessInfo(business as { name?: string; city?: string; county?: string; state?: string; listing_url?: string })
      }
    }
    // Fetch asking price
    const fetchPrice = async () => {
      const { data: business, error: priceError } = await supabase
        .from("businesses")
        .select("listing_structured")
        .eq("id", businessId)
        .single()
      if (!business || priceError) {
        setAskingPrice(null)
      } else {
        // Defensive: handle both string and number
        const price = business?.listing_structured?.business_metrics?.asking_price
        setAskingPrice(price ? Number(price) : null)
      }
    }
    fetchBusiness()
    fetchPrice()
    setLoadingBusiness(false)
    return () => {
      isMounted = false
    }
  }, [businessId])

  // State detection function with proper error handling
  const detectDashboardState = async (
    businessId: string, 
    user: any, 
    checkoutId?: string
  ): Promise<DashboardState> => {
    console.log('🔍 [PHASE1] detectDashboardState called:', {
      businessId,
      hasUser: !!user,
      userId: user?.id,
      checkoutId,
      timestamp: new Date().toISOString()
    })
    
    // FEATURE FLAG: Bypass paywall when environment variable is set
    const shouldBypass = process.env.NEXT_PUBLIC_BYPASS_PAYWALL === 'true';
    
    if (shouldBypass) {
      console.log('🚫 Paywall bypassed via feature flag - granting full access');
      return { state: 1 }; // Full access
    }
    
    try {
      // LOGGED IN → Check if paid or free
      if (user) {
        console.log('🔍 [PHASE1] User is logged in, checking database...')
        
        const { data: purchase, error } = await supabase
          .from('user_businesses')
          .select('*')
          .eq('business_id', businessId)
          .eq('user_id', user.id)
          .in('payment_type', ['paid', 'free'])
          .maybeSingle()
        
        console.log('🔍 [PHASE1] Database query result:', { purchase, error })
        
        if (purchase && !error) {
          console.log('✅ [PHASE1] User has access - returning STATE 1')
          return { state: 1 }
        }
        
        console.log('🔍 [PHASE1] User logged in but no purchase - returning STATE 4')
        return { state: 4 }
      }

      // NOT LOGGED IN → Check grace period
      if (!checkoutId) {
        console.log('🔍 [PHASE1] No checkoutId - returning STATE 4')
        return { state: 4 }
      }

      console.log('🔍 [PHASE1] Calling verify-purchase API:', { checkoutId, businessId })

      const response = await fetch('/api/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutId, businessId })
      })

      if (!response.ok) {
        console.log('🔍 [PHASE1] API call failed:', response.status)
        return { state: 4 }
      }

      const purchase = await response.json()
      console.log('🔍 [PHASE1] API response:', purchase)

      // API already calculated grace period
      if (purchase.isExpired) {
        console.log('🔒 [PHASE1] Grace period EXPIRED - returning STATE 3')
        return { state: 3, email: purchase.email }
      } else {
        console.log('✅ [PHASE1] Grace period ACTIVE - returning STATE 2')
        return { 
          state: 2, 
          secondsRemaining: purchase.secondsRemaining, 
          email: purchase.email 
        }
      }
    } catch (error) {
      console.error('❌ [PHASE1] State detection failed:', error)
      return { state: 4 }
    }
  }


  // Initialize dashboard state with error handling
  useEffect(() => {
    console.log('📍 useEffect calling detectDashboardState')
    console.log('🚀 [PHASE1] useEffect triggered, businessId:', businessId)
    
    if (!businessId) {
      console.log('❌ [PHASE1] No businessId, setting error')
      setError('Invalid business ID')
      setIsLoading(false)
      return
    }

    const initializeDashboard = async () => {
      if (isInitializing.current) {
        console.log('⏭️ Already initializing, skipping duplicate call')
        return
      }
      
      isInitializing.current = true
      console.log('🚀 [PHASE1] Starting initialization')
      setIsLoading(true)
      setError(null)
      
      try {
        // Get current user
        const { data: { session } } = await supabase.auth.getSession()
        console.log('👤 [PHASE1] Session check:', { 
          hasSession: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email
        })
        
        // Get token from URL (renamed from checkout_id)
        const urlParams = new URLSearchParams(window.location.search)
        const checkoutId = urlParams.get('token') || undefined
        console.log('🔑 [PHASE1] URL params:', { 
          token: checkoutId,
          fullUrl: window.location.href,
          search: window.location.search,
          allParams: Object.fromEntries(urlParams.entries()),
          urlParamsKeys: Array.from(urlParams.keys()),
          urlParamsValues: Array.from(urlParams.values())
        })
        
        // Detect state
        console.log('🔍 [PHASE1] Calling detectDashboardState...')
        const state = await detectDashboardState(businessId, session?.user, checkoutId)
        console.log('📊 [PHASE1] State detected:', state)
        
        setDashboardState(state)
        console.log('✅ [PHASE1] dashboardState set')
      } catch (error) {
        console.error('❌ [PHASE1] Dashboard initialization failed:', error)
        setError('Failed to load dashboard')
        setDashboardState({ state: 4 }) // Safe fallback
      } finally {
        setIsLoading(false)
        isInitializing.current = false
        console.log('🏁 [PHASE1] Initialization complete')
      }
    }

    initializeDashboard()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 AUTH EVENT:', event, 'triggered at', new Date().toISOString())
      console.log('🔄 Session info:', { hasSession: !!session, userId: session?.user?.id })
      
      // Skip initial session and token refresh - useEffect already handles it
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        console.log('⏭️ Skipping event:', event)
        return
      }
      
      // Only react to actual auth changes
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        if (isInitializing.current) {
          console.log('⏭️ Already initializing, skipping auth event')
          return
        }
        
        console.log('🔄 AUTH EVENT:', event, 'calling detectDashboardState')
        try {
          const urlParams = new URLSearchParams(window.location.search)
          const checkoutId = urlParams.get('token') || undefined
          const state = await detectDashboardState(businessId, session?.user, checkoutId)
          setDashboardState(state)
        } catch (error) {
          console.error('Auth state change failed:', error)
          setDashboardState({ state: 4 }) // Safe fallback
        }
      } else {
        console.log('⏭️ Ignoring auth event:', event)
      }
    })

    return () => subscription.unsubscribe()
  }, [businessId])

  // Background grace period check - every 5 minutes
  useEffect(() => {
    // Only run this check if we're in State 2 (grace period active)
    if (dashboardState?.state !== 2) return

    const interval = setInterval(async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const checkoutId = urlParams.get('token')
        
        if (!checkoutId) return

        console.log('🔄 [Background Check] Checking grace period status...')
        
        const response = await fetch('/api/verify-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkoutId, businessId })
        })

        if (response.ok) {
          const result = await response.json()
          if (result.isExpired) {
            console.log('⏰ [Background Check] Grace period expired - switching to State 3')
            // Grace period expired - switch to State 3
            setDashboardState({ state: 3, email: result.email })
          } else {
            console.log('✅ [Background Check] Grace period still active')
          }
        }
      } catch (error) {
        console.error('❌ [Background Check] Grace period check failed:', error)
      }
    }, 5 * 60 * 1000) // Check every 5 minutes

    return () => clearInterval(interval)
  }, [dashboardState?.state, businessId])

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    } else {
      document.removeEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [menuOpen])

  // Removed unused fromStart check - no longer needed

  // Helper to wait for next paint
  const waitForNextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

  // Update: Helper to set tab visibility for export
  const setTabVisibility = (tabKey: string) => {
    if (scoreTabRef.current) {
      scoreTabRef.current.style.visibility = tabKey === 'score' ? 'visible' : 'hidden';
      scoreTabRef.current.style.position = tabKey === 'score' ? 'static' : 'absolute';
      scoreTabRef.current.style.left = tabKey === 'score' ? 'auto' : '-9999px';
    }
    if (recommendationTabRef.current) {
      recommendationTabRef.current.style.visibility = tabKey === 'recommendation' ? 'visible' : 'hidden';
      recommendationTabRef.current.style.position = tabKey === 'recommendation' ? 'static' : 'absolute';
      recommendationTabRef.current.style.left = tabKey === 'recommendation' ? 'auto' : '-9999px';
    }
    if (demographicsTabRef.current) {
      demographicsTabRef.current.style.visibility = tabKey === 'demographics' ? 'visible' : 'hidden';
      demographicsTabRef.current.style.position = tabKey === 'demographics' ? 'static' : 'absolute';
      demographicsTabRef.current.style.left = tabKey === 'demographics' ? 'auto' : '-9999px';
    }
    if (locationTabRef.current) {
      locationTabRef.current.style.visibility = tabKey === 'location' ? 'visible' : 'hidden';
      locationTabRef.current.style.position = tabKey === 'location' ? 'static' : 'absolute';
      locationTabRef.current.style.left = tabKey === 'location' ? 'auto' : '-9999px';
    }
  }



  // Export to PDF handler
  const handleExportPDF = async () => {
    setMenuOpen(false)
    setExporting(true)
    setExportError(null)
    setIsExportingScoreTab(true)
    const originalTab = activeTab
    try {
      const tabOrder = [
        { key: 'recommendation', ref: recommendationTabRef, name: 'Recommendation' },
        { key: 'score', ref: scoreTabRef, name: 'Business Score' },
        { key: 'demographics', ref: demographicsTabRef, name: 'Demographics' },
        { key: 'location', ref: locationTabRef, name: 'Location' },
      ]
      const tabImages: string[] = []
      for (const tab of tabOrder) {
        setTabVisibility(tab.key)
        if (tab.key === 'location') {
          setShowMapExportOverlay(true)
          await new Promise(res => setTimeout(res, 1000))
        } else {
          setShowMapExportOverlay(false)
          await new Promise(res => setTimeout(res, 300))
        }
        if (tab.ref.current) {
          const canvas = await import('html2canvas').then(m => m.default(tab.ref.current!, { scale: 2 }))
          tabImages.push(canvas.toDataURL('image/jpeg', 0.7))
        }
      }
      setTabVisibility(originalTab)
      setShowMapExportOverlay(false)
      setIsExportingScoreTab(false)
      // PDF generation
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const marginTop = 30
      const marginBottom = 18
      const footerFontSize = 9
      tabImages.forEach((img, i) => {
        // Insert business title as header
        pdf.setFontSize(footerFontSize)
        pdf.text(businessInfo?.name || 'Business', 40, marginTop)
        // Insert tab image, left-aligned, scaled to fit page
        const imgWidth = pageWidth - 80
        const imgProps = pdf.getImageProperties(img)
        const imgNaturalWidth = imgProps.width
        const imgNaturalHeight = imgProps.height
        let renderWidth = imgWidth
        let renderHeight = (imgNaturalHeight / imgNaturalWidth) * imgWidth
        if (renderHeight > pageHeight - marginTop - marginBottom - 30) {
          renderHeight = pageHeight - marginTop - marginBottom - 30
          renderWidth = (imgNaturalWidth / imgNaturalHeight) * renderHeight
        }
        pdf.addImage(
          img,
          'JPEG',
          40,
          marginTop + 15,
          renderWidth,
          renderHeight
        )
        // Insert tab name and link as footer, left-aligned, 8pt font
        pdf.setFontSize(8)
        const tabFooterText = `${tabOrder[i].name} - ${businessInfo?.listing_url || ''}`
        if (businessInfo?.listing_url) {
          // Draw the text and add a clickable link for the URL part
          const tabNameWidth = pdf.getTextWidth(`${tabOrder[i].name} - `)
          const y = pageHeight - marginBottom
          pdf.text(`${tabOrder[i].name} - `, 40, y, { align: 'left' })
          pdf.textWithLink(businessInfo.listing_url, 40 + tabNameWidth, y, { url: businessInfo.listing_url })
        } else {
          pdf.text(tabFooterText, 40, pageHeight - marginBottom, { align: 'left' })
        }
        if (i < tabImages.length - 1) pdf.addPage()
      })
      pdf.save(businessInfo?.name ? `${businessInfo.name}.pdf` : 'dashboard.pdf')
    } catch (err) {
      console.error('PDF export failed:', err)
      setExportError('Export failed. Please try again or contact support.')
      setIsExportingScoreTab(false)
    } finally {
      setExporting(false)
    }
  }

  // Placeholder action handlers
  const handleBackHome = () => {
    router.push("/user/dashboard");
  }

  // Add this function near the top of the component
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      // Redirect to home page instead of reloading
      router.push('/')
    }
  }

  // Determine if mobile view based on width
  const isMobile = windowWidth < 768

  // Format currency helper
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Badge component
  const Badge = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
    return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>{children}</span>
  }

  // Card component for consistent styling
  const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
    return (
      <div
        className={`bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden transition-all hover:shadow-lg hover:border-gray-300 ${className}`}
      >
        {children}
      </div>
    )
  }

  // Card header component
  const CardHeader = ({ children }: { children: React.ReactNode }) => {
    return <div className="px-6 py-5 border-b border-gray-100">{children}</div>
  }

  // Metric card component
  const MetricCard = ({
    icon,
    title,
    value,
    comparison,
    trend = "neutral",
  }: {
    icon: React.ReactNode
    title: string
    value: string
    comparison: string
    trend?: "positive" | "negative" | "neutral"
  }) => {
    return (
      <Card>
        <div className="p-6">
          <div className="flex items-center text-gray-500 mb-2">
            <div className="min-w-[40px] min-h-[40px] w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
              {icon}
            </div>
            <span className="text-sm font-medium text-gray-700">{title}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
          <div className="text-xs text-gray-500">{comparison}</div>
        </div>
      </Card>
    )
  }

  console.log('🎨 [PHASE1] Rendering with state:', {
    dashboardState,
    isLoading,
    error,
    willRender: !!(dashboardState && !isLoading && !error)
  })

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Error overlay */}
      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
          <div className="text-center">
            <div className="text-red-600 text-lg font-semibold mb-2">Error</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay during state detection */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      )}

      {/* State-based rendering */}
      {dashboardState && !isLoading && !error && (
        <>
          {/* STATE 1: Full Access */}
          {dashboardState.state === 1 && (
            <DashboardContent 
              exporting={exporting}
              exportError={exportError}
              menuOpen={menuOpen}
              businessInfo={businessInfo}
              askingPrice={askingPrice}
              activeTab={activeTab}
              businessId={businessId!}
              isExportingScoreTab={isExportingScoreTab}
              showMapExportOverlay={showMapExportOverlay}
              headerRef={headerRef}
              menuRef={menuRef}
              scoreTabRef={scoreTabRef}
              demographicsTabRef={demographicsTabRef}
              locationTabRef={locationTabRef}
              recommendationTabRef={recommendationTabRef}
              setExportError={setExportError}
              setMenuOpen={setMenuOpen}
              setActiveTab={setActiveTab}
              handleExportPDF={handleExportPDF}
              handleBackHome={handleBackHome}
              handleLogout={handleLogout}
              formatCurrency={formatCurrency}
            />
          )}

          {/* STATE 2: Grace Active */}
          {dashboardState.state === 2 && (
            <>
              <OneHourWarningBanner 
                secondsRemaining={dashboardState.secondsRemaining}
                email={dashboardState.email}
                onGraceExpired={() => {
                  setDashboardState({ state: 3, email: dashboardState.email })
                }}
                onDismiss={() => {
                  console.log('Warning banner dismissed by user')
                }}
              />
              <DashboardContent 
                exporting={exporting}
                exportError={exportError}
                menuOpen={menuOpen}
                businessInfo={businessInfo}
                askingPrice={askingPrice}
                activeTab={activeTab}
                businessId={businessId!}
                isExportingScoreTab={isExportingScoreTab}
                showMapExportOverlay={showMapExportOverlay}
                headerRef={headerRef}
                menuRef={menuRef}
                scoreTabRef={scoreTabRef}
                demographicsTabRef={demographicsTabRef}
                locationTabRef={locationTabRef}
                recommendationTabRef={recommendationTabRef}
                setExportError={setExportError}
                setMenuOpen={setMenuOpen}
                setActiveTab={setActiveTab}
                handleExportPDF={handleExportPDF}
                handleBackHome={handleBackHome}
                handleLogout={handleLogout}
                formatCurrency={formatCurrency}
              />
            </>
          )}

          {/* STATE 3: Grace Expired */}
          {dashboardState.state === 3 && (
            <>
              <OneHourExceededBanner 
                email={dashboardState.email}
                onResendVerification={async (email) => {
                  const response = await fetch('/api/resend-verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                  })
                  
                  if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.error || 'Failed to resend verification email')
                  }
                }}
                onSignIn={() => {
                  // Banner now handles its own login, no redirect needed
                  console.log('Sign in handled by banner')
                }}
              />
              <DashboardContent 
                exporting={exporting}
                exportError={exportError}
                menuOpen={menuOpen}
                businessInfo={businessInfo}
                askingPrice={askingPrice}
                activeTab={activeTab}
                businessId={businessId!}
                isExportingScoreTab={isExportingScoreTab}
                showMapExportOverlay={showMapExportOverlay}
                headerRef={headerRef}
                menuRef={menuRef}
                scoreTabRef={scoreTabRef}
                demographicsTabRef={demographicsTabRef}
                locationTabRef={locationTabRef}
                recommendationTabRef={recommendationTabRef}
                setExportError={setExportError}
                setMenuOpen={setMenuOpen}
                setActiveTab={setActiveTab}
                handleExportPDF={handleExportPDF}
                handleBackHome={handleBackHome}
                handleLogout={handleLogout}
                formatCurrency={formatCurrency}
              />
            </>
          )}

          {/* STATE 4: Unified Wall */}
          {dashboardState.state === 4 && businessId && businessInfo && (
            <>
              {/* Render DashboardContent in background (blurred/disabled) */}
              <div className="blur-sm pointer-events-none">
                <DashboardContent 
                  exporting={exporting}
                  exportError={exportError}
                  menuOpen={menuOpen}
                  businessInfo={businessInfo}
                  askingPrice={askingPrice}
                  activeTab={activeTab}
                  businessId={businessId}
                  isExportingScoreTab={isExportingScoreTab}
                  showMapExportOverlay={showMapExportOverlay}
                  headerRef={headerRef}
                  menuRef={menuRef}
                  scoreTabRef={scoreTabRef}
                  demographicsTabRef={demographicsTabRef}
                  locationTabRef={locationTabRef}
                  recommendationTabRef={recommendationTabRef}
                  setExportError={setExportError}
                  setMenuOpen={setMenuOpen}
                  setActiveTab={setActiveTab}
                  handleExportPDF={handleExportPDF}
                  handleBackHome={handleBackHome}
                  handleLogout={handleLogout}
                  formatCurrency={formatCurrency}
                />
              </div>
              {/* PaywallModal overlay */}
              <PaywallModal 
                businessId={businessId}
                businessInfo={businessInfo}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Dashboard
