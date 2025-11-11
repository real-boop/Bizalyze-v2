"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { QuickValuationResults } from "@/components/quick-valuation-results"
import BackgroundPaths from "@/components/kokonutui/background-paths"
import { NewNavBar } from "@/components/NewNavBar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import AuthModal from "@/components/AuthModal"
import { supabase } from "@/lib/supabase"

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true

const TypewriterEffect = () => {
  const businessTypes = ["Full Demographics", "Location Details", "Detailed Comparables"]
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentText, setCurrentText] = useState("")
  const [isTyping, setIsTyping] = useState(true)

  useEffect(() => {
    const currentWord = businessTypes[currentIndex]

    if (isTyping) {
      if (currentText.length < currentWord.length) {
        const timeout = setTimeout(() => {
          setCurrentText(currentWord.slice(0, currentText.length + 1))
        }, 100)
        return () => clearTimeout(timeout)
      } else {
        const timeout = setTimeout(() => {
          setIsTyping(false)
        }, 2000)
        return () => clearTimeout(timeout)
      }
    } else {
      if (currentText.length > 0) {
        const timeout = setTimeout(() => {
          setCurrentText(currentText.slice(0, -1))
        }, 50)
        return () => clearTimeout(timeout)
      } else {
        const timeout = setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % businessTypes.length)
          setIsTyping(true)
        }, 500)
        return () => clearTimeout(timeout)
      }
    }
  }, [currentText, isTyping, currentIndex, businessTypes])

  return (
    <span>
      Join the Insider Club:<br />
      <span className="bg-gradient-to-r from-blue-500 to-teal-500 bg-clip-text text-transparent">
        {currentText}
        <span className="animate-pulse">|</span>
      </span>
    </span>
  )
}

export default function ValuationPage() {
  const params = useParams()
  const router = useRouter()
  const valuationId = params.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any>(null)
  const [leadData, setLeadData] = useState<any>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Add authentication state
  const [user, setUser] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const fetchValuation = async () => {
      if (!valuationId) {
        setError('Invalid valuation ID')
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/valuations/${valuationId}`)
        const data = await response.json()
        
        // Debug logging to see what API returns
        console.log('API Response:', JSON.stringify(data, null, 2))

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch valuation')
      }

      if (data.success && data.results) {
        console.log('leadData from API:', data.leadData)
        setResults(data.results)
        // Ensure leadData is a valid object before setting
        setLeadData(data.leadData && typeof data.leadData === 'object' ? data.leadData : null)
      } else {
        throw new Error('Invalid response from server')
      }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load valuation')
      } finally {
        setLoading(false)
      }
    }

    fetchValuation()
  }, [valuationId])

  // Check authentication on page load
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setIsAuthenticated(true)
        setUser(session.user)
      }
    }
    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true)
        setUser(session.user)
      } else {
        setIsAuthenticated(false)
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Ensure component only renders after client-side hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle sign up click - check auth state first
  const handleSignUpClick = async () => {
    // Check current session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session && session.user) {
      // User is logged in - redirect to dashboard
      router.push('/user/dashboard')
    } else {
      // User is not logged in - open sign up modal
      setAuthModalOpen(true)
    }
  }

  return (
    <>
      <NewNavBar />
      <main>
        <BackgroundPaths noCenter={true} title="" className="pt-0">
          {/* Hero Section - Same as form page */}
          <section className="w-full py-14 md:py-24 lg:py-24 overflow-hidden">
            <div className="container mx-auto px-4 md:px-6 relative">
              <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-black bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>

              <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
                {/* Left Column - Text Content */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-center lg:text-left order-1 lg:order-1"
                >
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-balance">
                    <TypewriterEffect />
                  </h1>
                  <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0 lg:max-w-none text-pretty">
                  Get access to the same deep intelligence advisors charge $2,000+ for. Insiders have fully customized reports specific to their business, location and target market.
                  </p>
                  <div className="flex items-center justify-center lg:justify-start gap-2 sm:gap-4 mt-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Check className="size-4 text-primary" />
                      <span>Expert Grade</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Check className="size-4 text-primary" />
                      <span>360 Degree View</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Check className="size-4 text-primary" />
                      <span>Full Due Diligence</span>
                    </div>
                  </div>
                  <div className="flex justify-center lg:justify-start mt-8">
                    <Button 
                      size="lg" 
                      onClick={handleSignUpClick}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-12 py-7 text-xl rounded-full shadow-lg hover:shadow-xl transition-all w-full sm:w-auto lg:w-[464px] xl:w-[528px]"
                    >
                      Unlock Full Analysis
                    </Button>
                  </div>
                </motion.div>

                {/* Right Column - Device Mockups */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                  className="relative flex justify-center lg:justify-end order-2 lg:order-2"
                >
                  <div className="relative w-full max-w-[500px] mx-auto lg:mx-0">
                    {/* Laptop Mockup */}
                    <div className="relative w-full">
                      <div className="w-full aspect-[5/3] max-w-[500px] bg-gray-800 rounded-t-xl p-1 sm:p-2 shadow-2xl">
                        <div className="w-full h-full bg-white rounded-lg overflow-hidden">
                          <img
                            src="/BizFax screen.png"
                            alt="BizFax Screen"
                            className="w-full h-full object-cover object-center"
                          />
                        </div>
                      </div>
                      <div className="w-full h-3 sm:h-4 bg-gray-800 rounded-b-xl"></div>
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 sm:w-16 h-1 bg-gray-600 rounded-full"></div>

                      <div className="absolute -bottom-6 sm:-bottom-8 left-0 w-full h-6 sm:h-8 bg-gradient-to-b from-gray-800/20 to-transparent rounded-b-xl transform scale-y-[-1] blur-sm opacity-30"></div>
                    </div>

                    {/* Mobile Phone Mockup */}
                    <div className="absolute -bottom-12 sm:-bottom-8 -left-2 sm:-left-16 z-10 scale-75 sm:scale-100">
                      <div className="w-[140px] sm:w-[140px] h-[240px] sm:h-[280px] bg-gray-800 rounded-[20px] sm:rounded-[24px] p-1.5 sm:p-2 shadow-xl">
                        <div className="w-full h-full bg-white rounded-[16px] sm:rounded-[20px] overflow-hidden relative">
                          {/* Phone notch */}
                          <div className="absolute top-1.5 sm:top-2 left-1/2 transform -translate-x-1/2 w-12 sm:w-16 h-3 sm:h-4 bg-gray-800 rounded-full z-10"></div>
                          <img
                            src="/bizalyze-mobile-report.png"
                            alt="Mobile UI"
                            className="w-full h-full object-contain object-center"
                          />
                        </div>
                      </div>

                      <div className="absolute -bottom-3 sm:-bottom-4 left-0 w-full h-3 sm:h-4 bg-gradient-to-b from-gray-800/20 to-transparent rounded-b-[20px] sm:rounded-b-[24px] transform scale-y-[-1] blur-sm opacity-30"></div>
                    </div>

                    {/* Background gradient blurs */}
                    <div className="absolute -bottom-6 -right-6 -z-10 h-[200px] sm:h-[300px] w-[200px] sm:w-[300px] rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 blur-3xl opacity-70"></div>
                    <div className="absolute -top-6 -left-6 -z-10 h-[200px] sm:h-[300px] w-[200px] sm:w-[300px] rounded-full bg-gradient-to-br from-secondary/30 to-primary/30 blur-3xl opacity-70"></div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {loading && (
            <div className="w-full py-24 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-2xl px-4"
              >
                <Card className="w-full">
                  <CardContent className="pt-6 pb-8">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                      <p className="text-lg font-medium text-gray-700">Loading valuation...</p>
                      <p className="text-sm text-gray-500 mt-2">Please wait</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}

          {error && !loading && (
            <div className="w-full py-24 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-2xl px-4"
              >
                <Card className="w-full">
                  <CardContent className="pt-6 pb-8">
                    <div className="text-center py-12">
                      <p className="text-lg font-medium text-red-600 mb-2">Error Loading Valuation</p>
                      <p className="text-sm text-gray-600">{error || 'Valuation not found'}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}

          {mounted && !loading && !error && results && leadData?.city && leadData?.state && (
            <>
              {/* Conversion Copy Section */}
              <div className="w-full max-w-4xl mx-auto pt-6 pb-12 px-4 md:px-6 space-y-6">
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground text-center text-pretty">
                  <span className="font-semibold text-foreground">You wouldn't buy or sell a house based purely on a Zillow guesstimate, right?</span>
                </p>
                
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground text-center text-pretty">
                  Industry averages are a starting point - but your business isn't average.
                </p>
                
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground text-center text-pretty">
                  Sign up and <span className="font-semibold text-foreground">get the full in-depth analysis that experts charge thousands for</span>. Know more than them. More than anyone across the table. In less than 5 minutes.
                </p>
              </div>

            {/* Results Component */}
            <div className="w-full pt-16 pb-16">
              <QuickValuationResults
                results={results}
                businessName={leadData?.businessName || ''}
                category={leadData?.category || ''}
                city={leadData?.city || ''}
                state={leadData?.state || ''}
                onSignUpClick={handleSignUpClick}
              />
            </div>
            </>
          )}
        </BackgroundPaths>
      </main>

      {/* Auth Modal */}
      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen} 
        onSignIn={() => {
          setAuthModalOpen(false);
        }} 
      />
    </>
  )
}

