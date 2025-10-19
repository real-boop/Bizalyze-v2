"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  User,
  Shield,
  CreditCard,
  MessageCircle,
  Home,
  Menu,
  Search,
} from "lucide-react"
import ProfileTab from "./ProfileTab"
import SecurityTab from "./SecurityTab"
import BillingTab from "./BillingTab"
import SupportTab from "./SupportTab"
import UserMenu from "@/components/UserMenu"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState("profile")
  const [windowWidth, setWindowWidth] = useState(0)
  const [headerHeight, setHeaderHeight] = useState(0)
  const headerRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Auth state
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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

  // Check authentication
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)
      setLoading(false)
    }
    checkUser()
  }, [router])

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

  // Determine if mobile view based on width
  const isMobile = windowWidth < 768

  const handleBackHome = () => {
    router.push("/")
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  // Show not authenticated state
  if (!user) {
    return null // Will redirect to home
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
                  Settings
                </h1>
              </div>
              {/* Right side: UserMenu and Hamburger */}
              <div className="flex items-center gap-2">
                {/* UserMenu Component */}
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
                        onClick={() => {
                          setMenuOpen(false)
                          router.push('/')
                        }}
                      >
                        <Search className="w-5 h-5 mr-3 text-blue-600" />
                        Analyze New Business
                      </button>
                      <button
                        className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-100 focus:outline-none border-t border-gray-100"
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
        </div>
        {/* Tabs Navigation - Icon-only on mobile */}
        <div className="border-b border-gray-200">
          <div className="max-w-7xl">
            <nav className="grid grid-cols-4 w-full">
              <button
                className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${activeTab === "profile" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                aria-label="Profile"
                onClick={() => setActiveTab("profile")}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                  <User className={`w-5 h-5 sm:mr-2 ${activeTab === "profile" ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="hidden sm:inline">Profile</span>
                  <span className="text-[10px] mt-1 sm:hidden">Profile</span>
                </div>
                {activeTab === "profile" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
              </button>
              <button
                className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${activeTab === "security" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                aria-label="Security"
                onClick={() => setActiveTab("security")}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                  <Shield className={`w-5 h-5 sm:mr-2 ${activeTab === "security" ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="hidden sm:inline">Security</span>
                  <span className="text-[10px] mt-1 sm:hidden">Security</span>
                </div>
                {activeTab === "security" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
              </button>
              <button
                className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${activeTab === "billing" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                aria-label="Billing"
                onClick={() => setActiveTab("billing")}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                  <CreditCard className={`w-5 h-5 sm:mr-2 ${activeTab === "billing" ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="hidden sm:inline">Billing</span>
                  <span className="text-[10px] mt-1 sm:hidden">Billing</span>
                </div>
                {activeTab === "billing" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
              </button>
              <button
                className={`py-4 px-2 sm:px-6 text-sm font-medium transition-colors relative ${activeTab === "support" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                aria-label="Support"
                onClick={() => setActiveTab("support")}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                  <MessageCircle className={`w-5 h-5 sm:mr-2 ${activeTab === "support" ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="hidden sm:inline">Support</span>
                  <span className="text-[10px] mt-1 sm:hidden">Support</span>
                </div>
                {activeTab === "support" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
              </button>
            </nav>
          </div>
        </div>
      </div>
      
      {/* Tab Content - Consistent spacing */}
      <div className="max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        {activeTab === "profile" && <ProfileTab user={user} />}
        {activeTab === "security" && <SecurityTab user={user} />}
        {activeTab === "billing" && <BillingTab user={user} />}
        {activeTab === "support" && <SupportTab user={user} />}
      </div>
    </div>
  )
}

export default SettingsPage