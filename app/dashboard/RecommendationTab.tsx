import React, { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader } from "./components/UIComponents"

interface RecommendationTabProps {
  businessId: string
  expandAllDetails?: boolean
}

interface RecommendationData {
  ideal_range_low: number | null
  ideal_range_high: number | null
  ideal_range_description: string | null
  great_deal_price: number | null
  great_deal_description: string | null
  current_price: number | null
  current_price_description: string | null
  strength_1: string | null
  strength_2: string | null
  strength_3: string | null
  strength_4: string | null
  strength_5: string | null
  weakness_1: string | null
  weakness_2: string | null
  weakness_3: string | null
  weakness_4: string | null
  weakness_5: string | null
  verdict: string | null
  negotiation_focus: string | null
  recommendation_status?: string | null;
  weighted_average_score: number | null;
  operational_commentary: string | null;
  soft_factors_commentary: string | null;
  demographics_commentary: string | null;
  location_commentary: string | null;
  ideal_sde_range_low: number | null;
  ideal_sde_range_high: number | null;
  ideal_revenue_range_low: number | null;
  ideal_revenue_range_high: number | null;
  fair_range_description: string | null;
  current_price_assessment: string | null;
  overall_recommendation: string | null;
  // ADDED: Operational data from operational_score
  revenue: number | null;
  cash_flow: number | null;
  revenue_multiple_result: string | null;
  sde_multiple_result: string | null;
  price_multiplier: number | null;
  operational_score: number | null;
  soft_factors_score: number | null;
  demographics_score: number | null;
  location_score: number | null;
}

// ADDED: Business category price benchmarks interface
interface PriceBenchmarks {
  sde_multiple: {
    bad: string;
    good: string;
    average: string;
    market_average: number;
  };
  median_revenue: number;
  median_cash_flow: number;
  revenue_multiple: {
    bad: string;
    good: string;
    average: string;
    market_average: number;
  };
  median_asking_price: number;
  median_selling_price: number;
  reported_sales_count: number;
  median_days_on_market: number;
  sales_to_asking_ratio: number;
}

// EXACT COPY of ScoreGauge from CompetitionTab
const ScoreGauge = ({ score, color }: { score: number; color: string }) => {
  // Convert score to 0-10 scale and calculate angle
  const normalizedScore = Math.min(Math.max(score, 0), 10); // Clamp between 0-10
  const angle = 180 - (normalizedScore / 10) * 180;
  
  return (
    <div className="relative w-20 h-10 md:w-24 md:h-12 -mr-2 mt-1">
      <svg className="w-full h-full" viewBox="0 0 100 60">
        {/* Colored arc background - moved down slightly */}
        <path
          d="M 10 48 A 40 40 0 0 1 90 48"
          fill="none"
          stroke={color}
          strokeWidth="4"
        />
        
        {/* 10 tick marks (0 to 10) - adjusted vertical position */}
        {[...Array(11)].map((_, i) => {
          const tickAngle = (i / 10) * 180; // 0 to 180 degrees (left to right)
          const x1 = 50 + 33 * Math.cos(tickAngle * Math.PI / 180);
          const y1 = 48 - 33 * Math.sin(tickAngle * Math.PI / 180);
          const x2 = 50 + 37 * Math.cos(tickAngle * Math.PI / 180);
          const y2 = 48 - 37 * Math.sin(tickAngle * Math.PI / 180);
          
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth="1"
            />
          );
        })}
        
        {/* Colored needle - adjusted vertical position */}
        <line
          x1="50"
          y1="48"
          x2={50 + 30 * Math.cos(angle * Math.PI / 180)}
          y2={48 - 30 * Math.sin(angle * Math.PI / 180)}
          stroke={color}
          strokeWidth="3"
        />
      </svg>
    </div>
  );
};

// ADDED: Inline score bar component (matching individual scores)
const InlineScoreBar = ({ score }: { score: number }) => {
  const scoreInfo = getScoreInfo(score);
  
  return (
    <div className="flex items-center gap-4 mb-4">
      {/* Score bar - same styling as individual scores */}
      <div className="flex-1">
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div 
            className="h-4 rounded-full transition-all duration-300"
            style={{ 
              width: `${(Math.min(Math.max(score, 0), 10) / 10) * 100}%`,
              background: scoreInfo.gradient
            }}
          />
        </div>
      </div>
      
      {/* Score label - color coded and right aligned */}
      <div className={`text-sm font-medium min-w-[80px] text-right ${scoreInfo.textColor}`}>
        {scoreInfo.label}
      </div>
    </div>
  );
};

// UPDATED: SummaryBox with inline score bar
const SummaryBox = ({ 
  assessment, 
  verdict, 
  score 
}: { 
  assessment: string; 
  verdict?: string | null;
  score?: number;
}) => (
  <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-md overflow-hidden transition-all hover:shadow-lg hover:border-gray-300 p-4 mb-6">
    <div className="text-sm font-medium text-gray-700 mb-3">Summary</div>
    
    {/* Inline score bar */}
    {score !== undefined && (
      <InlineScoreBar score={score} />
    )}
    
    <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">{assessment}</p>
    {verdict && (
      <>
        <div className="border-t border-gray-200 my-3"></div>
        <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">{verdict}</p>
      </>
    )}
  </div>
);

// EXACT COPY of getScoreInfo from CompetitionTab
const getScoreInfo = (score: number) => {
  if (score > 6) return { label: 'Good', gradient: 'linear-gradient(45deg, #10b981, #059669)', glassBg: 'bg-green-50/80', textColor: 'text-green-700' };
  if (score >= 4) return { label: 'Average', gradient: 'linear-gradient(45deg, #f59e0b, #d97706)', glassBg: 'bg-yellow-50/80', textColor: 'text-yellow-700' };
  return { label: 'Poor', gradient: 'linear-gradient(45deg, #ef4444, #dc2626)', glassBg: 'bg-red-50/80', textColor: 'text-red-700' };
};

// ADDED: Metric comparison component
const MetricWithMedianComparison = ({
  label,
  actualValue,
  medianValue,
  formatValue,
  formatDeviation,
}: {
  label: string;
  actualValue: number | null;
  medianValue: number | null;
  formatValue: (v: number) => string;
  formatDeviation: (v: number) => string;
}) => {
  const { TrendingUp, TrendingDown } = require('lucide-react');
  
  if (actualValue === null || medianValue === null) {
    return <span className="text-gray-400">No data found.</span>;
  }
  
  const percentDiff = ((actualValue - medianValue) / medianValue) * 100;
  const isUp = percentDiff > 0;
  const isDown = percentDiff < 0;
  
  // Color coding: positive = green (good), negative = red (bad)
  const pillColor = isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-gray-600';
  const pillBgColor = isUp ? 'bg-green-50' : isDown ? 'bg-red-50' : 'bg-gray-100';
  
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-1 md:gap-2">
        <span className="text-lg md:text-2xl font-bold text-gray-900">
          {formatValue(actualValue)}
        </span>
        <div className={`inline-flex items-center gap-1 px-1 md:px-2 py-1 rounded-full text-[10px] md:text-xs font-medium ${pillBgColor} min-w-[50px] md:min-w-[60px] justify-center`}>
          {isUp && <TrendingUp className={`w-3 h-3 ${pillColor}`} />}
          {isDown && <TrendingDown className={`w-3 h-3 ${pillColor}`} />}
          <span className={pillColor}>
            {isUp ? '+' : isDown ? '-' : ''}{formatDeviation(Math.abs(percentDiff))}
          </span>
        </div>
      </div>
    </div>
  );
};

// ADDED: Dual bar comparison component
const DualBarComparison = ({
  currentValue,
  medianValue,
  formatValue,
  isPositiveAbove = true, // For revenue, higher is better
}: {
  currentValue: number | null;
  medianValue: number | null;
  formatValue: (v: number) => string;
  isPositiveAbove?: boolean; // Whether being above median is positive
}) => {
  if (currentValue === null || medianValue === null) {
    return <span className="text-gray-400">No data found.</span>;
  }

  // Smart scaling with minimum visibility
  const maxValue = Math.max(currentValue, medianValue);
  const minBarWidth = 15; // Minimum 15% width for readability
  
  // Calculate widths relative to the maximum value
  const currentBarWidth = Math.max((currentValue / maxValue) * 100, minBarWidth);
  const medianBarWidth = Math.max((medianValue / maxValue) * 100, minBarWidth);
  
  const isAboveMedian = currentValue > medianValue;
  const isPositive = isPositiveAbove ? isAboveMedian : !isAboveMedian;
  
  // Dynamic gradient based on performance
  const currentBarGradient = isPositive 
    ? 'linear-gradient(90deg, #10b981, #059669)' // Green gradient
    : 'linear-gradient(90deg, #ef4444, #dc2626)'; // Red gradient

  const percentDiff = ((currentValue - medianValue) / medianValue) * 100;

  return (
    <div className="space-y-2">
      {/* Median bar (gray) */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div 
            className="h-3 bg-gray-400 rounded-full transition-all duration-300"
            style={{ width: `${medianBarWidth}%` }}
          />
        </div>
        <span className="text-xs text-gray-600 font-medium min-w-[60px] text-right">
          {formatValue(medianValue)}
        </span>
      </div>
      
      {/* Current value bar (dynamic gradient) */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div 
            className="h-3 rounded-full transition-all duration-300"
            style={{ 
              width: `${currentBarWidth}%`,
              background: currentBarGradient
            }}
          />
        </div>
        <span className="text-xs font-medium min-w-[60px] text-right">
          {formatValue(currentValue)}
        </span>
      </div>
      
      {/* Percentage difference - LEFT ALIGNED */}
      <div className={`text-xs font-medium text-left ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}>
        {percentDiff > 0 ? '+' : ''}{percentDiff.toFixed(1)}% vs median
      </div>
    </div>
  );
};

const RecommendationTab: React.FC<RecommendationTabProps> = ({ businessId, expandAllDetails = false }) => {
  const [recommendationData, setRecommendationData] = useState<RecommendationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [operationalScore, setOperationalScore] = useState<number | null>(null);
  const [softFactorsScore, setSoftFactorsScore] = useState<number | null>(null);
  const [demographicsScore, setDemographicsScore] = useState<number | null>(null);
  const [locationScore, setLocationScore] = useState<number | null>(null);
  
  // ADDED: Price benchmarks state
  const [priceBenchmarks, setPriceBenchmarks] = useState<PriceBenchmarks | null>(null)

  // ADDED: Same state variables as CompetitionTab for key metrics
  const [locationStats, setLocationStats] = useState<any | null>(null)
  const [nationalAverages, setNationalAverages] = useState<any | null>(null)

  // Ref guards to prevent refetching
  const hasFetchedRef = useRef(false)
  const lastBusinessIdRef = useRef<string | null>(null)

  // EXACT COPY of MetricWithNationalAvg from CompetitionTab
  const MetricWithNationalAvg = ({
    metric,
    localValue,
    formatValue,
    year = 2024,
    maxWidth = '220px',
  }: {
    metric: string;
    localValue: number;
    formatValue: (v: number) => string;
    year?: number;
    maxWidth?: string;
  }) => {
    const { TrendingUp, TrendingDown } = require('lucide-react');
    const nationalValue = nationalAverages ? nationalAverages[metric] : null;
    const percentDiff =
      nationalValue && typeof localValue === 'number' && typeof nationalValue === 'number' && nationalValue !== 0
        ? ((localValue - nationalValue) / nationalValue) * 100
        : null;
    const isUp = percentDiff !== null && percentDiff > 0;
    const isDown = percentDiff !== null && percentDiff < 0;
    
    // Use proper color coding: positive = green (good), negative = red (bad)
    const pillColor = isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-gray-600';
    const pillBgColor = isUp ? 'bg-green-50' : isDown ? 'bg-red-50' : 'bg-gray-100';
    
    return (
      <div className="flex flex-col items-start">
        <div className="flex items-center gap-1 md:gap-2">
          <span className="text-lg md:text-2xl font-bold text-gray-900">
            {formatValue(localValue)}
          </span>
          {nationalValue !== null && percentDiff !== null && (
            <div className={`inline-flex items-center gap-1 px-1 md:px-2 py-1 rounded-full text-[10px] md:text-xs font-medium ${pillBgColor} min-w-[50px] md:min-w-[60px] justify-center`}>
              {isUp && <TrendingUp className={`w-3 h-3 ${pillColor}`} />}
              {isDown && <TrendingDown className={`w-3 h-3 ${pillColor}`} />}
              <span className={pillColor}>
                {isUp ? '+' : isDown ? '-' : ''}{Math.abs(percentDiff).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        {nationalValue === null || percentDiff === null ? (
          <div className="mt-2">
            <span className="text-gray-500 text-xs">N/A</span>
          </div>
        ) : null}
      </div>
    );
  };

  const fetchRecommendation = async () => {
    setLoading(true)
    setError(null)
    
    // FIXED: Use proper Supabase query structure
    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select(`
        business_category_id,
        business_categories(
          name,
          display_name,
          price_benchmarks
        )
      `)
      .eq("id", businessId)
      .single()
    
    if (businessError) {
      setError("Failed to load business data.")
      setLoading(false)
      return
    }

    // FIXED: Handle business_categories as an object, not array
    const businessCategory = businessData.business_categories as any;
    if (businessCategory?.price_benchmarks) {
      try {
        const benchmarks = typeof businessCategory.price_benchmarks === 'string' 
          ? JSON.parse(businessCategory.price_benchmarks)
          : businessCategory.price_benchmarks;
        setPriceBenchmarks(benchmarks);
      } catch (e) {
        console.error("Failed to parse price benchmarks:", e);
      }
    }

    // Fetch operational score (same as BusinessScoreTab)
    const { data: operationalData, error: operationalError } = await supabase
      .from("operational_score")
      .select("raw_response")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Fetch demographics score (same as DemographicsTab)
    const { data: demographicsData, error: demographicsError } = await supabase
      .from("demographics_score")
      .select("raw_response")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Parse operational data for scores
    if (!operationalError && operationalData?.raw_response) {
      try {
        const operationalParsed = typeof operationalData.raw_response === 'string' 
          ? JSON.parse(operationalData.raw_response) 
          : operationalData.raw_response;
        setOperationalScore(operationalParsed?.operational_score_total ?? operationalParsed?.operational_score ?? null);
        setSoftFactorsScore(operationalParsed?.soft_factors_score ?? null);
      } catch (e) {
        console.error("Failed to parse operational data:", e);
        setOperationalScore(null);
        setSoftFactorsScore(null);
      }
    } else {
      setOperationalScore(null);
      setSoftFactorsScore(null);
    }

    // Parse demographics data for scores
    if (!demographicsError && demographicsData?.raw_response) {
      try {
        const demographicsParsed = typeof demographicsData.raw_response === 'string'
          ? JSON.parse(demographicsData.raw_response)
          : demographicsData.raw_response;
        setDemographicsScore(demographicsParsed?.demographics_score ?? null);
        setLocationScore(demographicsParsed?.location_score ?? null);
      } catch (e) {
        console.error("Failed to parse demographics data:", e);
        setDemographicsScore(null);
        setLocationScore(null);
      }
    } else {
      setDemographicsScore(null);
      setLocationScore(null);
    }

    // Original recommendation data fetching
    const { data, error } = await supabase
      .from("recommendation")
      .select("raw_response, analysis_status")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    if (error) {
      setError("Failed to load recommendation data.")
      setRecommendationData(null)
    } else if (data) {
      let parsed = data.raw_response
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed)
        } catch (e) {
          console.error("Failed to parse recommendation data:", e)
          setError("Failed to parse recommendation data.")
          setRecommendationData(null)
          setLoading(false)
          return
        }
      }

      // Parse operational data
      let operationalParsed = null;
      if (!operationalError && operationalData?.raw_response) {
        try {
          operationalParsed = typeof operationalData.raw_response === 'string' 
            ? JSON.parse(operationalData.raw_response) 
            : operationalData.raw_response;
        } catch (e) {
          console.error("Failed to parse operational data:", e);
        }
      }

      setRecommendationData({
        ideal_range_low: parsed?.ideal_range_low ?? null,
        ideal_range_high: parsed?.ideal_range_high ?? null,
        ideal_range_description: parsed?.ideal_range_description ?? null,
        great_deal_price: parsed?.great_deal_price ?? null,
        great_deal_description: parsed?.great_deal_description ?? null,
        current_price: parsed?.current_price ?? null,
        current_price_description: parsed?.current_price_description ?? null,
        strength_1: parsed?.strength_1 ?? null,
        strength_2: parsed?.strength_2 ?? null,
        strength_3: parsed?.strength_3 ?? null,
        strength_4: parsed?.strength_4 ?? null,
        strength_5: parsed?.strength_5 ?? null,
        weakness_1: parsed?.weakness_1 ?? null,
        weakness_2: parsed?.weakness_2 ?? null,
        weakness_3: parsed?.weakness_3 ?? null,
        weakness_4: parsed?.weakness_4 ?? null,
        weakness_5: parsed?.weakness_5 ?? null,
        verdict: parsed?.verdict ?? null,
        negotiation_focus: parsed?.negotiation_focus ?? null,
        recommendation_status: data.analysis_status ?? null,
        weighted_average_score: parsed?.weighted_average_score ?? null,
        operational_commentary: parsed?.operational_commentary ?? null,
        soft_factors_commentary: parsed?.soft_factors_commentary ?? null,
        demographics_commentary: parsed?.demographics_commentary ?? null,
        location_commentary: parsed?.location_commentary ?? null,
        ideal_sde_range_low: parsed?.ideal_sde_range?.low ?? null,
        ideal_sde_range_high: parsed?.ideal_sde_range?.high ?? null,
        ideal_revenue_range_low: parsed?.ideal_revenue_range?.low ?? null,
        ideal_revenue_range_high: parsed?.ideal_revenue_range?.high ?? null,
        fair_range_description: parsed?.fair_range_description ?? null,
        current_price_assessment: parsed?.current_price_assessment ?? null,
        overall_recommendation: parsed?.overall_recommendation ?? null,
        // ADDED: Operational data
        revenue: operationalParsed?.revenue ?? null,
        cash_flow: operationalParsed?.cash_flow ?? null,
        revenue_multiple_result: operationalParsed?.revenue_multiple_result ?? null,
        sde_multiple_result: operationalParsed?.sde_multiple_result ?? null,
        price_multiplier: parsed?.price_multiplier ?? 1,
        operational_score: operationalParsed?.operational_score ?? null,
        soft_factors_score: operationalParsed?.soft_factors_score ?? null,
        demographics_score: operationalParsed?.demographics_score ?? null,
        location_score: operationalParsed?.location_score ?? null,
      })
    } else {
      setError("No recommendation data found.")
      setRecommendationData(null)
    }
    setLoading(false)
  }

  // Retry handler for AI analysis
  const handleRetry = async () => {
    setRefreshing(true)
    setRetryError(null)
    try {
      const response = await fetch("/api/trigger-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId })
      })
      const result = await response.json()
      if (!response.ok) {
        setRetryError(result.error || "Failed to retry analysis.")
      } else {
        await fetchRecommendation()
      }
    } catch (err: any) {
      setRetryError(err.message || "Failed to retry analysis.")
    }
    setRefreshing(false)
  }

  useEffect(() => {
    // Reset guard if businessId changed
    if (lastBusinessIdRef.current !== businessId) {
      hasFetchedRef.current = false
      lastBusinessIdRef.current = businessId
    }
    
    // Check guard - skip if already fetched for this business
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true
    
    fetchRecommendation()
    return () => {}
  }, [businessId])

  // Add state for collapsible sections (if any exist)
  const [expandedSections, setExpandedSections] = useState<{
    strengths: boolean;
    weaknesses: boolean;
    financialDetails: boolean;
  }>({
    strengths: false,
    weaknesses: false,
    financialDetails: false
  });

  // Expand all sections when exporting
  useEffect(() => {
    if (expandAllDetails) {
      setExpandedSections({
        strengths: true,
        weaknesses: true,
        financialDetails: true
      });
    }
  }, [expandAllDetails]);

  // Status UI logic
  const status = recommendationData?.recommendation_status || "unknown"
  let statusContent = null
  if (loading || refreshing || status === "pending" || status === "processing") {
    statusContent = (
      <div className="flex items-center gap-2 text-blue-600"><span className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></span> Analysis in progress…</div>
    )
  } else if (status === "failed") {
    statusContent = (
      <div className="flex items-center gap-2 text-red-600">Analysis failed. <button onClick={fetchRecommendation} className="ml-2 px-2 py-1 bg-red-100 rounded hover:bg-red-200">Retry</button></div>
    )
  } else if (status === "completed" || status === "complete") {
    statusContent = null // Show result
  } else {
    statusContent = <div className="text-gray-500">Status: {status}</div>
  }

  // Helper for status color
  const getStatusColor = (status: string) => {
    if (loading || refreshing || status === "pending" || status === "processing") return "text-blue-600";
    if (status === "failed" || (error && !recommendationData)) return "text-red-600";
    if (status === "completed" || status === "complete") return "text-green-600";
    return "text-gray-500";
  };

  // Prepare strengths and weaknesses arrays - UPDATED to include all 5 items
  const strengths = recommendationData ? [
    recommendationData.strength_1,
    recommendationData.strength_2,
    recommendationData.strength_3,
    recommendationData.strength_4,
    recommendationData.strength_5
  ].filter((item): item is string => item !== null && item !== undefined) : [];
  const weaknesses = recommendationData ? [
    recommendationData.weakness_1,
    recommendationData.weakness_2,
    recommendationData.weakness_3,
    recommendationData.weakness_4,
    recommendationData.weakness_5
  ].filter((item): item is string => item !== null && item !== undefined) : [];

  // Prepare values for the bar (convert to numbers and log)
  const low = recommendationData ? Number(recommendationData.ideal_range_low) : 0;
  const high = recommendationData ? Number(recommendationData.ideal_range_high) : 0;
  const current = recommendationData ? Number(recommendationData.current_price) : 0;
  const min = Math.min(low, high, current);
  const max = Math.max(low, high, current);
  const currentPos = max === min ? 0 : ((current - min) / (max - min)) * 100;
  // Clamp marker label position to prevent overflow
  const safeZoneLeft = 10; // percent
  const safeZoneRight = 90; // percent
  let markerLeft = `${currentPos}%`;
  let markerTransform = 'translateX(-50%)';
  if (currentPos < safeZoneLeft) {
    markerLeft = '0%';
    markerTransform = 'none';
  } else if (currentPos > safeZoneRight) {
    markerLeft = '100%';
    markerTransform = 'translateX(-100%)';
  }
  // Determine Current Price tile color
  let currentTileClass = "bg-white border-gray-200";
  if (recommendationData && current < Number(recommendationData.great_deal_price)) {
    currentTileClass = "bg-green-50 border-green-200";
  } else if (recommendationData && current > Number(recommendationData.great_deal_price)) {
    currentTileClass = "bg-orange-50 border-orange-200";
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)

  const extractUpperMultiple = (range: string | null | undefined): number | null => {
    if (!range) return null;
    const nums = [...range.matchAll(/([\d\.]+)\s*x/gi)].map(m => parseFloat(m[1]));
    if (!nums.length) return null;
    return Math.max(...nums);
  };

  // Move this helper to the top-level (near other helpers)
  const formatPriceK = (value: number) => `$${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 })}k`;

  return (
    <div className="space-y-8">
      {/* Top Status & Retry Card */}
      <Card className="flex flex-row items-center justify-between px-6 py-3 mb-2 !bg-gray-300 border border-white shadow">
        {/* Status Text */}
        <div className={`font-medium ${getStatusColor(status)}`}> 
          {loading || refreshing || status === "pending" || status === "processing" ? (
            <span className="flex items-center gap-2"><span className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></span> Analysis in progress…</span>
          ) : (error && !recommendationData) || status === "failed" ? (
            <>Status: Error</>
          ) : (status === "completed" || status === "complete") ? (
            <>Status: Complete</>
          ) : (
            <>Status: {status}</>
          )}
        </div>
        {/* Retry Button */}
        <button
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200 shadow transition disabled:opacity-50"
          onClick={handleRetry}
          disabled={refreshing || loading}
          title="Re-run analysis"
        >
          {refreshing ? (
            <span className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-blue-600"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0A8.003 8.003 0 0012 20a8.003 8.003 0 007.418-4.999M4.582 9H9" /></svg>
          )}
        </button>
      </Card>
      {/* Show loading, retry error, or error details if any */}
      {loading && <div className="p-8 text-left text-gray-500">Loading recommendation analysis...</div>}
      {retryError && <div className="p-2 text-left text-red-500">{retryError}</div>}
      {error && <div className="p-2 text-left text-red-500">{error}</div>}
      
      {/* EXACT COPY of the overview card from CompetitionTab */}
      {recommendationData && (
        <Card className="relative">
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Overall Impression</h3>
          </CardHeader>
          <div className="px-6 pb-6">
            <SummaryBox 
              assessment={recommendationData.verdict || 'No assessment available.'} 
              verdict={recommendationData.overall_recommendation || undefined}
              score={recommendationData.weighted_average_score || 0}
            />

            {/* Individual Scores Grid - UPDATED */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-800 mb-4">
                Individual Scores
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {/* Operations Score */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-3">
                      <span className="text-sm font-medium text-gray-700">Operations</span>
                    </div>
                    {/* Progress Bar - THICKER */}
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
                      <div 
                        className="h-4 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(Math.min(Math.max((operationalScore || 0), 0), 10) / 10) * 100}%`,
                          background: getScoreInfo(operationalScore || 0).gradient
                        }}
                      ></div>
                    </div>
                    {/* Commentary */}
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {recommendationData?.operational_commentary || 'No commentary available.'}
                    </p>
                  </div>
                </Card>

                {/* Soft Factors Score */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-3">
                      <span className="text-sm font-medium text-gray-700">Soft Factors</span>
                    </div>
                    {/* Progress Bar - THICKER */}
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
                      <div 
                        className="h-4 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(Math.min(Math.max((softFactorsScore || 0), 0), 10) / 10) * 100}%`,
                          background: getScoreInfo(softFactorsScore || 0).gradient
                        }}
                      ></div>
                    </div>
                    {/* Commentary */}
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {recommendationData?.soft_factors_commentary || 'No commentary available.'}
                    </p>
                  </div>
                </Card>

                {/* Demographics Score */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-3">
                      <span className="text-sm font-medium text-gray-700">Demographics</span>
                    </div>
                    {/* Progress Bar - THICKER */}
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
                      <div 
                        className="h-4 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(Math.min(Math.max((demographicsScore || 0), 0), 10) / 10) * 100}%`,
                          background: getScoreInfo(demographicsScore || 0).gradient
                        }}
                      ></div>
                    </div>
                    {/* Commentary */}
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {recommendationData?.demographics_commentary || 'No commentary available.'}
                    </p>
                  </div>
                </Card>

                {/* Location Score */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-3">
                      <span className="text-sm font-medium text-gray-700">Location</span>
                    </div>
                    {/* Progress Bar - THICKER */}
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
                      <div 
                        className="h-4 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(Math.min(Math.max((locationScore || 0), 0), 10) / 10) * 100}%`,
                          background: getScoreInfo(locationScore || 0).gradient
                        }}
                      ></div>
                    </div>
                    {/* Commentary */}
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {recommendationData?.location_commentary || 'No commentary available.'}
                    </p>
                  </div>
                </Card>
              </div>
            </div>

            {/* Key Metrics Grid - UPDATED with business metrics */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-800 mb-4">
                Key Metrics <span className="text-xs text-gray-500 font-normal">(vs. median)</span>
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {/* Revenue */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-2">
                      <span className="text-sm font-medium text-gray-700">Revenue</span>
                    </div>
                    {recommendationData?.revenue && priceBenchmarks ? (
                      <DualBarComparison
                        currentValue={recommendationData.revenue}
                        medianValue={priceBenchmarks.median_revenue}
                        formatValue={formatPriceK}
                        isPositiveAbove={true}
                      />
                    ) : (
                      <span className="text-gray-400">No data found.</span>
                    )}
                  </div>
                </Card>

                {/* Cash Flow */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-2">
                      <span className="text-sm font-medium text-gray-700">Cash Flow</span>
                    </div>
                    {recommendationData?.cash_flow && priceBenchmarks ? (
                      <DualBarComparison
                        currentValue={recommendationData.cash_flow}
                        medianValue={priceBenchmarks.median_cash_flow}
                        formatValue={formatPriceK}
                        isPositiveAbove={true} // Higher is better for cash flow
                      />
                    ) : (
                      <span className="text-gray-400">No data found.</span>
                    )}
                  </div>
                </Card>

                {/* Revenue Multiple */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-2">
                      <span className="text-sm font-medium text-gray-700">Revenue Multiple</span>
                    </div>
                    {recommendationData?.revenue_multiple_result && priceBenchmarks ? (
                      <DualBarComparison
                        currentValue={parseFloat(recommendationData.revenue_multiple_result.replace('x', ''))}
                        medianValue={priceBenchmarks.revenue_multiple.market_average}
                        formatValue={(v) => `${v.toFixed(2)}x`}
                        isPositiveAbove={false} // Lower is better for multiples
                      />
                    ) : (
                      <span className="text-gray-400">No data found.</span>
                    )}
                  </div>
                </Card>

                {/* Cash Flow Multiple */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-2">
                      <span className="text-sm font-medium text-gray-700">Cash Flow Multiple</span>
                    </div>
                    {recommendationData?.sde_multiple_result && priceBenchmarks ? (
                      <DualBarComparison
                        currentValue={parseFloat(recommendationData.sde_multiple_result.replace('x', ''))}
                        medianValue={priceBenchmarks.sde_multiple.market_average}
                        formatValue={(v) => `${v.toFixed(2)}x`}
                        isPositiveAbove={false} // Lower is better for multiples
                      />
                    ) : (
                      <span className="text-gray-400">No data found.</span>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Main Price Analysis Card - only if data exists */}
      {recommendationData && (
        <Card className="relative">
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Price Analysis</h3>
          </CardHeader>
          <div className="w-full px-8 pb-8 flex flex-col gap-6">
            {/* NEW: Updated Price Analysis Bar UI - COMBINED BOX WITH GRADIENT */}
            <div className="bg-gray-50 rounded-xl p-6 pt-14 border border-gray-200 shadow-md transition-all hover:shadow-lg hover:border-gray-300">
              {/* Data preparation */}
              {(() => {
                const medianPrice = priceBenchmarks?.median_selling_price || 0;
                const currentPrice = recommendationData?.current_price || 0;
                
                // Use whichever range is lower, with fallback
                const sdeRangeLow = recommendationData?.ideal_sde_range_low;
                const revenueRangeLow = recommendationData?.ideal_revenue_range_low;
                
                // If both exist, use lower; otherwise use whichever exists
                const useRevenue = (sdeRangeLow && revenueRangeLow) ? revenueRangeLow < sdeRangeLow : !sdeRangeLow;
                const greatRangeLowRaw = useRevenue ? revenueRangeLow : sdeRangeLow;
                const greatRangeHighRaw = useRevenue ? recommendationData?.ideal_revenue_range_high : recommendationData?.ideal_sde_range_high;
                // Ensure numbers for calculations
                const greatRangeLow = greatRangeLowRaw ?? 0;
                const greatRangeHigh = greatRangeHighRaw ?? 0;
                
                const priceMultiplier = recommendationData?.price_multiplier ?? 1;

                // Average range high: use same method as great range for consistency
                let averageRangeHigh = 0;
                if (useRevenue && recommendationData?.revenue && priceBenchmarks?.revenue_multiple) {
                  const upperAvg = extractUpperMultiple(priceBenchmarks.revenue_multiple.average) 
                                   ?? priceBenchmarks.revenue_multiple.market_average;
                  averageRangeHigh = recommendationData.revenue * upperAvg * priceMultiplier;
                } else if (!useRevenue && recommendationData?.cash_flow && priceBenchmarks?.sde_multiple) {
                  const upperAvg = extractUpperMultiple(priceBenchmarks.sde_multiple.average) 
                                   ?? priceBenchmarks.sde_multiple.market_average;
                  averageRangeHigh = recommendationData.cash_flow * upperAvg * priceMultiplier;
                }

                // Ensure average high never drops below the ideal high
                if (averageRangeHigh < greatRangeHigh) averageRangeHigh = greatRangeHigh ?? 0;

                // Average range starts where great range ends
                const averageRangeLow = greatRangeHigh;
                
                // Bar scale
                const rawMax = Math.max(currentPrice, medianPrice, averageRangeHigh);
                const maxPrice = rawMax * 1.1;  // +10% headroom
                const minPrice = 0;
                
                // Format function for "k" display
                const formatPriceK = (value: number) => `$${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 })}k`;
                
                // Calculate positions
                const currentPos = maxPrice > minPrice ? ((currentPrice - minPrice) / (maxPrice - minPrice)) * 100 : 0;
                const medianPos = maxPrice > minPrice ? ((medianPrice - minPrice) / (maxPrice - minPrice)) * 100 : 0;
                const greatRangeLowPos = maxPrice > minPrice ? (((greatRangeLow ?? 0) - minPrice) / (maxPrice - minPrice)) * 100 : 0;
                const greatRangeHighPos = maxPrice > minPrice ? (((greatRangeHigh ?? 0) - minPrice) / (maxPrice - minPrice)) * 100 : 0;
                const averageRangeHighPos = maxPrice > minPrice ? ((averageRangeHigh - minPrice) / (maxPrice - minPrice)) * 100 : 0;
                
                // Bidirectional text clamping - FIXED: More aggressive clamping
                const clampedCurrentPos = Math.max(3, Math.min(currentPos, 97));
                const clampedMedianPos = Math.max(3, Math.min(medianPos, 97));
                
                return (
                  <>
                    {/* Price Labels - WIRED */}
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-500">{formatPriceK(minPrice)}</span>
                      <span className="text-xs text-gray-500">{formatPriceK(maxPrice)}</span>
                    </div>
                    
                    {/* Bar Base */}
                    <div className="relative w-full h-8 bg-gradient-to-r from-green-500 via-yellow-400 via-orange-500 to-red-500 rounded-2xl mb-15">
                      {/* SINGLE COMBINED RANGE BOX - Great + Average with gradient transition */}
                      <div 
                        className="absolute"
                        style={{
                          top: '-3px',
                          left: `${greatRangeLowPos}%`,
                          width: `${averageRangeHighPos - greatRangeLowPos}%`,
                          height: '38px',
                          borderRadius: '6px',
                          background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.6) 0%, rgba(37, 99, 235, 0.6) 25%, rgba(150, 180, 245, 0.65) 50%, rgba(220, 230, 250, 0.7) 75%, rgba(255, 255, 255, 0.7) 100%)',
                          border: '3px solid #ffffff',
                          boxSizing: 'border-box',
                          boxShadow: '0 0 0 1px #d1d5db'
                        }}
                      />
                      
                      {/* Median Cut - WIRED with clamping */}
                      <div 
                        className="absolute"
                        style={{
                          left: `${clampedMedianPos}%`,
                          transform: 'translateX(-50%)',
                          top: '0',
                          width: '2px',
                          height: '32px',
                          background: '#4b5563',
                          borderRadius: '1px',
                          zIndex: 10
                        }}
                      />
                      
                      {/* Median Arrow - FIXED: Moved up slightly for more padding */}
                      <div 
                        className="absolute"
                        style={{
                          left: `${clampedMedianPos}%`,
                          transform: 'translateX(-50%)',
                          top: '-17px', // Changed from -15px to -17px for more padding
                          zIndex: 11
                        }}
                      >
                        <div 
                          className="w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-600"
                          style={{
                            borderLeftWidth: '6px',
                            borderRightWidth: '6px',
                            borderTopWidth: '8px',
                            marginTop: '4px'
                          }}
                        />
                      </div>
                      
                      {/* Median Label - FIXED: Moved up slightly to match arrow */}
                      <div 
                        className="absolute flex flex-col items-center"
                        style={{
                          left: `${clampedMedianPos}%`,
                          transform: 'translateX(-50%)',
                          top: '-47px' // Changed from -45px to -47px to match arrow movement
                        }}
                      >
                        <div className="text-xs font-semibold text-gray-900">{formatPriceK(medianPrice)}</div>
                        <div className="text-xs text-gray-500">Median</div>
                      </div>
                      
                      {/* Current Label - FIXED: More aggressive clamping */}
                      <div 
                        className="absolute flex flex-col items-center"
                        style={{
                          left: `${clampedCurrentPos}%`,
                          transform: 'translateX(-50%)',
                          top: '36px'
                        }}
                      >
                        <div 
                          className="w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-gray-600 mb-1"
                          style={{
                            borderLeftWidth: '8px',
                            borderRightWidth: '8px',
                            borderBottomWidth: '10px'
                          }}
                        />
                        <div className="text-xs font-semibold text-gray-900">{formatPriceK(currentPrice)}</div>
                        <div className="text-xs text-gray-500">Current</div>
                      </div>
                    </div>
                    
                    {/* Legend Container - WIRED */}
                    <div className="flex gap-4 justify-center mt-16">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
                        <div 
                          className="w-4 h-4 rounded border-2"
                          style={{
                            background: 'rgba(37, 99, 235, 0.6)',
                            borderColor: '#2563eb'
                          }}
                        />
                        <div className="text-xs font-semibold text-gray-900">
                          Great Range: {formatPriceK(greatRangeLow ?? 0)}-{formatPriceK(greatRangeHigh ?? 0)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
                        <div 
                          className="w-4 h-4 rounded border-2"
                          style={{
                            background: 'rgba(255, 255, 255, 0.7)',
                            borderColor: '#ffffff',
                            boxShadow: '0 0 0 1px #d1d5db'
                          }}
                        />
                        <div className="text-xs font-semibold text-gray-900">
                          Average Range: {formatPriceK(averageRangeLow)}-{formatPriceK(averageRangeHigh)}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            
            {/* Row 2: Two tiles in a responsive grid (removed Current Price and Verdict) */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Great Price */}
              <Card className="bg-green-50 border-green-200 flex flex-col items-start p-6">
                <div className="text-sm font-semibold text-black mb-1">Fair Price</div>
                <div className="text-2xl font-bold text-green-700 mb-1">
                  {recommendationData ? (
                    (() => {
                      // Use same logic as price bar - whichever range is lower
                      const sdeRangeLow = recommendationData?.ideal_sde_range_low;
                      const revenueRangeLow = recommendationData?.ideal_revenue_range_low;
                      
                      const useRevenue = (sdeRangeLow && revenueRangeLow) ? revenueRangeLow < sdeRangeLow : !sdeRangeLow;
                      const idealRangeLow = useRevenue ? revenueRangeLow : sdeRangeLow;
                      const idealRangeHigh = useRevenue ? recommendationData?.ideal_revenue_range_high : recommendationData?.ideal_sde_range_high;
                      
                      return idealRangeLow && idealRangeHigh ? 
                        `${formatPriceK(idealRangeLow)} - ${formatPriceK(idealRangeHigh)}` : 
                        'N/A';
                    })()
                  ) : 'N/A'}
                </div>
                <div className="text-xs text-gray-600 leading-relaxed">
                  {recommendationData?.fair_range_description || 'No range description available.'}
                </div>
              </Card>
              
              {/* Negotiation Focus */}
              <Card className="bg-blue-50 flex flex-col items-start p-6">
                <div className="text-sm font-semibold text-black mb-1">Negotiation Focus</div>
                <div className="text-xs text-gray-600 leading-relaxed">{recommendationData.negotiation_focus}</div>
              </Card>
            </div>
          </div>
        </Card>
      )}

      {/* Strengths and Weaknesses - UPDATED font size */}
      {recommendationData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strengths */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-gray-900">Business Strengths</h2>
            </CardHeader>
            <div className="px-6 pb-6">
              <div className="space-y-4">
                {strengths.map((strength, idx) => (
                  <div key={idx} className="border-l-4 border-green-500 pl-4 py-2 bg-green-50 rounded-r-lg">
                    <p className="text-sm text-gray-900">{strength}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          {/* Weaknesses */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-gray-900">Business Concerns</h2>
            </CardHeader>
            <div className="px-6 pb-6">
              <div className="space-y-4">
                {weaknesses.map((weakness, idx) => (
                  <div key={idx} className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 rounded-r-lg">
                    <p className="text-sm text-gray-900">{weakness}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default RecommendationTab 