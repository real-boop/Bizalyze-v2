import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase admin client is not configured' },
      { status: 500 }
    )
  }

  try {
    const { id } = await params
    const leadId = id

    // Fetch lead data from database
    const { data: leadData, error: leadError } = await supabaseAdmin
      .from('lead_magnet_entries')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !leadData) {
      console.error('Lead lookup error:', leadError)
      return NextResponse.json(
        { error: 'Valuation not found' },
        { status: 404 }
      )
    }

    // Find category by title (we need categoryId for calculations)
    const { data: categoryData, error: categoryError } = await supabaseAdmin
      .from('lead_magnet_valuations')
      .select('*')
      .eq('title', leadData.business_category_title)
      .single()

    if (categoryError || !categoryData) {
      console.error('Category lookup error:', categoryError)
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Fetch market averages
    const { data: marketAverages, error: marketError } = await supabaseAdmin
      .from('lead_magnet_averages')
      .select('*')
      .eq('id', 1)
      .single()

    if (marketError || !marketAverages) {
      console.error('Market averages lookup error:', marketError)
      return NextResponse.json(
        { error: 'Failed to load market data' },
        { status: 500 }
      )
    }

    // Recalculate valuations (same logic as POST route)
    const userRevenue = leadData.revenue
    const userSDE = leadData.sde

    // PREMIUM TIER
    const premiumRevenueLower = userRevenue * (categoryData.revenue_good_lower || 0)
    const premiumRevenueUpper = userRevenue * (categoryData.revenue_good_upper || 0)
    const premiumSDELower = userSDE * (categoryData.sde_good_lower || 0)
    const premiumSDEUpper = userSDE * (categoryData.sde_good_upper || 0)

    // AVERAGE TIER
    const averageRevenueLower = userRevenue * (categoryData.revenue_avg_lower || 0)
    const averageRevenueUpper = userRevenue * (categoryData.revenue_avg_upper || 0)
    const averageSDELower = userSDE * (categoryData.sde_avg_lower || 0)
    const averageSDEUpper = userSDE * (categoryData.sde_avg_upper || 0)

    // 1. Competitive Pricing Index
    const categoryRatio = categoryData.sales_to_asking_price_avg || 0
    const marketAverage = marketAverages.avg_sale_to_ask_ratio || 0
    const competitivePricingIndex = marketAverage > 0 
      ? ((categoryRatio / marketAverage) - 1) * 100 
      : 0

    // 2. Revenue Multiple Ranking
    const categoryRevenueMultiple = categoryData.revenue_multiple_avg || 0
    const revenueQ1 = marketAverages.revenue_multiple_q1 || 0
    const revenueQ2 = marketAverages.revenue_multiple_q2 || 0
    const revenueQ3 = marketAverages.revenue_multiple_q3 || 0

    let revenueQuartile = "Bottom Quartile (Bottom 25%)"
    let revenueColor = "red"
    if (categoryRevenueMultiple >= revenueQ3) {
      revenueQuartile = "Top Quartile (Top 25%)"
      revenueColor = "dark-green"
    } else if (categoryRevenueMultiple >= revenueQ2) {
      revenueQuartile = "Above Average (50-75%)"
      revenueColor = "light-green"
    } else if (categoryRevenueMultiple >= revenueQ1) {
      revenueQuartile = "Below Average (25-50%)"
      revenueColor = "yellow"
    }

    // 3. SDE Multiple Ranking
    const categorySDEMultiple = categoryData.cashflow_multiple_avg || 0
    const sdeQ1 = marketAverages.sde_multiple_q1 || 0
    const sdeQ2 = marketAverages.sde_multiple_q2 || 0
    const sdeQ3 = marketAverages.sde_multiple_q3 || 0

    let sdeQuartile = "Bottom Quartile (Bottom 25%)"
    let sdeColor = "red"
    if (categorySDEMultiple >= sdeQ3) {
      sdeQuartile = "Top Quartile (Top 25%)"
      sdeColor = "dark-green"
    } else if (categorySDEMultiple >= sdeQ2) {
      sdeQuartile = "Above Average (50-75%)"
      sdeColor = "light-green"
    } else if (categorySDEMultiple >= sdeQ1) {
      sdeQuartile = "Below Average (25-50%)"
      sdeColor = "yellow"
    }

    // 4. Time to Sell
    const categoryDays = categoryData.median_days_on_market || 0
    const marketAvgDays = marketAverages.avg_days_on_market || 0
    const daysDifference = categoryDays - marketAvgDays

    // 5. Profit Margin Benchmark
    const userMargin = userRevenue > 0 ? (userSDE / userRevenue) * 100 : 0
    
    // Parse numeric values from PostgreSQL (they come as strings)
    const categoryMedianRevenue = Number(categoryData.median_revenue) || 0
    const categoryMedianCashFlow = Number(categoryData.median_cash_flow) || 0
    
    const categoryMargin = categoryMedianRevenue > 0 && categoryMedianCashFlow > 0
      ? (categoryMedianCashFlow / categoryMedianRevenue) * 100
      : 0
    const marginDifference = userMargin - categoryMargin

    let profitMarginDisplay = ""
    let profitMarginBadge = ""
    let profitMarginColor = "gray"
    if (marginDifference >= 5) {
      profitMarginDisplay = `${marginDifference.toFixed(1)}% above category average`
      profitMarginBadge = "Strong profitability"
      profitMarginColor = "green"
    } else if (marginDifference >= -5) {
      profitMarginDisplay = `${Math.abs(marginDifference).toFixed(1)}% ${marginDifference >= 0 ? 'above' : 'below'} category average`
      profitMarginBadge = "Average profitability"
      profitMarginColor = "yellow"
    } else {
      profitMarginDisplay = `${Math.abs(marginDifference).toFixed(1)}% below category average`
      profitMarginBadge = "Below average profitability"
      profitMarginColor = "red"
    }

    // 6. NEW: Calculate performance ratings using ±10% threshold
    // Revenue Rating
    const revenueRatio = categoryMedianRevenue > 0 
      ? userRevenue / categoryMedianRevenue 
      : 0
    let revenueRating = "AVERAGE"
    if (revenueRatio >= 1.1) {
      revenueRating = "BETTER"
    } else if (revenueRatio < 0.9) {
      revenueRating = "WORSE"
    }

    // Cash Flow Rating
    const cashflowRatio = categoryMedianCashFlow > 0
      ? userSDE / categoryMedianCashFlow
      : 0
    let cashflowRating = "AVERAGE"
    if (cashflowRatio >= 1.1) {
      cashflowRating = "BETTER"
    } else if (cashflowRatio < 0.9) {
      cashflowRating = "WORSE"
    }

    // Margin Rating (convert to ratio)
    const marginRatio = categoryMargin > 0 ? userMargin / categoryMargin : 0
    let marginRating = "AVERAGE"
    if (marginRatio >= 1.1) {
      marginRating = "BETTER"
    } else if (marginRatio < 0.9) {
      marginRating = "WORSE"
    }

    // Calculate Tier Score
    let tierScore = 0
    if (revenueRating === "BETTER") tierScore += 1
    else if (revenueRating === "WORSE") tierScore -= 1

    if (cashflowRating === "BETTER") tierScore += 1
    else if (cashflowRating === "WORSE") tierScore -= 1

    if (marginRating === "BETTER") tierScore += 1
    else if (marginRating === "WORSE") tierScore -= 1

    // Determine Suggested Tier based on score
    let suggestedTier = "AVERAGE"
    let tierScoreLabel = "AVERAGE"
    if (tierScore >= 2) {
      suggestedTier = "PREMIUM"
      tierScoreLabel = "PREMIUM"
    } else if (tierScore <= -2) {
      suggestedTier = "BELOW_AVERAGE"
      tierScoreLabel = "BELOW AVERAGE"
    }

    // Calculate recommended valuation ranges based on suggested tier
    let recommendedRevenueLower = 0
    let recommendedRevenueUpper = 0
    let recommendedSDELower = 0
    let recommendedSDEUpper = 0

    if (suggestedTier === "PREMIUM") {
      recommendedRevenueLower = Math.round(userRevenue * (categoryData.revenue_good_lower || 0))
      recommendedRevenueUpper = Math.round(userRevenue * (categoryData.revenue_good_upper || 0))
      recommendedSDELower = Math.round(userSDE * (categoryData.sde_good_lower || 0))
      recommendedSDEUpper = Math.round(userSDE * (categoryData.sde_good_upper || 0))
    } else if (suggestedTier === "BELOW_AVERAGE") {
      // 20% discount on average ranges
      recommendedRevenueLower = Math.round(userRevenue * (categoryData.revenue_avg_lower || 0) * 0.8)
      recommendedRevenueUpper = Math.round(userRevenue * (categoryData.revenue_avg_upper || 0) * 0.8)
      recommendedSDELower = Math.round(userSDE * (categoryData.sde_avg_lower || 0) * 0.8)
      recommendedSDEUpper = Math.round(userSDE * (categoryData.sde_avg_upper || 0) * 0.8)
    } else {
      // AVERAGE tier
      recommendedRevenueLower = Math.round(userRevenue * (categoryData.revenue_avg_lower || 0))
      recommendedRevenueUpper = Math.round(userRevenue * (categoryData.revenue_avg_upper || 0))
      recommendedSDELower = Math.round(userSDE * (categoryData.sde_avg_lower || 0))
      recommendedSDEUpper = Math.round(userSDE * (categoryData.sde_avg_upper || 0))
    }

    // Calculate blended recommended range
    const recommendedBlendedLower = Math.min(recommendedRevenueLower, recommendedSDELower)
    const recommendedBlendedUpper = Math.max(recommendedRevenueUpper, recommendedSDEUpper)

    // 7. Business Quality Tier (keep for backward compatibility)
    const revenueValuation = userRevenue * (categoryData.revenue_multiple_avg || 0)
    const sdeValuation = userSDE * (categoryData.cashflow_multiple_avg || 0)
    const blendedValuation = (revenueValuation + sdeValuation) / 2
    const impliedMultiple = userSDE > 0 ? blendedValuation / userSDE : 0

    const premiumThreshold = categoryData.sde_good_lower || 0
    const averageThreshold = categoryData.sde_avg_lower || 0

    let businessTier = "BELOW AVERAGE"
    let tierDescription = "Bottom 25%"
    let tierColor = "gray"
    let tierMessage = "Your business may benefit from operational improvements to increase value."
    if (impliedMultiple >= premiumThreshold) {
      businessTier = "PREMIUM TIER"
      tierDescription = "Top 25%"
      tierColor = "gold"
      tierMessage = "Your business demonstrates strong fundamentals and above-average performance."
    } else if (impliedMultiple >= averageThreshold) {
      businessTier = "AVERAGE TIER"
      tierDescription = "Middle 50%"
      tierColor = "blue"
      tierMessage = "Your business shows typical performance for this category."
    }

    // 8. Supply Side / Market Data Sample Size
    const categorySalesCount = categoryData.reported_sales_count || 0
    const salesQ1 = marketAverages.sales_count_q1 || 0
    const salesQ2 = marketAverages.sales_count_q2 || 0
    const salesQ3 = marketAverages.sales_count_q3 || 0

    let supplyLevel = "Low Supply (Bottom 25%)"
    let supplyColor = "red"
    let supplyReliability = "Limited data - use with caution"
    if (categorySalesCount >= salesQ3) {
      supplyLevel = "High Supply (Top 25%)"
      supplyColor = "green"
      supplyReliability = "High data reliability"
    } else if (categorySalesCount >= salesQ2) {
      supplyLevel = "Above Average Supply (50-75%)"
      supplyColor = "light-green"
      supplyReliability = "Good data reliability"
    } else if (categorySalesCount >= salesQ1) {
      supplyLevel = "Below Average Supply (25-50%)"
      supplyColor = "yellow"
      supplyReliability = "Moderate data reliability"
    }

    // Prepare benchmarks data
    const benchmarks = {
      medianSalePrice: categoryData.median_sale_price || 0,
      reportedSales: categoryData.reported_sales_count || 0,
      daysOnMarket: categoryData.median_days_on_market || 0,
      salesToAskingRatio: categoryData.sales_to_asking_price_avg || 0,
      trendDirection: categoryData.trend_direction || 'unknown',
      demandLevel: categoryData.demand_level || 'unknown',
      notes: categoryData.notes || null,
    }

    // Return results with separate revenue/SDE methods
    return NextResponse.json({
      success: true,
      results: {
        valuations: {
          premium: {
            revenueMethod: {
              lower: Math.round(premiumRevenueLower),
              upper: Math.round(premiumRevenueUpper),
            },
            sdeMethod: {
              lower: Math.round(premiumSDELower),
              upper: Math.round(premiumSDEUpper),
            },
          },
          average: {
            revenueMethod: {
              lower: Math.round(averageRevenueLower),
              upper: Math.round(averageRevenueUpper),
            },
            sdeMethod: {
              lower: Math.round(averageSDELower),
              upper: Math.round(averageSDEUpper),
            },
          },
        },
        benchmarks,
        calculatedMetrics: {
          competitivePricingIndex: {
            value: competitivePricingIndex,
            display: competitivePricingIndex >= 0 
              ? `Above Market: +${competitivePricingIndex.toFixed(1)}%`
              : `Below Market: ${competitivePricingIndex.toFixed(1)}%`,
            color: competitivePricingIndex >= 0 ? "green" : "red"
          },
          revenueMultipleRanking: {
            quartile: revenueQuartile,
            color: revenueColor
          },
          sdeMultipleRanking: {
            quartile: sdeQuartile,
            color: sdeColor
          },
          timeToSell: {
            difference: daysDifference,
            display: daysDifference < 0
              ? `${Math.abs(daysDifference)} days faster than average`
              : `${daysDifference} days slower than average`,
            color: daysDifference < 0 ? "green" : "red"
          },
          profitMargin: {
            userMargin: userMargin,
            categoryMargin: categoryMargin,
            difference: marginDifference,
            display: profitMarginDisplay,
            badge: profitMarginBadge,
            color: profitMarginColor
          },
          businessTier: {
            tier: businessTier,
            description: tierDescription,
            color: tierColor,
            message: tierMessage
          },
          supplyLevel: {
            quartile: supplyLevel,
            salesCount: categorySalesCount,
            reliability: supplyReliability,
            color: supplyColor
          },
          performanceRatings: {
            revenue: {
              rating: revenueRating,
              userValue: userRevenue,
              categoryMedian: categoryMedianRevenue,
              ratio: revenueRatio
            },
            cashflow: {
              rating: cashflowRating,
              userValue: userSDE,
              categoryMedian: categoryMedianCashFlow,
              ratio: cashflowRatio
            },
            margin: {
              rating: marginRating,
              userMargin: userMargin,
              categoryMargin: categoryMargin,
              ratio: marginRatio
            }
          },
          suggestedTier: {
            tier: suggestedTier,
            tierScore: tierScore,
            tierLabel: tierScoreLabel
          },
          recommendedRange: {
            revenueMethod: {
              lower: recommendedRevenueLower,
              upper: recommendedRevenueUpper
            },
            sdeMethod: {
              lower: recommendedSDELower,
              upper: recommendedSDEUpper
            },
            blended: {
              lower: recommendedBlendedLower,
              upper: recommendedBlendedUpper
            }
          }
        },
        leadId: leadData.id,
      },
      // Include lead data for display
      leadData: {
        businessName: leadData.business_name,
        category: leadData.business_category_title,
        city: leadData.location_city,
        state: leadData.location_state,
      }
    })
  } catch (error) {
    console.error('Valuation fetch API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch valuation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

