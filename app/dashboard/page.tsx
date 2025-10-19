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
} from "lucide-react"
import BusinessScoreTab from "./BusinessScoreTab"
import RecommendationTab from "./RecommendationTab"
import DemographicsTab from "./DemographicsTab"
import CompetitionTab from "./CompetitionTab"
import { formatCurrency } from "./utils/formatCurrency"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { useParams, useRouter } from "next/navigation"

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

const Dashboard = () => {
  const params = useParams();
  const router = useRouter();
  const businessId = typeof params.businessId === 'string' ? params.businessId : Array.isArray(params.businessId) ? params.businessId[0] : undefined;
  const [activeTab, setActiveTab] = useState("score")
  const [windowWidth, setWindowWidth] = useState(0)
  const [headerHeight, setHeaderHeight] = useState(0)
  const headerRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // New state for business info and price
  const [businessInfo, setBusinessInfo] = useState<{ name?: string; city?: string; county?: string; state?: string } | null>(null)
  const [askingPrice, setAskingPrice] = useState<number | null>(null)
  const [loadingBusiness, setLoadingBusiness] = useState(true)

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth)
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight)
      }
    }
    setWindowWidth(window.innerWidth)
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Hamburger menu close on outside click
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

  useEffect(() => {
    let isMounted = true
    setLoadingBusiness(true)
    // Fetch business info
    const fetchBusiness = async () => {
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("name, city, county, state")
        .eq("id", businessId)
        .single()
      if (!isMounted) return
      if (businessError) {
        setBusinessInfo(null)
      } else {
        setBusinessInfo(business)
      }
    }
    // Fetch asking price
    const fetchPrice = async () => {
      const { data: analyses, error: priceError } = await supabase
        .from("business_analyses")
        .select("asking_price")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
      if (!isMounted) return
      if (priceError || !analyses || analyses.length === 0) {
        setAskingPrice(null)
      } else {
        setAskingPrice(analyses[0].asking_price)
      }
    }
    fetchBusiness()
    fetchPrice()
    setLoadingBusiness(false)
    return () => {
      isMounted = false
    }
  }, [businessId])

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

  const handleBackHome = () => {
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Unified Header and Navigation Container */}
      <div ref={headerRef} className="sticky top-0 left-0 right-0 z-40 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-100">
          <div className="max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
            {/* Header top row: title and menu icon */}
            <div className="flex flex-row items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                  Dashboard
                </h1>
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
                        handleBackHome()
                      }}
                    >
                      <Home className="w-5 h-5 mr-3 text-blue-600" />
                      Back to Home
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Tabs Navigation - Icon-only on mobile */}
        <div className="border-b border-gray-200">
          <div className="max-w-7xl">
            <nav className="grid grid-cols-4 w-full">
              <button
                className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${activeTab === "score" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                aria-label="Business Score"
                disabled
              >
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                  <BarChart3 className={`w-5 h-5 sm:mr-2 ${activeTab === "score" ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="hidden sm:inline">Business Score</span>
                  <span className="text-[10px] mt-1 sm:hidden">Score</span>
                </div>
                {activeTab === "score" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
              </button>
              <button
                className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${activeTab === "recommendation" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                aria-label="Recommendation"
                disabled
              >
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                  <CheckCircle className={`w-5 h-5 sm:mr-2 ${activeTab === "recommendation" ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="hidden sm:inline">Recommendation</span>
                  <span className="text-[10px] mt-1 sm:hidden">Rec</span>
                </div>
                {activeTab === "recommendation" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
              </button>
              <button
                className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${activeTab === "demographics" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                aria-label="Demographics"
                disabled
              >
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                  <Users className={`w-5 h-5 sm:mr-2 ${activeTab === "demographics" ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="hidden sm:inline">Demographics</span>
                  <span className="text-[10px] mt-1 sm:hidden">Demo</span>
                </div>
                {activeTab === "demographics" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
              </button>
              <button
                className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${activeTab === "competition" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                aria-label="Competition"
                disabled
              >
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                  <Building className={`w-5 h-5 sm:mr-2 ${activeTab === "competition" ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="hidden sm:inline">Competition</span>
                  <span className="text-[10px] mt-1 sm:hidden">Comp</span>
                </div>
                {activeTab === "competition" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
              </button>
            </nav>
          </div>
        </div>
      </div>
      {/* Tab Content - Consistent spacing */}
      <div className="max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        <div className="p-8 mt-8 max-w-2xl">
          <h2 className="text-2xl font-bold mb-2 text-gray-800">No business selected</h2>
          <p className="text-gray-600 mb-2">Please select a business to view the dashboard.</p>
          <p className="text-gray-500 text-sm">Use the menu to return home or select a business.</p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
