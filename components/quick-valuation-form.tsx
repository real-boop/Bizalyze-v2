"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { motion } from "framer-motion"
import { fetchValuationCategories, type ValuationCategory } from "@/lib/valuation-utils"
import { US_STATES } from "@/lib/us-states"
import { supabase } from "@/lib/supabase"

// Email validation helper
function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

// Format number for currency input display
function formatCurrencyInput(value: string): string {
  // Remove all non-numeric characters
  const numericValue = value.replace(/\D/g, '')
  if (!numericValue) return ''
  
  // Format with commas
  return parseInt(numericValue).toLocaleString()
}

// Parse formatted currency string back to number
function parseCurrencyInput(value: string): number {
  return parseInt(value.replace(/\D/g, '')) || 0
}

type SubmissionState = 'form' | 'loading' | 'results'

interface ValuationResults {
  valuations: {
    premium: {
      revenueMethod: { lower: number; upper: number }
      sdeMethod: { lower: number; upper: number }
    }
    average: {
      revenueMethod: { lower: number; upper: number }
      sdeMethod: { lower: number; upper: number }
    }
  }
  benchmarks: {
    medianSalePrice: number
    reportedSales: number
    daysOnMarket: number
    salesToAskingRatio: number
    trendDirection: string
    demandLevel: string
    notes: string | null
  }
  calculatedMetrics: {
    competitivePricingIndex: {
      value: number
      display: string
      color: string
    }
    revenueMultipleRanking: {
      quartile: string
      color: string
    }
    sdeMultipleRanking: {
      quartile: string
      color: string
    }
    timeToSell: {
      difference: number
      display: string
      color: string
    }
    profitMargin: {
      userMargin: number
      categoryMargin: number
      difference: number
      display: string
      badge: string
      color: string
    }
    businessTier: {
      tier: string
      description: string
      color: string
      message: string
    }
    supplyLevel: {
      quartile: string
      salesCount: number
      reliability: string
      color: string
    }
  }
  leadId: string
}

interface QuickValuationFormProps {
  // Results component will be passed as children or we'll conditionally render it
}

export function QuickValuationForm({}: QuickValuationFormProps) {
  const router = useRouter()
  
  // Form state
  const [category, setCategory] = useState<string>("")
  const [businessName, setBusinessName] = useState<string>("")
  const [state, setState] = useState<string>("")
  const [city, setCity] = useState<string>("")
  const [revenue, setRevenue] = useState<string>("")
  const [sde, setSde] = useState<string>("")
  const [additionalInfo, setAdditionalInfo] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  const [userType, setUserType] = useState<'buyer' | 'seller' | ''>('')
  const [wantsContact, setWantsContact] = useState(false)

  // Categories from database (with id and title)
  const [categoryData, setCategoryData] = useState<ValuationCategory[]>([])
  const [isFetchingCategories, setIsFetchingCategories] = useState(false)

  // Submission state
  const [submissionState, setSubmissionState] = useState<SubmissionState>('form')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string>("")

  // Email validation
  const [emailError, setEmailError] = useState<string>("")

  // Track if user is logged in (to disable email field)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Track if we've attempted to auto-populate email
  const emailPopulatedRef = useRef(false)

  // Fetch categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      setIsFetchingCategories(true)
      try {
        const cats = await fetchValuationCategories()
        setCategoryData(cats)
      } catch (err) {
        console.error('Failed to load categories:', err)
        setError('Failed to load business categories. Please refresh the page.')
      } finally {
        setIsFetchingCategories(false)
      }
    }
    loadCategories()
  }, [])

  // Auto-populate email if user is logged in
  useEffect(() => {
    const getUserEmail = async () => {
      // Only attempt once on mount
      if (emailPopulatedRef.current) return
      
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.email) {
          setIsLoggedIn(true)
          // Only auto-populate if email field is empty
          setEmail(prevEmail => {
            if (!prevEmail && session.user?.email) {
              emailPopulatedRef.current = true
              return session.user.email
            }
            return prevEmail
          })
        } else {
          setIsLoggedIn(false)
        }
        emailPopulatedRef.current = true
      } catch (err) {
        console.error('Failed to get user email:', err)
        // Silently fail - don't show error to user
        setIsLoggedIn(false)
        emailPopulatedRef.current = true
      }
    }
    getUserEmail()
  }, [])

  // Email validation on change
  useEffect(() => {
    if (email && !isValidEmail(email)) {
      setEmailError("Please enter a valid email address")
    } else {
      setEmailError("")
    }
  }, [email])

  // Form validation - ensure userType is explicitly selected (not empty string)
  const isFormValid = 
    category &&
    businessName.trim() &&
    state &&
    city.trim() &&
    revenue &&
    parseCurrencyInput(revenue) > 0 &&
    sde &&
    parseCurrencyInput(sde) > 0 &&
    email &&
    isValidEmail(email) &&
    (userType === 'buyer' || userType === 'seller') // Explicit check - must be buyer or seller, not empty

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isFormValid) {
      setError("Please fill in all required fields correctly")
      return
    }

    setIsSubmitting(true)
    setError("")
    setSubmissionState('loading')

    try {
      const selectedCategory = categoryData.find(c => c.id === parseInt(category))
      
      const response = await fetch('/api/quick-valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          categoryId: parseInt(category),
          categoryTitle: selectedCategory?.title || '',
          state: state,
          city: city.trim(),
          revenue: parseCurrencyInput(revenue),
          sde: parseCurrencyInput(sde),
          additionalInfo: additionalInfo.trim() || undefined,
          email: email.trim().toLowerCase(),
          userType: userType,
          wantsContact: userType === 'seller' ? wantsContact : false
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate valuation')
      }

      if (data.success && data.results && data.results.leadId) {
        // Redirect to the valuation page with unique ID
        router.push(`/valuations/${data.results.leadId}`)
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit form. Please try again.')
      setSubmissionState('form')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Results are now shown on the /valuations/[id] page after redirect
  // No need to show results inline anymore

  // Show loading state
  if (submissionState === 'loading') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-2xl mx-auto"
      >
        <Card className="w-full">
          <CardContent className="pt-6 pb-8">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
              <p className="text-lg font-medium text-gray-700">Calculating your valuation...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // Show form
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="w-full max-w-2xl lg:max-w-4xl mx-auto"
    >
      <Card className="w-full transition-all hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600">
        <CardContent className="pt-6 pb-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Business Category */}
            <div>
              <label className="block font-semibold mb-1 text-sm sm:text-base">Business Category *</label>
              <select
                className="w-full bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-gray-700 rounded-xl h-12 px-4 text-sm disabled:opacity-50 transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                disabled={isFetchingCategories || isSubmitting}
              >
                <option value="" disabled>
                  {isFetchingCategories ? "Loading categories..." : "Select a category"}
                </option>
                {categoryData.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Business Name */}
            <div>
              <label className="block font-semibold mb-1 text-sm sm:text-base mt-4">Business Name *</label>
              <Input
                type="text"
                placeholder="Enter business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-gray-700 rounded-xl h-12 px-4 text-sm transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* State */}
            <div>
              <label className="block font-semibold mb-1 text-sm sm:text-base mt-4">State *</label>
              <select
                className="w-full bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-gray-700 rounded-xl h-12 px-4 text-sm disabled:opacity-50 transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                disabled={isSubmitting}
              >
                <option value="" disabled>Select a state</option>
                {US_STATES.map((stateOption) => (
                  <option key={stateOption.value} value={stateOption.value}>
                    {stateOption.label}
                  </option>
                ))}
              </select>
            </div>

            {/* City */}
            <div>
              <label className="block font-semibold mb-1 text-sm sm:text-base mt-4">City *</label>
              <Input
                type="text"
                placeholder="Enter city name"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-gray-700 rounded-xl h-12 px-4 text-sm transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Annual Revenue */}
            <div>
              <label className="block font-semibold mb-1 text-sm sm:text-base mt-4">Annual Revenue ($) *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="text"
                  placeholder="0"
                  value={revenue}
                  onChange={(e) => {
                    const formatted = formatCurrencyInput(e.target.value)
                    setRevenue(formatted)
                  }}
                  className="bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-gray-700 rounded-xl h-12 pl-8 pr-4 text-sm transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Cash Flow/SDE */}
            <div>
              <label className="block font-semibold mb-1 text-sm sm:text-base mt-4">Cash Flow / SDE ($) *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="text"
                  placeholder="0"
                  value={sde}
                  onChange={(e) => {
                    const formatted = formatCurrencyInput(e.target.value)
                    setSde(formatted)
                  }}
                  className="bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-gray-700 rounded-xl h-12 pl-8 pr-4 text-sm transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <label className="block font-semibold mb-1 text-sm sm:text-base mt-4">Additional Information (Optional)</label>
              <Textarea
                placeholder="Add any additional details about your business - think of: lease terms, equipment age, operational details, etc...."
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                className="bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm resize-none transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600"
                rows={4}
                disabled={isSubmitting}
                maxLength={5000}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {additionalInfo.length}/5000 characters
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block font-semibold mb-1 text-sm sm:text-base mt-4">Email *</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-gray-700 rounded-xl h-12 px-4 text-sm transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600 ${
                  emailError ? 'border-red-500 focus:border-red-500' : ''
                } ${isLoggedIn ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed' : ''}`}
                required
                disabled={isSubmitting || isLoggedIn}
              />
              {isLoggedIn && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Using your account email address
                </p>
              )}
              {emailError && (
                <div className="text-red-500 text-sm mt-1">{emailError}</div>
              )}
            </div>

            {/* User Type */}
            <div>
              <label className="block font-semibold mb-1 text-sm sm:text-base mt-4">I am a *</label>
              <RadioGroup
                value={userType || undefined} // Use undefined instead of empty string for no selection
                onValueChange={(value) => {
                  setUserType(value as 'buyer' | 'seller')
                  // Reset wants_contact when user type changes
                  if (value !== 'seller') {
                    setWantsContact(false)
                  }
                }}
                disabled={isSubmitting}
                className="flex gap-6"
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="buyer" id="buyer" />
                  <Label htmlFor="buyer" className="cursor-pointer">Buyer</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="seller" id="seller" />
                  <Label htmlFor="seller" className="cursor-pointer">Seller</Label>
                </div>
              </RadioGroup>
              {!userType && (
                <p className="text-sm text-gray-500 mt-2">Please select whether you are a buyer or seller</p>
              )}
              
              {/* Show checkbox when seller is selected */}
              {userType === 'seller' && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wantsContact}
                      onChange={(e) => setWantsContact(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Contact me if there are interested buyers
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-500 text-sm mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full rounded-xl px-6 py-4 text-sm sm:text-base font-semibold mt-6"
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? "Calculating..." : "Get My Valuation"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}

