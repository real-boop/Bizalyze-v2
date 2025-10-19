"use client"

import React, { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { BarChart3, Building, Menu, MapPin, Loader2, CheckCircle2 } from "lucide-react"
import OffMarketTab from "./OffMarketTab"
import OnMarketTab from "./OnMarketTab"
import { Loader as ListingLoader } from "../ListingLoader"

// Helper to parse location from query (simple version)
function parseLocation(query: string): string {
  // Example: "laundromats in Campbell, Santa Clara County, California"
  const match = query.match(/in (.+)$/i)
  return match ? match[1] : ""
}

const ListingsPage = () => {
  const params = useParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("off-market")
  const [searchQuery, setSearchQuery] = useState<string>("Business Listings")
  const [location] = useState<string>("")
  const headerRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [dataReady, setDataReady] = useState(false)
  const [status, setStatus] = useState<string>("processing")
  const [steps, setSteps] = useState<{ label: string, done: boolean }[]>([])
  const [progress, setProgress] = useState<number>(0)

  // On mount, check status and only trigger search if not already complete
  useEffect(() => {
    let polling: NodeJS.Timeout
    const checkAndTrigger = async () => {
      // Step 1: Check status
      let shouldTrigger = true
      try {
        const res = await fetch(`/api/search-status?id=${params.id}`)
        const data = await res.json()
        setStatus(data.status)
        setSteps(data.steps || [])
        setProgress(data.progress || 0)
        // If all steps are done, do not trigger search again
        if (data.steps && data.steps.length > 0 && data.steps.every((step: any) => step.done)) {
          shouldTrigger = false
        }
      } catch (err) {
        // Optionally handle error
      }
      // Step 2: Trigger the search if not already complete
      if (shouldTrigger) {
        try {
          await fetch("/api/search-trigger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: params.id }),
          })
        } catch (err) {
          // Ignore errors (may already be triggered)
        }
      }
      // Step 3: Poll for status
      const pollStatus = async () => {
        try {
          const res = await fetch(`/api/search-status?id=${params.id}`)
          const data = await res.json()
          setStatus(data.status)
          setSteps(data.steps || [])
          setProgress(data.progress || 0)
          if (data.steps && data.steps.every((step: any) => step.done)) {
            clearInterval(polling)
          }
        } catch (err) {
          // Optionally handle error
        }
      }
      pollStatus()
      polling = setInterval(pollStatus, 2000)
    }
    checkAndTrigger()
    return () => clearInterval(polling)
  }, [params.id])

  // Fetch cleaned_query from search_sessions table (new API)
  useEffect(() => {
    const fetchSearchSession = async () => {
      try {
        const response = await fetch(`/api/search-status?id=${params.id}`)
        if (response.ok) {
          const data = await response.json()
          // Always use cleaned_query if present and non-empty, otherwise fallback
          if (data && data.cleaned_query && data.cleaned_query.trim() !== "") {
            setSearchQuery(data.cleaned_query)
          } else {
            setSearchQuery("Business Listings")
          }
        } else {
          setSearchQuery("Business Listings")
        }
      } catch (err) {
        setSearchQuery("Business Listings")
      }
    }
    fetchSearchSession()
  }, [params.id])

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

  const handleBackHome = () => {
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col relative">
      {/* Loader Overlay with Progress Bar and Steps */}
      {loading && (
        <ListingLoader sessionId={params.id as string} onComplete={() => setLoading(false)} dataReady={dataReady} onDataReady={() => setDataReady(true)} />
      )}
      {/* Unified Header and Navigation Container */}
      <div ref={headerRef} className="sticky top-0 left-0 right-0 z-40 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-100">
          <div className="max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex flex-row items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{searchQuery}</h1>
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
                      <MapPin className="w-5 h-5 mr-3 text-blue-600" />
                      Back to Home
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* Location subtitle intentionally left empty for now */}
          </div>
        </div>
        {/* Tabs Navigation */}
        <div className="border-b border-gray-200">
          <div className="max-w-7xl">
            <nav className="grid grid-cols-2 w-full">
              <button
                className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${activeTab === "off-market" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                aria-label="Off-market"
                onClick={() => setActiveTab("off-market")}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                  <Building className={`w-5 h-5 sm:mr-2 ${activeTab === "off-market" ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="hidden sm:inline">Off-market</span>
                  <span className="text-[10px] mt-1 sm:hidden">Off</span>
                </div>
                {activeTab === "off-market" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
              </button>
              <button
                className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${activeTab === "on-market" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                aria-label="On-market"
                onClick={() => setActiveTab("on-market")}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                  <BarChart3 className={`w-5 h-5 sm:mr-2 ${activeTab === "on-market" ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="hidden sm:inline">On-market</span>
                  <span className="text-[10px] mt-1 sm:hidden">On</span>
                </div>
                {activeTab === "on-market" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
              </button>
            </nav>
          </div>
        </div>
      </div>
      {/* Tab Content */}
      <div className="max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        {activeTab === "off-market" ? (
          <OffMarketTab sessionId={params.id as string} query={searchQuery} location={location} onDataReady={() => setDataReady(true)} />
        ) : (
          <OnMarketTab sessionId={params.id as string} query={searchQuery} location={location} onDataReady={() => setDataReady(true)} />
        )}
      </div>
    </div>
  )
}

export default ListingsPage 