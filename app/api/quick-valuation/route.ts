import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface RequestBody {
  businessName: string
  categoryId: number
  categoryTitle: string
  state: string
  city: string
  revenue: number
  sde: number
  additionalInfo?: string
  email: string
  userType: 'buyer' | 'seller'
  wantsContact?: boolean
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase admin client is not configured' },
      { status: 500 }
    )
  }

  try {
    const body: RequestBody = await request.json()

    // Validate required fields
    if (!body.businessName?.trim()) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    }
    if (!body.categoryId || typeof body.categoryId !== 'number') {
      return NextResponse.json({ error: 'Valid category ID is required' }, { status: 400 })
    }
    if (!body.state?.trim()) {
      return NextResponse.json({ error: 'State is required' }, { status: 400 })
    }
    if (!body.city?.trim()) {
      return NextResponse.json({ error: 'City is required' }, { status: 400 })
    }
    if (!body.revenue || body.revenue <= 0) {
      return NextResponse.json({ error: 'Valid revenue amount is required' }, { status: 400 })
    }
    if (!body.sde || body.sde <= 0) {
      return NextResponse.json({ error: 'Valid SDE/Cash Flow amount is required' }, { status: 400 })
    }
    if (!body.email?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (!body.userType || !['buyer', 'seller'].includes(body.userType)) {
      return NextResponse.json({ error: 'User type must be buyer or seller' }, { status: 400 })
    }

    // Query category data by ID
    const { data: categoryData, error: categoryError } = await supabaseAdmin
      .from('lead_magnet_valuations')
      .select('*')
      .eq('id', body.categoryId)
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

    // Calculate valuations using CORRECT formulas from spec
    const userRevenue = body.revenue
    const userSDE = body.sde

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

    // 5. Profit Margin Benchmark (user vs CATEGORY, not market)
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

    // Calculate Market Context Metrics
    // 1. Transaction Frequency (reuse variables from supplyLevel calculation above)
    let transactionFrequencyStatus = "bad"
    let transactionFrequencyText = "Sells significantly less often than other small business categories"
    if (categorySalesCount >= salesQ3) {
      transactionFrequencyStatus = "good"
      transactionFrequencyText = "Sells more often than other small business categories"
    } else if (categorySalesCount >= salesQ2) {
      transactionFrequencyStatus = "average"
      transactionFrequencyText = "Sells in line with other small business categories"
    } else if (categorySalesCount >= salesQ1) {
      transactionFrequencyStatus = "average"
      transactionFrequencyText = "Sells less frequently than other small business categories"
    }

    // 2. Transaction Speed (reuse variables from timeToSell calculation above)
    let transactionSpeedStatus = "bad"
    let transactionSpeedText = `Takes ${Math.abs(daysDifference)} days longer to sell than the market average`
    if (daysDifference < -10) {
      transactionSpeedStatus = "good"
      transactionSpeedText = `Typically sells ${Math.abs(daysDifference)} days faster than the market average`
    } else if (daysDifference >= -10 && daysDifference <= 10) {
      transactionSpeedStatus = "average"
      transactionSpeedText = "Sells at a typical pace compared to other small business categories"
    }

    // 3. Sales Price vs Asking (reuse categoryRatio and marketAverage from competitivePricingIndex)
    const marketRatio = marketAverages.avg_sale_to_ask_ratio || 0
    const ratioDifference = categoryRatio - marketRatio
    
    let salesPriceVsAskingStatus = "bad"
    let salesPriceVsAskingText = "More discounting occurs, with sales prices falling further below asking prices"
    if (ratioDifference > 0.02) {
      salesPriceVsAskingStatus = "good"
      salesPriceVsAskingText = "Transacted prices are typically close to or above asking price"
    } else if (ratioDifference >= -0.02 && ratioDifference <= 0.02) {
      salesPriceVsAskingStatus = "average"
      salesPriceVsAskingText = "Average discounts and close prices to asking price"
    }

    // 4. Revenue Multiple Ranking (already calculated above, but need status)
    let revenueMultipleStatus = "bad"
    let revenueMultipleText = "Lower revenue multiples compared to most categories"
    if (categoryRevenueMultiple >= revenueQ3) {
      revenueMultipleStatus = "good"
      revenueMultipleText = "Commands higher revenue multiples than most categories"
    } else if (categoryRevenueMultiple >= revenueQ2) {
      revenueMultipleStatus = "average"
      revenueMultipleText = "Revenue multiples are above the median"
    } else if (categoryRevenueMultiple >= revenueQ1) {
      revenueMultipleStatus = "average"
      revenueMultipleText = "Revenue multiples are below the median"
    }

    // 5. Cash Flow Multiple Ranking (already calculated above, but need status)
    let cashFlowMultipleStatus = "bad"
    let cashFlowMultipleText = "Lower cash flow multiples compared to most categories"
    if (categorySDEMultiple >= sdeQ3) {
      cashFlowMultipleStatus = "good"
      cashFlowMultipleText = "Commands higher cash flow multiples than most categories"
    } else if (categorySDEMultiple >= sdeQ2) {
      cashFlowMultipleStatus = "average"
      cashFlowMultipleText = "Cash flow multiples are above the median"
    } else if (categorySDEMultiple >= sdeQ1) {
      cashFlowMultipleStatus = "average"
      cashFlowMultipleText = "Cash flow multiples are below the median"
    }

    // 6. Market Trend
    const trendDirection = categoryData.trend_direction || 'unknown'
    const trendLower = trendDirection.toLowerCase()
    
    let marketTrendStatus = "average"
    let marketTrendText = "Market demand expected to remain the same"
    if (trendLower.includes('growing') || trendLower.includes('increasing')) {
      marketTrendStatus = "good"
      marketTrendText = "Market demand expected to be growing"
    } else if (trendLower.includes('declining') || trendLower.includes('decreasing')) {
      marketTrendStatus = "bad"
      marketTrendText = "Market demand expected to decline"
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

    // Insert lead into lead_magnet_entries (CORRECT table name)
    const { data: leadData, error: leadError } = await supabaseAdmin
      .from('lead_magnet_entries')
      .insert({
        email: body.email.toLowerCase().trim(),
        business_name: body.businessName.trim(),
        business_category_title: body.categoryTitle,
        revenue: body.revenue,
        sde: body.sde,
        location_city: body.city.trim(),
        location_state: body.state,
        additional_information: body.additionalInfo?.trim() || null,
        user_type: body.userType,
        wants_contact: body.wantsContact || false,
        pdf_sent: false,
        converted_to_paid: false,
      })
      .select('id')
      .single()

    if (leadError) {
      console.error('Error inserting lead:', leadError)
      return NextResponse.json(
        { error: 'Failed to save lead data' },
        { status: 500 }
      )
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
          },
          marketContext: {
            transactionFrequency: {
              status: transactionFrequencyStatus,
              text: transactionFrequencyText
            },
            transactionSpeed: {
              status: transactionSpeedStatus,
              text: transactionSpeedText
            },
            salesPriceVsAsking: {
              status: salesPriceVsAskingStatus,
              text: salesPriceVsAskingText
            },
            revenueMultipleRanking: {
              status: revenueMultipleStatus,
              text: revenueMultipleText
            },
            cashFlowMultipleRanking: {
              status: cashFlowMultipleStatus,
              text: cashFlowMultipleText
            },
            marketTrend: {
              status: marketTrendStatus,
              text: marketTrendText
            }
          }
        },
        leadId: leadData.id,
      },
    })
  } catch (error) {
    console.error('Quick valuation API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to calculate valuation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

