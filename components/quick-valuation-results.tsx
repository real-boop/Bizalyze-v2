"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GoogleMapsEmbed } from "@/components/GoogleMapsEmbed"
import { formatCurrency } from "@/app/dashboard/utils/formatCurrency"
import Link from "next/link"
import { motion } from "framer-motion"
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, AlertCircle, TrendingUp, TrendingDown, Clock, FastForward } from "lucide-react"

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
    performanceRatings?: {
      revenue: {
        rating: string
        userValue: number
        categoryMedian: number
        ratio: number
      }
      cashflow: {
        rating: string
        userValue: number
        categoryMedian: number
        ratio: number
      }
      margin: {
        rating: string
        userMargin: number
        categoryMargin: number
        ratio: number
      }
    }
    suggestedTier?: {
      tier: string
      tierScore: number
      tierLabel: string
    }
    recommendedRange?: {
      revenueMethod: {
        lower: number
        upper: number
      }
      sdeMethod: {
        lower: number
        upper: number
      }
      blended: {
        lower: number
        upper: number
      }
    }
  }
  leadId: string
}

interface QuickValuationResultsProps {
  results: ValuationResults
  businessName: string
  category: string
  city: string
  state: string
  onSignUpClick?: () => void
}

export function QuickValuationResults({
  results,
  businessName,
  category,
  city,
  state,
  onSignUpClick,
}: QuickValuationResultsProps) {
  const { valuations, benchmarks, calculatedMetrics } = results
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [valuationExpanded, setValuationExpanded] = useState(false)

  // Helper function to get color classes for badges
  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      'green': 'bg-green-100 text-green-800 border-green-200',
      'dark-green': 'bg-green-600 text-white border-green-700',
      'light-green': 'bg-green-50 text-green-700 border-green-300',
      'red': 'bg-red-100 text-red-800 border-red-200',
      'yellow': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'orange': 'bg-orange-100 text-orange-800 border-orange-200',
      'blue': 'bg-blue-100 text-blue-800 border-blue-200',
      'gray': 'bg-gray-100 text-gray-800 border-gray-200',
      'gold': 'bg-yellow-600 text-white border-yellow-700',
    }
    return colorMap[color] || colorMap['gray']
  }

  // Helper function to get trend badge color
  const getTrendColor = (trend: string) => {
    const lowerTrend = trend.toLowerCase()
    if (lowerTrend.includes('growing') || lowerTrend.includes('up') || lowerTrend.includes('increasing')) {
      return 'bg-green-100 text-green-800 border-green-200'
    } else if (lowerTrend.includes('declining') || lowerTrend.includes('down') || lowerTrend.includes('decreasing')) {
      return 'bg-red-100 text-red-800 border-red-200'
    }
    return 'bg-blue-100 text-blue-800 border-blue-200'
  }

  // Helper function to get demand badge color
  const getDemandColor = (demand: string) => {
    const lowerDemand = demand.toLowerCase()
    if (lowerDemand.includes('high')) {
      return 'bg-green-100 text-green-800 border-green-200'
    } else if (lowerDemand.includes('medium')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    } else if (lowerDemand.includes('low')) {
      return 'bg-orange-100 text-orange-800 border-orange-200'
    }
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  // Helper to get rotation angle based on state and number of positions
  const getGaugeRotation = (state: 'bad' | 'below-average' | 'average' | 'above-average' | 'good', positions: 3 | 4 = 3): number => {
    if (positions === 3) {
      // 3 positions: bad = -60deg, average = 0deg, good = 60deg
      if (state === 'bad') return -60
      if (state === 'average') return 0
      if (state === 'good') return 60
      return 0
    } else {
      // 4 positions: bad = -60deg, below-average = -20deg, above-average = 20deg, good = 60deg
      if (state === 'bad') return -60
      if (state === 'below-average') return -20
      if (state === 'above-average') return 20
      if (state === 'good') return 60
      return 0
    }
  }

  // Gauge Component
  const Gauge = ({ state, positions = 3, id }: { state: 'bad' | 'below-average' | 'average' | 'above-average' | 'good'; positions: 3 | 4; id: string }) => {
    const rotation = getGaugeRotation(state, positions)
    const gradientId = `grad-gauge-${id}`
    
    return (
      <div className="relative w-24 h-12">
        <svg viewBox="0 0 200 100" className="w-full h-full" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15))' }}>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <path
            d="M 20 90 A 80 80 0 0 1 180 90"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="12"
            strokeLinecap="round"
          />
        </svg>
        <div 
          className="absolute bottom-0 left-1/2 origin-bottom"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        >
          <div className="w-0.5 h-8 bg-gray-700 dark:bg-gray-400 rounded-t" style={{ marginTop: '4px' }} />
        </div>
      </div>
    )
  }

  // Helper functions to get gauge state from existing metrics
  const getTransactionFrequencyState = (): { state: 'bad' | 'below-average' | 'above-average' | 'good'; positions: 4 } => {
    const color = calculatedMetrics.supplyLevel?.color
    const quartile = calculatedMetrics.supplyLevel?.quartile || ""
    if (color === "green" || quartile.includes("High") || quartile.includes("Top")) {
      return { state: 'good', positions: 4 }
    } else if (quartile.includes("Above Average")) {
      return { state: 'above-average', positions: 4 }
    } else if (quartile.includes("Below Average")) {
      return { state: 'below-average', positions: 4 }
    }
    return { state: 'bad', positions: 4 }
  }

  const getTransactionSpeedState = (): { state: 'bad' | 'average' | 'good'; positions: 3 } => {
    const difference = calculatedMetrics.timeToSell?.difference || 0
    if (difference < -10) {
      return { state: 'good', positions: 3 }
    } else if (difference >= -10 && difference <= 10) {
      return { state: 'average', positions: 3 }
    }
    return { state: 'bad', positions: 3 }
  }

  const getSalesPriceVsAskingState = (): { state: 'bad' | 'average' | 'good'; positions: 3 } => {
    const color = calculatedMetrics.competitivePricingIndex?.color
    const value = calculatedMetrics.competitivePricingIndex?.value || 0
    if (color === "green" && value > 0) {
      return { state: 'good', positions: 3 }
    } else if (color === "yellow" || (value >= -2 && value <= 2)) {
      return { state: 'average', positions: 3 }
    }
    return { state: 'bad', positions: 3 }
  }

  const getRevenueMultipleState = (): { state: 'bad' | 'below-average' | 'above-average' | 'good'; positions: 4 } => {
    const color = calculatedMetrics.revenueMultipleRanking?.color
    const quartile = calculatedMetrics.revenueMultipleRanking?.quartile || ""
    if (color === "dark-green" || quartile.includes("Top")) {
      return { state: 'good', positions: 4 }
    } else if (color === "light-green" || quartile.includes("Above Average")) {
      return { state: 'above-average', positions: 4 }
    } else if (color === "yellow" || quartile.includes("Below Average")) {
      return { state: 'below-average', positions: 4 }
    }
    return { state: 'bad', positions: 4 }
  }

  const getCashFlowMultipleState = (): { state: 'bad' | 'below-average' | 'above-average' | 'good'; positions: 4 } => {
    const color = calculatedMetrics.sdeMultipleRanking?.color
    const quartile = calculatedMetrics.sdeMultipleRanking?.quartile || ""
    if (color === "dark-green" || quartile.includes("Top")) {
      return { state: 'good', positions: 4 }
    } else if (color === "light-green" || quartile.includes("Above Average")) {
      return { state: 'above-average', positions: 4 }
    } else if (color === "yellow" || quartile.includes("Below Average")) {
      return { state: 'below-average', positions: 4 }
    }
    return { state: 'bad', positions: 4 }
  }

  const getMarketTrendState = (): { state: 'bad' | 'average' | 'good'; positions: 3 } => {
    const trend = benchmarks.trendDirection?.toLowerCase() || ""
    if (trend.includes("growing") || trend.includes("increasing")) {
      return { state: 'good', positions: 3 }
    } else if (trend.includes("stable")) {
      return { state: 'average', positions: 3 }
    }
    return { state: 'bad', positions: 3 }
  }

  // Helper functions to generate descriptive text from existing metrics
  const getTransactionFrequencyText = () => {
    const color = calculatedMetrics.supplyLevel?.color
    const quartile = calculatedMetrics.supplyLevel?.quartile || ""
    if (color === "green" || quartile.includes("High") || quartile.includes("Top")) {
      return "Sells more frequently than other small business categories"
    } else if (color === "yellow" || quartile.includes("Average")) {
      if (quartile.includes("Above")) {
        return "Sales volume in line with other small business categories"
      } else {
        return "Sells less frequently than other small business categories"
      }
    }
    return "Sells significantly less often than other small business categories"
  }

  const getTransactionSpeedText = () => {
    const difference = calculatedMetrics.timeToSell?.difference || 0
    if (difference < -10) {
      return "Typically sell faster than the market average"
    } else if (difference >= -10 && difference <= 10) {
      return "Sells at a typical pace compared to other small businesses"
    }
    return "Takes longer to sell than the market average"
  }

  const getSalesPriceVsAskingText = () => {
    const color = calculatedMetrics.competitivePricingIndex?.color
    const value = calculatedMetrics.competitivePricingIndex?.value || 0
    if (color === "green" && value > 0) {
      return "Buyers typically pay at or above asking price"
    } else if (color === "yellow" || (value >= -2 && value <= 2)) {
      return "Actual sales prices are negotiated within reason from asking price"
    }
    return "Stronger discounting compared to asking price is not uncommon"
  }

  const getRevenueMultipleText = () => {
    const color = calculatedMetrics.revenueMultipleRanking?.color
    const quartile = calculatedMetrics.revenueMultipleRanking?.quartile || ""
    if (color === "dark-green" || quartile.includes("Top")) {
      return "Commands higher revenue multiples than most categories"
    } else if (color === "light-green" || quartile.includes("Above Average")) {
      return "Revenue multiples are above the median"
    } else if (color === "yellow" || quartile.includes("Below Average")) {
      return "Revenue multiples are below the median"
    }
    return "Lower revenue multiples compared to most categories"
  }

  const getCashFlowMultipleText = () => {
    const color = calculatedMetrics.sdeMultipleRanking?.color
    const quartile = calculatedMetrics.sdeMultipleRanking?.quartile || ""
    if (color === "dark-green" || quartile.includes("Top")) {
      return "Commands higher cash flow multiples than most categories"
    } else if (color === "light-green" || quartile.includes("Above Average")) {
      return "Cash flow multiples are above the median"
    } else if (color === "yellow" || quartile.includes("Below Average")) {
      return "Cash flow multiples are below the median"
    }
    return "Lower cash flow multiples compared to most categories"
  }

  const getMarketTrendText = () => {
    const trend = benchmarks.trendDirection?.toLowerCase() || ""
    if (trend.includes("growing") || trend.includes("increasing")) {
      return "Market is expected to grow with increasing demand"
    } else if (trend.includes("stable")) {
      return "Market conditions are expected to remain steady with consistent demand patterns"
    } else if (trend.includes("declining") || trend.includes("decreasing")) {
      return "Market is expected to contract with decreasing demand"
    }
    return "Market conditions are expected to remain steady with consistent demand patterns"
  }

  // Format currency with abbreviations (M for millions, K for thousands)
  const formatCurrencyAbbreviated = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`
    } else if (value >= 1000) {
      return `$${Math.round(value / 1000)}K`  // No decimals for K values
    }
    return `$${Math.round(value)}`
  }


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-4xl mx-auto space-y-6"
    >
      {/* Valuation Range Bars */}
      <Card className="transition-all hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600">
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Industry Comparison</h2>
          <div className="mt-6 space-y-1">
            <p className="text-sm text-gray-600 dark:text-gray-400">Business: <span className="font-semibold">{businessName}</span></p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Category: <span className="font-semibold">{category}</span></p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Location: <span className="font-semibold">{city}, {state}</span></p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            {/* Performance Benchmarks Table */}
            <div className="mb-8">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Your Business vs Category Averages</h4>
              <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Metric</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300">You</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300">Market Avg.</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300">Result</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {/* Revenue Row */}
                    <tr className="bg-white dark:bg-gray-900">
                      <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100">Revenue</td>
                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                        {formatCurrencyAbbreviated(calculatedMetrics.performanceRatings?.revenue?.userValue || 0)}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400 text-center">
                        {formatCurrencyAbbreviated(calculatedMetrics.performanceRatings?.revenue?.categoryMedian || 0)}
                      </td>
                      <td className="px-6 py-3 text-center">
                        {(() => {
                          const ratio = calculatedMetrics.performanceRatings?.revenue?.ratio || 0
                          const deviation = (ratio - 1) * 100
                          const isPositive = deviation >= 0
                          const displayValue = `${isPositive ? '+' : ''}${deviation.toFixed(1)}%`
                          
                          let pillColor = 'bg-gray-100 text-gray-700 border-gray-300'
                          if (ratio >= 1.1) {
                            pillColor = 'bg-green-100 text-green-700 border-green-300'
                          } else if (ratio < 0.9) {
                            pillColor = 'bg-red-100 text-red-700 border-red-300'
                          } else {
                            pillColor = 'bg-yellow-100 text-yellow-700 border-yellow-300'
                          }
                          
                          return (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${pillColor}`}>
                              {displayValue}
                            </span>
                          )
                        })()}
                      </td>
                    </tr>
                    
                    {/* Cash Flow Row */}
                    <tr className="bg-gray-50 dark:bg-gray-800">
                      <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100">Cash Flow</td>
                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                        {formatCurrencyAbbreviated(calculatedMetrics.performanceRatings?.cashflow?.userValue || 0)}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400 text-center">
                        {formatCurrencyAbbreviated(calculatedMetrics.performanceRatings?.cashflow?.categoryMedian || 0)}
                      </td>
                      <td className="px-6 py-3 text-center">
                        {(() => {
                          const ratio = calculatedMetrics.performanceRatings?.cashflow?.ratio || 0
                          const deviation = (ratio - 1) * 100
                          const isPositive = deviation >= 0
                          const displayValue = `${isPositive ? '+' : ''}${deviation.toFixed(1)}%`
                          
                          let pillColor = 'bg-gray-100 text-gray-700 border-gray-300'
                          if (ratio >= 1.1) {
                            pillColor = 'bg-green-100 text-green-700 border-green-300'
                          } else if (ratio < 0.9) {
                            pillColor = 'bg-red-100 text-red-700 border-red-300'
                          } else {
                            pillColor = 'bg-yellow-100 text-yellow-700 border-yellow-300'
                          }
                          
                          return (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${pillColor}`}>
                              {displayValue}
                            </span>
                          )
                        })()}
                      </td>
                    </tr>
                    
                    {/* Margin Row */}
                    <tr className="bg-white dark:bg-gray-900">
                      <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100">Margin</td>
                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                        {calculatedMetrics.performanceRatings?.margin?.userMargin?.toFixed(1) || 'N/A'}%
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400 text-center">
                        {calculatedMetrics.performanceRatings?.margin?.categoryMargin?.toFixed(1) || 'N/A'}%
                      </td>
                      <td className="px-6 py-3 text-center">
                        {(() => {
                          const ratio = calculatedMetrics.performanceRatings?.margin?.ratio || 0
                          const deviation = (ratio - 1) * 100
                          const isPositive = deviation >= 0
                          const displayValue = `${isPositive ? '+' : ''}${deviation.toFixed(1)}%`
                          
                          let pillColor = 'bg-gray-100 text-gray-700 border-gray-300'
                          if (ratio >= 1.1) {
                            pillColor = 'bg-green-100 text-green-700 border-green-300'
                          } else if (ratio < 0.9) {
                            pillColor = 'bg-red-100 text-red-700 border-red-300'
                          } else {
                            pillColor = 'bg-yellow-100 text-yellow-700 border-yellow-300'
                          }
                          
                          return (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${pillColor}`}>
                              {displayValue}
                            </span>
                          )
                        })()}
                      </td>
                    </tr>
                    
                    {/* Overall Result Row */}
                    <tr className="bg-gray-200 dark:bg-gray-600 border-t-2 border-gray-300 dark:border-gray-600">
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Overall</td>
                      <td colSpan={2} className="px-3 py-3"></td>
                      <td className="px-6 py-3 text-center">
                        {(() => {
                          const tier = calculatedMetrics.suggestedTier?.tier || 'AVERAGE'
                          let label = 'AVERAGE'
                          let pillColor = 'bg-yellow-100 text-yellow-700 border-yellow-300'
                          
                          if (tier === "PREMIUM") {
                            label = 'STRONG'
                            pillColor = 'bg-green-100 text-green-700 border-green-300'
                          } else if (tier === "BELOW_AVERAGE") {
                            label = 'FAIR'
                            pillColor = 'bg-red-100 text-red-700 border-red-300'
                          }
                          
                          return (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${pillColor}`}>
                              {label}
                            </span>
                          )
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Separator line below table */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700"></div>

            <div className="space-y-4 pt-4">
            {/* Revenue-Based Bar */}
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Revenue-Based Valuation</div>
              {(() => {
                const revenueMax = valuations.premium.revenueMethod.upper
                const rangeLow = valuations.average.revenueMethod.lower
                const rangeHigh = valuations.premium.revenueMethod.upper
                
                const maxValue = revenueMax * 1.1
                const minValue = 0
                
                const formatPriceK = (value: number) => {
                  if (value >= 1000000) {
                    return `$${(value / 1000000).toFixed(2)}M`
                  } else if (value >= 1000) {
                    return `$${Math.round(value / 1000)}K`  // No decimals for K
                  }
                  return `$${Math.round(value)}`
                }
                
                const rangeLowPos = maxValue > minValue ? ((rangeLow - minValue) / (maxValue - minValue)) * 100 : 0
                const rangeHighPos = maxValue > minValue ? ((rangeHigh - minValue) / (maxValue - minValue)) * 100 : 0
                
                return (
                  <>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatPriceK(minValue)}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatPriceK(maxValue)}</span>
                    </div>
                    
                    <div className="relative w-full h-8 bg-gradient-to-r from-green-500 via-yellow-400 via-orange-500 to-red-500 rounded-2xl mb-4">
                      <div 
                        className="absolute"
                        style={{
                          top: '-3px',
                          left: `${rangeLowPos}%`,
                          width: `${rangeHighPos - rangeLowPos}%`,
                          height: '38px',
                          borderRadius: '6px',
                          background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.6) 0%, rgba(37, 99, 235, 0.6) 25%, rgba(150, 180, 245, 0.65) 50%, rgba(220, 230, 250, 0.7) 75%, rgba(255, 255, 255, 0.7) 100%)',
                          border: '3px solid #ffffff',
                          boxSizing: 'border-box',
                          boxShadow: '0 0 0 1px #d1d5db'
                        }}
                      />
                    </div>
                    
                    <div className="flex gap-4 justify-center mt-4 mb-6">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <div 
                          className="w-4 h-4 rounded border-2 bg-blue-600 border-blue-700"
                        />
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Average Range: {formatPriceK(valuations.average.revenueMethod.lower)}-{formatPriceK(valuations.average.revenueMethod.upper)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <div 
                          className="w-4 h-4 rounded border-2 bg-white border-gray-300"
                        />
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Premium Range: {formatPriceK(valuations.premium.revenueMethod.lower)}-{formatPriceK(valuations.premium.revenueMethod.upper)}
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Cash Flow-Based Bar */}
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Cash Flow-Based Valuation</div>
              {(() => {
                const sdeMax = valuations.premium.sdeMethod.upper
                const rangeLow = valuations.average.sdeMethod.lower
                const rangeHigh = valuations.premium.sdeMethod.upper
                
                const maxValue = sdeMax * 1.1
                const minValue = 0
                
                const formatPriceK = (value: number) => {
                  if (value >= 1000000) {
                    return `$${(value / 1000000).toFixed(2)}M`
                  } else if (value >= 1000) {
                    return `$${Math.round(value / 1000)}K`  // No decimals for K
                  }
                  return `$${Math.round(value)}`
                }
                
                const rangeLowPos = maxValue > minValue ? ((rangeLow - minValue) / (maxValue - minValue)) * 100 : 0
                const rangeHighPos = maxValue > minValue ? ((rangeHigh - minValue) / (maxValue - minValue)) * 100 : 0
                
                return (
                  <>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatPriceK(minValue)}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatPriceK(maxValue)}</span>
                    </div>
                    
                    <div className="relative w-full h-8 bg-gradient-to-r from-green-500 via-yellow-400 via-orange-500 to-red-500 rounded-2xl mb-4">
                      <div 
                        className="absolute"
                        style={{
                          top: '-3px',
                          left: `${rangeLowPos}%`,
                          width: `${rangeHighPos - rangeLowPos}%`,
                          height: '38px',
                          borderRadius: '6px',
                          background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.6) 0%, rgba(37, 99, 235, 0.6) 25%, rgba(150, 180, 245, 0.65) 50%, rgba(220, 230, 250, 0.7) 75%, rgba(255, 255, 255, 0.7) 100%)',
                          border: '3px solid #ffffff',
                          boxSizing: 'border-box',
                          boxShadow: '0 0 0 1px #d1d5db'
                        }}
                      />
          </div>
                    
                    <div className="flex gap-4 justify-center mt-4 mb-6">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <div 
                          className="w-4 h-4 rounded border-2 bg-blue-600 border-blue-700"
                        />
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Average Range: {formatPriceK(valuations.average.sdeMethod.lower)}-{formatPriceK(valuations.average.sdeMethod.upper)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <div 
                          className="w-4 h-4 rounded border-2 bg-white border-gray-300"
                        />
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Premium Range: {formatPriceK(valuations.premium.sdeMethod.lower)}-{formatPriceK(valuations.premium.sdeMethod.upper)}
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>

          {/* Separator and Description */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              <p>
                <span className="font-semibold text-gray-600 dark:text-gray-300">Premium Businesses</span> represent the top 25% of businesses in this category, characterized by superior performance metrics, stronger market positioning, higher profit margins, and favorable operational characteristics.
              </p>
              <p>
                <span className="font-semibold text-gray-600 dark:text-gray-300">Average Businesses</span> represent typical market performance for this category, with standard financial metrics and operational characteristics that align with industry norms.
              </p>
            </div>
            
            {/* Separator line below explanations */}
            <div className="mt-6 pt-8 border-t border-gray-200 dark:border-gray-700">
              {/* Potential Valuation with dynamic brushed-metal sheen */}
              {(() => {
                const tier = calculatedMetrics.suggestedTier?.tier || 'AVERAGE'

                // Base colors per tier
                let baseColor = '#fef3c7' // yellow-100
                let accentColor = '#fcd34d' // yellow-400
                let textColor = 'text-yellow-900'
                let borderColor = 'border-yellow-300'

                if (tier === 'PREMIUM') {
                  baseColor = '#dcfce7' // green-100
                  accentColor = '#4ade80' // green-400
                  textColor = 'text-green-900'
                  borderColor = 'border-green-300'
                } else if (tier === 'BELOW_AVERAGE') {
                  baseColor = '#fee2e2' // red-100
                  accentColor = '#f87171' // red-400
                  textColor = 'text-red-900'
                  borderColor = 'border-red-300'
                }

                return (
                  <div className="transition-all hover:shadow-lg">
                    <div 
                      className={`rounded-lg border-2 ${borderColor} relative overflow-hidden`}
                      style={{
                        background: `linear-gradient(135deg, ${baseColor} 0%, rgba(255,255,255,0.9) 25%, ${baseColor} 50%, rgba(255,255,255,0.7) 75%, ${baseColor} 100%)`,
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.04)'
                      }}
                    >
                    {/* Subtle sheen overlay stripes */}
                    <div 
                      className="absolute inset-0 opacity-25"
                      style={{
                        background: `linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)`
                      }}
                    />

                    <div className={`relative z-10 ${textColor}`}>
                      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-base font-semibold">Your Range</div>
                            <p className="text-sm mt-1 opacity-90">
                              Based on industry averages, not a custom appraisal.
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setValuationExpanded(!valuationExpanded)}
                            className="flex items-center gap-1 ml-4"
                          >
                            {valuationExpanded ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                <span>Collapse</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                <span>Expand</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      {valuationExpanded && (
                        <div className="p-4">
                          <div className="text-3xl font-bold mb-3">
                            {formatCurrencyAbbreviated(calculatedMetrics.recommendedRange?.blended?.lower || 0)} - {formatCurrencyAbbreviated(calculatedMetrics.recommendedRange?.blended?.upper || 0)}
                          </div>
                          <p className="text-sm opacity-90">
                            <span className="font-semibold">Sign up to get fully customized deep insights, market trends, and pricing strategies you need to win.</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                )
              })()}
            </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Context */}
      <Card className="transition-all hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600">
        <CardHeader>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Market Context</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Industry trends and demand indicators for {category}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Transaction Frequency */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Transaction Frequency</div>
              <div className="flex items-center justify-center mb-4">
                {(() => {
                  const gaugeState = getTransactionFrequencyState()
                  return <Gauge state={gaugeState.state} positions={gaugeState.positions} id="transaction-frequency" />
                })()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {getTransactionFrequencyText()}
              </div>
            </div>

            {/* Transaction Speed */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Transaction Speed</div>
              <div className="flex items-center justify-center mb-4">
                {(() => {
                  const gaugeState = getTransactionSpeedState()
                  return <Gauge state={gaugeState.state} positions={gaugeState.positions} id="transaction-speed" />
                })()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {getTransactionSpeedText()}
              </div>
            </div>

            {/* Sales Price vs Asking */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Sales Price vs Asking</div>
              <div className="flex items-center justify-center mb-4">
                {(() => {
                  const gaugeState = getSalesPriceVsAskingState()
                  return <Gauge state={gaugeState.state} positions={gaugeState.positions} id="sales-price-vs-asking" />
                })()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {getSalesPriceVsAskingText()}
              </div>
            </div>

            {/* Revenue Multiple Ranking */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Revenue Multiples</div>
              <div className="flex items-center justify-center mb-4">
                {(() => {
                  const gaugeState = getRevenueMultipleState()
                  return <Gauge state={gaugeState.state} positions={gaugeState.positions} id="revenue-multiple" />
                })()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {getRevenueMultipleText()}
              </div>
            </div>

            {/* Cash Flow Multiple Ranking */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Cash Flow Multiples</div>
              <div className="flex items-center justify-center mb-4">
                {(() => {
                  const gaugeState = getCashFlowMultipleState()
                  return <Gauge state={gaugeState.state} positions={gaugeState.positions} id="cash-flow-multiple" />
                })()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {getCashFlowMultipleText()}
              </div>
            </div>

            {/* Market Trend */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Market Trend</div>
              <div className="flex items-center justify-center mb-4">
                {(() => {
                  const gaugeState = getMarketTrendState()
                  return <Gauge state={gaugeState.state} positions={gaugeState.positions} id="market-trend" />
                })()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {getMarketTrendText()}
              </div>
            </div>
          </div>

          {/* Market Intelligence Sub-Card */}
          {benchmarks.notes && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="transition-all hover:shadow-lg">
                <div 
                  className="rounded-lg border-2 border-gray-300 dark:border-gray-600 relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, #f3f4f6 0%, rgba(255,255,255,0.9) 25%, #e5e7eb 50%, rgba(255,255,255,0.7) 75%, #f3f4f6 100%)`,
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.04)'
                  }}
                >
                {/* Subtle sheen overlay stripes */}
                <div 
                  className="absolute inset-0 opacity-25"
                  style={{
                    background: `linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)`
                  }}
                />
                <div className="relative z-10">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-800">Market Intelligence</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-700 mt-1">
                          Insights for {category}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setNotesExpanded(!notesExpanded)}
                        className="flex items-center gap-1 text-gray-700 dark:text-gray-800 hover:text-white dark:hover:text-white"
                      >
                        {notesExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            <span>Collapse</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            <span>Expand</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {notesExpanded && (
                    <div className="p-4">
                      <div className="prose prose-sm max-w-none text-sm text-gray-600 dark:text-gray-800 whitespace-pre-wrap">
                        {benchmarks.notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Maps Embed */}
      <Card className="transition-all hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600">
        <CardHeader>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Nearby Businesses</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Explore similar businesses in your area
          </p>
        </CardHeader>
        <CardContent>
          <div className="transition-all hover:shadow-lg rounded-lg">
            <GoogleMapsEmbed
              city={city}
              state={state}
              categoryTitle={category}
              className="rounded-lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Conversion CTA */}
      <div className="text-center space-y-6 py-8">
        {/* Heading and checkmark list - centered container with left-aligned items */}
        <div className="flex justify-center">
          <div className="text-left">
            <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Don't miss out on actionable insights:</h3>
            <ul className="space-y-2 text-base sm:text-lg md:text-xl text-muted-foreground">
            <li className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
              <span>Detailed valuation of YOUR business</span>
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
              <span>Localized customer & market analysis</span>
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
              <span>Negotiation and price recommendations</span>
            </li>
          </ul>
          </div>
        </div>
        
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Know your worth and close deals at the right price.
        </p>
        <div className="pt-4">
          {onSignUpClick ? (
            <Button
              size="lg"
              onClick={onSignUpClick}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-12 py-7 text-xl rounded-full shadow-lg hover:shadow-xl transition-all w-full sm:w-auto lg:w-[464px] xl:w-[528px]"
            >
              Unlock Full Analysis
            </Button>
          ) : (
            <Link href="/start">
              <Button
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-12 py-7 text-xl rounded-full shadow-lg hover:shadow-xl transition-all w-full sm:w-auto lg:w-[464px] xl:w-[528px]"
              >
                Unlock Full Analysis
              </Button>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  )
}
