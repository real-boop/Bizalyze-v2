"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { BarChart3, Building, Menu, MapPin, Loader2, CheckCircle2, Home, Search } from "lucide-react"
import OffMarketTab from "./OffMarketTab"
import OnMarketTab from "./OnMarketTab"
import { UserDashLoader } from "./UserDashLoader"
import { supabase } from "@/lib/supabase"
import UserMenu from "@/components/UserMenu"
import { useTheme } from "next-themes"

const UserDashboardPage = () => {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("on-market")
  const headerRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [dataReady, setDataReady] = useState(false)
  const { setTheme } = useTheme()
  
  // Authentication state
  const [user, setUser] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Payment success state
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentCheckoutId, setPaymentCheckoutId] = useState<string | null>(null);
  const [autoOpenModal, setAutoOpenModal] = useState(false);

  // Check for payment success redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccessParam = urlParams.get('payment_success');
    const checkoutId = urlParams.get('token');
    
    if (paymentSuccessParam === 'true' && checkoutId) {
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Set payment success state AND auto-open modal
      setPaymentSuccess(true);
      setPaymentCheckoutId(checkoutId);
      setAutoOpenModal(true); // This will trigger modal to open automatically
      console.log('Payment successful, checkout ID:', checkoutId);
      
      // Update database immediately to sync with frontend
      const updatePaymentStatus = async () => {
        try {
          console.log('🔄 [USER_DASHBOARD] Updating database immediately...');
          
          // Get email from localStorage (available immediately, unlike state)
          const storedData = localStorage.getItem('pendingAnalysisForm');
          const emailFromStorage = storedData ? JSON.parse(storedData).email : null;
          
          console.log('🔍 [USER_DASHBOARD] Email from localStorage:', emailFromStorage);
          
          if (!emailFromStorage) {
            console.error('❌ [USER_DASHBOARD] No email found in localStorage');
            return;
          }
          
          const response = await fetch('/api/check-payment-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'update_payment_status',
              checkoutId: checkoutId,
              email: emailFromStorage
            })
          });
          
          const result = await response.json();
          if (result.success) {
            console.log('✅ [USER_DASHBOARD] Database updated successfully');
          } else {
            console.log('⚠️ [USER_DASHBOARD] Database update result:', result);
          }
        } catch (error) {
          console.error('❌ [USER_DASHBOARD] Failed to update database:', error);
        }
      };
      
      updatePaymentStatus();
    }
  }, []);

  // Check authentication on page load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (session && !error) {
          setIsAuthenticated(true)
          setUser(session.user)
          setLoading(false)
        } else {
          setIsAuthenticated(false)
          setUser(null)
          // Redirect to home if not authenticated
          router.push("/")
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setIsAuthenticated(false)
        setUser(null)
        router.push("/")
      } finally {
        setAuthChecked(true)
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true)
        setUser(session.user)
        setLoading(false)
      } else {
        setIsAuthenticated(false)
        setUser(null)
        router.push("/")
      }
      setAuthChecked(true)
    })

    return () => subscription.unsubscribe()
  }, [router])

  // Force light mode when user dashboard loads
  useEffect(() => {
    setTheme("light")
  }, [setTheme])

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
    setMenuOpen(false)
    router.push("/")
  }

  const handleAnalyzeNewBusiness = () => {
    setMenuOpen(false)
    router.push("/")
  }


  // Don't render anything until auth is checked
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col relative">
      {/* Loader Overlay with Progress Bar and Steps */}
      {loading && (
        <UserDashLoader onComplete={() => setLoading(false)} dataReady={dataReady} onDataReady={() => setDataReady(true)} />
      )}
      {/* Unified Header and Navigation Container */}
      <div ref={headerRef} className="sticky top-0 left-0 right-0 z-40 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-100">
          <div className="max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex flex-row items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">My Businesses</h1>
              </div>
              {/* User Menu and Hamburger Menu */}
              <div className="flex items-center gap-2">
                {/* User Menu */}
                <UserMenu user={user} />
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
                        onClick={handleAnalyzeNewBusiness}
                      >
                        <Search className="w-5 h-5 mr-3 text-blue-600" />
                        Analyze New Business
                      </button>
                      <button
                        className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-100 focus:outline-none border-t border-gray-100"
                        onClick={handleBackHome}
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
          <OffMarketTab userId={user.id} onDataReady={() => setDataReady(true)} />
        ) : (
          <OnMarketTab 
            userId={user.id} 
            onDataReady={() => setDataReady(true)} 
            paymentSuccess={paymentSuccess}
            paymentCheckoutId={paymentCheckoutId}
            autoOpenModal={autoOpenModal}
            onPaymentSuccessHandled={() => {
              setPaymentSuccess(false);
              setPaymentCheckoutId(null);
              setAutoOpenModal(false); // Reset auto-open state
            }}
          />
        )}
      </div>
    </div>
  )
}

export default UserDashboardPage 