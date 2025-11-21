import React, { useEffect, useState, useRef } from "react"
import { Card, CardHeader } from "./components/UIComponents"
import { supabase } from "@/lib/supabase"
import { GoogleMapsEmbed } from "@components/GoogleMapsEmbed"
import { AlertTriangle, Star, TrendingUp, TrendingDown } from "lucide-react"

interface CompetitionTabProps {
  businessId: string
  showMapExportOverlay?: boolean
  expandAllDetails?: boolean
}

interface LocationData {
  state: string
  city?: string | null
  zip?: string | null
  county?: string | null
}

interface BusinessCategory {
  name: string
  display_name: string
}

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
  positives, 
  negatives, 
  score 
}: { 
  assessment: string; 
  positives: string[];
  negatives: string[];
  score?: number;
}) => (
  <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-md overflow-hidden transition-all hover:shadow-lg hover:border-gray-300 p-4 mb-6">
    <div className="text-sm font-medium text-gray-700 mb-3">Summary</div>
    
    {/* Inline score bar */}
    {score !== undefined && (
      <InlineScoreBar score={score} />
    )}
    
    <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">{assessment}</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Positives</h4>
        <div className="flex flex-wrap gap-2">
          {positives.map((keyword, index) => (
            <span key={index} className="px-3 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200 font-medium">{keyword}</span>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Negatives</h4>
        <div className="flex flex-wrap gap-2">
          {negatives.map((keyword, index) => (
            <span key={index} className="px-3 py-1 bg-red-50 text-red-700 text-xs rounded-full border border-red-200 font-medium">{keyword}</span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const getScoreInfo = (score: number) => {
  if (score > 6) return { label: 'Good', gradient: 'linear-gradient(45deg, #10b981, #059669)', glassBg: 'bg-green-50/80', textColor: 'text-green-700' };
  if (score >= 4) return { label: 'Average', gradient: 'linear-gradient(45deg, #f59e0b, #d97706)', glassBg: 'bg-yellow-50/80', textColor: 'text-yellow-700' };
  return { label: 'Poor', gradient: 'linear-gradient(45deg, #ef4444, #dc2626)', glassBg: 'bg-red-50/80', textColor: 'text-red-700' };
};

const ScoreBadge = ({ score }: { score: number }) => {
  const scoreInfo = getScoreInfo(score);
  return (
    <div className="mb-4">
      <div className="rounded-lg p-1" style={{ background: scoreInfo.gradient }}>
        <div className={`w-full px-6 py-3 ${scoreInfo.glassBg} backdrop-blur-sm rounded-md font-semibold text-center ${scoreInfo.textColor}`}>{scoreInfo.label}</div>
      </div>
    </div>
  );
};

// Enhanced text cleaning function for assessment text boxes
const cleanAssessmentText = (text: string) => {
  if (!text) return text;
  
  // 1. Remove all source references [x] or [x][y][z]
  let cleaned = text.replace(/\[\d+\]/g, '');
  
  // 2. Fix "k" values that should be monetary (90k, 100k, etc.) in income context
  cleaned = cleaned.replace(/\b(\d+)k\b/g, (match, num, offset) => {
    // Check if this k value is in a monetary context
    const beforeMatch = cleaned.substring(0, offset);
    const afterMatch = cleaned.substring(offset + match.length);
    const context = (beforeMatch + afterMatch).toLowerCase();
    
    if (context.includes('income') || context.includes('earning') || context.includes('households') || 
        context.includes('median') || context.includes('salary') || context.includes('wage')) {
      return `$${num}k`;
    }
    return match;
  });
  
  // 3. Fix monetary values with specific context - be more precise
  const monetaryContexts = [
    'per month', 'monthly', 'per hour', 'per day', 'per year', 'annually',
    'income', 'rent', 'rents', 'wage', 'gross', 'cash flow',
    'home values', 'rents at', 'cost', 'price', 'fee', 'rate',
    'per square foot', 'per sq ft', 'per square foot annually', 'per sq ft annually'
  ];
  
  // Pattern: number + space + monetary context (but NOT sq ft, area, etc.)
  monetaryContexts.forEach(context => {
    const regex = new RegExp(`\\b(\\d+(?:\\.\\d{2})?)\\s+${context}\\b`, 'gi');
    cleaned = cleaned.replace(regex, (match, num) => {
      if (!num.startsWith('$')) {
        const number = parseInt(num);
        const formattedNum = number >= 1000 ? number.toLocaleString() : num;
        return `$${formattedNum} ${context}`;
      }
      return match;
    });
  });
  
  // 4. Fix standalone large numbers that are clearly monetary (but not areas)
  cleaned = cleaned.replace(/\b(\d{4,})\b/g, (match, num, offset) => {
    const number = parseInt(num);
    // Skip years, scores, ranges, percentages, and areas
    if (number >= 1900 && number <= 2100) return match; // years
    if (number <= 100 && !match.includes('.')) return match; // scores
    if (match.includes('-') || match.includes('%')) return match; // ranges/percentages
    
    // Check if this number is followed by area measurements
    const afterMatch = cleaned.substring(offset + match.length);
    if (afterMatch.includes('sq ft') || afterMatch.includes('sqft') || afterMatch.includes('square feet')) {
      return match; // Don't add $ to area measurements
    }
    
    // Add dollar sign and comma formatting
    return `$${number.toLocaleString()}`;
  });
  
  // 5. Fix decimal monetary values (like 16.50)
  cleaned = cleaned.replace(/\b(\d+\.\d{2})\b/g, (match, num) => {
    const number = parseFloat(num);
    // Only format if it looks like a price (reasonable range)
    if (number >= 1 && number <= 1000) {
      return `$${number.toFixed(2)}`;
    }
    return match;
  });
  
  // 6. Clean up extra spaces and fix double dollar signs
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/\$\$/g, '$'); // Fix double dollar signs
  
  return cleaned;
};

const TourismSummaryBox = ({ 
  assessment, 
  tourismIndex, 
  tourismDeviation 
}: { 
  assessment: string; 
  tourismIndex?: number | null;
  tourismDeviation?: number;
}) => {

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-md overflow-hidden transition-all hover:shadow-lg hover:border-gray-300 p-4 mb-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="text-sm font-medium text-gray-700">Tourism</div>
        {tourismIndex != null && tourismDeviation != null && (
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            tourismDeviation > 10 ? 'bg-green-50 text-green-700' : 
            tourismDeviation < -10 ? 'bg-red-50 text-red-700' : 
            'bg-yellow-50 text-yellow-700'
          }`}>
            {tourismDeviation > 10 ? 'High' : 
             tourismDeviation < -10 ? 'Low' : 'Average'}
          </div>
        )}
      </div>
      <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">{cleanAssessmentText(assessment)}</p>
    </div>
  );
};

const Pill = ({
  children,
  color = "green",
}: {
  children: React.ReactNode;
  color?: "green" | "red";
}) => {
  const colorClasses =
    color === "green"
      ? "bg-green-50 text-green-700 border-green-200"
      : "bg-red-50 text-red-700 border-red-200";
  return (
    <span
      className={`px-3 py-1 text-xs rounded-full border font-medium ${colorClasses}`}
      style={{ display: "inline-block" }}
    >
      {children}
    </span>
  );
};

const CompetitionTab: React.FC<CompetitionTabProps> = ({ businessId, showMapExportOverlay = false, expandAllDetails = false }) => {
  const [locationData, setLocationData] = useState<LocationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [climate, setClimate] = useState<any | null>(null)
  const [climateLoading, setClimateLoading] = useState(true)
  const [locationStats, setLocationStats] = useState<any | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [nationalAverages, setNationalAverages] = useState<any | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [competitionStatus, setCompetitionStatus] = useState<string | null>(null)
  const [competitionError, setCompetitionError] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [businessCategory, setBusinessCategory] = useState<BusinessCategory | null>(null)
  const [locationScore, setLocationScore] = useState<any | null>(null);
  
  // Ref guards to prevent refetching
  const hasFetchedRef = useRef(false)
  const lastBusinessIdRef = useRef<string | null>(null)
  
  const [ratings, setRatings] = useState<{
    safety: string | null;
    competition: string | null;
    growth: string | null;
    life_quality: string | null;
  }>({
    safety: null,
    competition: null,
    growth: null,
    life_quality: null
  });
  // Add state for collapsible sections (if any exist)
  const [expandedSections, setExpandedSections] = useState<{
    competitionDetails: boolean;
    locationAnalysis: boolean;
  }>({
    competitionDetails: false,
    locationAnalysis: false
  });

  // Expand all sections when exporting
  useEffect(() => {
    if (expandAllDetails) {
      setExpandedSections({
        competitionDetails: true,
        locationAnalysis: true
      });
    }
  }, [expandAllDetails]);

  // Move MetricWithNationalAvg component INSIDE the main component function
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
    // Individual metric logic
    const crimeMetrics = ['property_crime_rate', 'violent_crime_rate'];
    const isCrimeMetric = crimeMetrics.includes(metric);
    
    // Group 1 (crime): green=below, red=above
    // Group 2 (all others): green=above, red=below  
    const pillColor = isCrimeMetric
      ? (isUp ? 'text-red-600' : isDown ? 'text-green-600' : 'text-gray-600')
      : (isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-gray-600');
    const pillBgColor = isCrimeMetric
      ? (isUp ? 'bg-red-50' : isDown ? 'bg-green-50' : 'bg-gray-100')
      : (isUp ? 'bg-green-50' : isDown ? 'bg-red-50' : 'bg-gray-100');
    
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

  const RatingDisplay = ({ rating }: { rating: string | null }) => {
    if (!rating) return <span className="text-gray-400">No data found.</span>;
    
    const getRatingColor = (rating: string) => {
      switch (rating.toLowerCase()) {
        case 'poor': return 'text-red-600';
        case 'fair': return 'text-orange-600';
        case 'average': return 'text-yellow-600';
        case 'good': return 'text-green-600';
        case 'excellent': return 'text-emerald-600';
        default: return 'text-gray-900';
      }
    };
    
    return (
      <span className={`text-lg md:text-2xl font-bold ${getRatingColor(rating)}`}>
        {rating}
      </span>
    );
  };

  // Replace fetchAllData with new implementation
  const fetchAllData = async () => {
    setRefreshing(true)
    setLoading(true)
    setClimateLoading(true)
    setLocationLoading(true)
    setCompetitionError(null)
    
    // Fetch location data and business category
    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select(`
        state, 
        city, 
        zip, 
        county,
        business_category_id,
        business_categories(
          name,
          display_name
        )
      `)
      .eq("id", businessId)
      .single()
    
    if (businessError) {
      setError("Failed to load business data.")
      setLoading(false)
      return
    }
    
    setLocationData({
      state: businessData.state,
      city: businessData.city,
      zip: businessData.zip,
      county: businessData.county
    })
    
    // Fix: Extract the business category (it's an object, not an array)
    setBusinessCategory(businessData.business_categories ? {
      name: (businessData.business_categories as any).name,
      display_name: (businessData.business_categories as any).display_name
    } : null)
    setLoading(false)
    
    // Fetch demographics score data for location score
    const { data: demographicsData, error: demographicsError } = await supabase
      .from("demographics_score")
      .select("raw_response, analysis_status")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    
    if (!demographicsError && demographicsData?.raw_response) {
      try {
        const rawResponse = typeof demographicsData.raw_response === 'string' 
          ? JSON.parse(demographicsData.raw_response) 
          : demographicsData.raw_response
        
        setLocationScore({
          location_score: rawResponse.location_score || null,
          location_assessment: rawResponse.location_assessment || 'No assessment available.',
          location_positive: rawResponse.location_positive_tags || [],
          location_negative: rawResponse.location_negative_tags || [],
          analysis_status: (demographicsData as any)?.analysis_status || null
        })
        
        // Extract ratings
        setRatings({
          safety: rawResponse.safety || null,
          competition: rawResponse.competition || null,
          growth: rawResponse.growth || null,
          life_quality: rawResponse.life_quality || null
        })
      } catch (parseError) {
        console.error("Failed to parse demographics raw_response:", parseError)
        setLocationScore(null)
        setRatings({ safety: null, competition: null, growth: null, life_quality: null })
      }
    } else {
      setLocationScore(null)
      setRatings({ safety: null, competition: null, growth: null, life_quality: null })
    }
    
    // Fetch competition data from location_data_collection
    const { data: compData, error: compError } = await supabase
      .from("location_data_collection")
      .select("competition_raw_data, competition_status, demographics_raw_data, location_economics_raw_data")
      .eq("business_id", businessId)
      .order("competition_collected_at", { ascending: false })
      .limit(1)
      .single()
    
    if (compError) {
      setCompetitionError("Failed to load competition analysis data.")
      setCompetitionStatus(null)
      setClimate(null)
      setLocationStats(null)
    } else if (compData) {
      setCompetitionStatus(compData.competition_status || null)
      
      // Parse competition data from JSON
      let competition = compData.competition_raw_data
      let demographics = compData.demographics_raw_data
      let economics = compData.location_economics_raw_data
      
      // Parse JSON if string
      if (competition && typeof competition === 'string') {
        try {
          competition = JSON.parse(competition)
        } catch (e) {
          console.error("Failed to parse competition data:", e)
        }
      }
      
      if (demographics && typeof demographics === 'string') {
        try {
          demographics = JSON.parse(demographics)
        } catch (e) {
          console.error("Failed to parse demographics data:", e)
        }
      }
      
      if (economics && typeof economics === 'string') {
        try {
          economics = JSON.parse(economics)
        } catch (e) {
          console.error("Failed to parse economics data:", e)
        }
      }
      
      // Set climate data with CORRECT new structure
      setClimate({
        business_count: competition?.coreMetrics?.businessCount ?? null,
        average_rating: competition?.coreMetrics?.averageRating ?? null,
        economic_growth_assessment: economics?.economicGrowthAssessment ?? null,
      })
      
      // Set location stats data
      setLocationStats({
        // Population data from location_economics_raw_data
        current_population: economics?.locationQuality?.population?.current ?? null,
        population_yoy_change: economics?.locationQuality?.population?.yoy_change ?? null,
        population_five_year_change: economics?.locationQuality?.population?.five_year_change ?? null,
        
        // Crime rates from location_economics_raw_data
        property_crime_rate_location: economics?.locationQuality?.economics?.property_crime_rate ?? null,
        violent_crime_rate_location: economics?.locationQuality?.economics?.violent_crime_rate ?? null,
        
        // Economics from location_economics_raw_data
        cost_of_living_index_location: economics?.locationQuality?.economics?.cost_of_living_index ?? null,
        retail_sales_per_capita_location: economics?.locationQuality?.economics?.retail_sales_per_capita ?? null,
        per_capita_consumer_spending: economics?.locationQuality?.economics?.per_capita_consumer_spending ?? null,
        business_survival_rate: economics?.locationQuality?.economics?.business_survival_rate ?? null,
        
        // Demographics from demographics_raw_data
        population_density: demographics?.coreMetrics?.populationDensity ?? null,
        
        // Development data from location_economics_raw_data
        commercial_development_index: economics?.development?.commercial_development_index ?? null,
        housing_unit_growth: economics?.development?.housing_unit_growth ?? null,
        vehicle_registration_density: economics?.development?.vehicle_registration_density ?? null,
        
        // Accessibility data from competition_raw_data (keep walkability_score)
        walkability_score: competition?.accessibility?.walkability_score ?? null,
        
        // Tourism data from location_economics_raw_data
        tourism_index: economics?.locationQuality?.economics?.tourism_index ?? null,
        tourism_assessment: economics?.locationQuality?.tourism_assessment ?? null,
        
        // Assessment data from competition_raw_data
        accessibility_assessment: competition?.accessibilityAssessment ?? null,
        tourism_assessment_competition: competition?.tourismAssessment ?? null,
        
        // Core metrics from competition_raw_data
        school_rating: competition?.coreMetrics?.schoolRating ?? null,
        air_quality_index: competition?.coreMetrics?.airQualityIndex ?? null,
        violent_crime_rate_competition: competition?.coreMetrics?.violentCrimeRate ?? null,
        property_crime_rate_competition: competition?.coreMetrics?.propertyCrimeRate ?? null,
      })
    } else {
      setCompetitionError("No competition analysis data found.")
      setCompetitionStatus(null)
      setClimate(null)
      setLocationStats(null)
    }
    
    setClimateLoading(false)
    setLocationLoading(false)
    
    // Fetch national averages
    const { data: natData } = await supabase
      .from("national_averages")
      .select("*")
      .eq("year", 2024)
      .single()
    setNationalAverages(natData)
    setRefreshing(false)
  }

  // Replace handleRetry with new implementation
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
        await fetchAllData()
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
    
    // Only fetch if we're actually going to fetch
    fetchAllData()
    // eslint-disable-next-line
  }, [businessId])

  // Remove the mock locationScore useEffect since we're now fetching real data

  // Replace status logic
  const status = locationScore?.analysis_status || "unknown"
  let statusContent = null
  if (refreshing || status === "pending" || status === "processing") {
    statusContent = (
      <div className="flex items-center gap-2 text-blue-600"><span className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></span> Analysis in progress…</div>
    )
  } else if (status === "failed") {
    statusContent = (
      <div className="flex items-center gap-2 text-red-600">Analysis failed. <button onClick={fetchAllData} className="ml-2 px-2 py-1 bg-red-100 rounded hover:bg-red-200">Retry</button></div>
    )
  } else if (status === "completed" || status === "complete") {
    statusContent = null // Show result
  } else {
    statusContent = <div className="text-gray-500">Status: {status}</div>
  }

  // Replace getStatusColor function
  const getStatusColor = (status: string) => {
    if (loading || refreshing || status === "pending" || status === "processing") return "text-blue-600";
    if (status === "failed" || (competitionError && !climate)) return "text-red-600";
    if (status === "completed" || status === "complete") return "text-green-600";
    return "text-gray-500";
  };

  // Replace showMainCards logic
  const showMainCards = true;

  return (
    <div className="space-y-8">
      {/* Top Status & Retry Card */}
      <Card className="flex flex-row items-center justify-between px-6 py-3 mb-2 !bg-gray-300 border border-white shadow">
        {/* Status Text */}
        <div className={`font-medium ${getStatusColor(status)}`}> 
          {loading || refreshing || status === "pending" || status === "processing" ? (
            <span className="flex items-center gap-2"><span className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></span> Analysis in progress…</span>
          ) : (competitionError && !climate) || status === "failed" ? (
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
      {loading && <div className="p-8 text-left text-gray-500">Loading competition analysis...</div>}
      {retryError && <div className="p-2 text-left text-red-500">{retryError}</div>}
      {competitionError && <div className="p-2 text-left text-red-500">{competitionError}</div>}
      {/* Main Cards - only if no error and data exists */}
      {showMainCards && (
        <>
          {locationScore && locationScore.location_score !== null && (
            <Card className="relative">
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900">Location Fit</h3>
              </CardHeader>
              <div className="px-6 pb-6">
                <SummaryBox 
                  assessment={locationScore.location_assessment || 'No assessment available.'} 
                  positives={locationScore.location_positive || []} 
                  negatives={locationScore.location_negative || []}
                  score={locationScore.location_score || 0}
                />

{/* Key Metrics Grid */}
<div className="mb-6">
  <h4 className="text-sm font-semibold text-gray-800 mb-4">
    Quick Facts
  </h4>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
    {/* Population */}
    <Card>
      <div className="p-6">
        <div className="flex items-center text-gray-500 mb-2">
          <span className="text-sm font-medium text-gray-700">Safety</span>
        </div>
        <RatingDisplay rating={ratings.safety} />
      </div>
    </Card>

    {/* Population Density */}
    <Card>
      <div className="p-6">
        <div className="flex items-center text-gray-500 mb-2">
          <span className="text-sm font-medium text-gray-700">Competition</span>
        </div>
        <RatingDisplay rating={ratings.competition} />
      </div>
    </Card>

    {/* Consumer Spending */}
    <Card>
      <div className="p-6">
        <div className="flex items-center text-gray-500 mb-2">
          <span className="text-sm font-medium text-gray-700">Growth</span>
        </div>
        <RatingDisplay rating={ratings.growth} />
      </div>
    </Card>

    {/* Business Survival Rate */}
    <Card>
      <div className="p-6">
        <div className="flex items-center text-gray-500 mb-2">
          <span className="text-sm font-medium text-gray-700">Life Quality</span>
        </div>
        <RatingDisplay rating={ratings.life_quality} />
      </div>
    </Card>
  </div>
</div>
              </div>
            </Card>
          )}
          {/* Map Section - hide completely during export to save space */}
          {!showMapExportOverlay && (
            <Card className="relative">
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900">
                  {businessCategory ? `${businessCategory.display_name || businessCategory.name} in 25 mile radius` : 'Businesses in 25 mile radius'}
                </h3>
              </CardHeader>
              <div className="px-6 pb-6">
                <div className="w-full h-72 md:h-96 lg:h-[450px] bg-gray-50 rounded-xl mb-6 overflow-hidden" style={{ position: 'relative' }}>
                  {loading ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <div className="text-center p-4">
                        <span className="w-12 h-12 mx-auto mb-3 text-blue-500 opacity-80">🗺️</span>
                        <p className="font-medium text-gray-900">Loading map...</p>
                      </div>
                    </div>
                  ) : locationData ? (
                    <GoogleMapsEmbed 
                      locationData={locationData} 
                      businessCategory={businessCategory}
                      className="w-full h-full" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <div className="text-center p-4">
                        <span className="w-12 h-12 mx-auto mb-3 text-red-500 opacity-80">❌</span>
                        <p className="font-medium text-gray-900">Location data not found</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Business metrics grid */}
                {climate && (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Left: Restaurants Nearby */}
                    <Card>
                      <div className="p-6">
                        <div className="flex items-center text-gray-500 mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            {businessCategory
                              ? `${businessCategory.display_name} Nearby`
                              : 'Businesses Nearby'}
                          </span>
                        </div>
                        <div className="text-lg md:text-2xl font-bold text-gray-900">
                          {climate.business_count ?? 'N/A'}
                        </div>
                      </div>
                    </Card>
                    {/* Right: Average Rating */}
                    <Card>
                      <div className="p-6">
                        <div className="flex items-center text-gray-500 mb-2">
                          <span className="text-sm font-medium text-gray-700">Average Rating</span>
                        </div>
                        <div className="flex flex-col items-start">
                          <div className="flex items-center gap-1 md:gap-2">
                            <div className="flex items-center">
                              {[1,2,3,4,5].map(i => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${i <= Math.round(climate.average_rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                                  fill={i <= Math.round(climate.average_rating || 0) ? '#facc15' : 'none'}
                                />
                              ))}
                            </div>
                            <span className="text-lg md:text-2xl font-bold text-gray-900">
                              {climate.average_rating ? climate.average_rating.toFixed(1) : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Economic Growth Assessment Summary */}
                {climate?.economic_growth_assessment && (
                  <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-md overflow-hidden transition-all hover:shadow-lg hover:border-gray-300 p-4 mb-6">
                    <div className="text-sm font-medium text-gray-700 mb-3">Business Climate</div>
                    <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">
                      {cleanAssessmentText(climate.economic_growth_assessment)}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}
          {/* Location Card - exact DemographicsTab styling */}
          <Card>
            <CardHeader>
    <h3 className="text-base font-semibold text-gray-900">
      Location Quality <span className="text-xs text-gray-500 font-normal">(vs. national avg.)</span>
    </h3>
            </CardHeader>
  <div className="px-6 pb-6">
    {/* Four-card grid above table */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
      {/* Property Crime Rate */}
      <Card>
        <div className="p-6">
          <div className="flex items-center text-gray-500 mb-2">
            <span className="text-sm font-medium text-gray-700">Property Crime Rate</span>
          </div>
          {locationStats ? (
            <MetricWithNationalAvg
              metric="property_crime_rate"
              localValue={locationStats?.property_crime_rate_competition ?? 0}
              formatValue={(v) => `${v.toLocaleString()}`}
              maxWidth="220px"
            />
          ) : (
            <span className="text-gray-400">No data available.</span>
          )}
        </div>
      </Card>
      
      {/* Violent Crime Rate */}
      <Card>
        <div className="p-6">
          <div className="flex items-center text-gray-500 mb-2">
            <span className="text-sm font-medium text-gray-700">Violent Crime Rate</span>
          </div>
          {locationStats ? (
            <MetricWithNationalAvg
              metric="violent_crime_rate"
              localValue={locationStats?.violent_crime_rate_competition ?? 0}
              formatValue={(v) => `${v.toLocaleString()}`}
              maxWidth="220px"
            />
          ) : (
            <span className="text-gray-400">No data available.</span>
          )}
        </div>
      </Card>
      
      {/* School Rating */}
      <Card>
        <div className="p-6">
          <div className="flex items-center text-gray-500 mb-2">
            <span className="text-sm font-medium text-gray-700">School Rating</span>
          </div>
          {locationStats?.school_rating ? (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1 md:gap-2">
                <div className="flex items-center">
                  {[1,2,3,4,5].map(i => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i <= Math.round(locationStats.school_rating / 2) ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill={i <= Math.round(locationStats.school_rating / 2) ? '#facc15' : 'none'}
                    />
                  ))}
                </div>
                <span className="text-lg md:text-2xl font-bold text-gray-900">
                  {(locationStats.school_rating / 2).toFixed(1)}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-gray-400">No data available.</span>
          )}
        </div>
      </Card>
      
      {/* Air Quality Index */}
      <Card>
        <div className="p-6">
          <div className="flex items-center text-gray-500 mb-2">
            <span className="text-sm font-medium text-gray-700">Air Quality Index</span>
          </div>
          {locationStats?.air_quality_index !== null && locationStats?.air_quality_index !== undefined ? (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1 md:gap-2">
                <span className="text-lg md:text-2xl font-bold text-gray-900">
                  {locationStats.air_quality_index}
                </span>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  locationStats.air_quality_index <= 50 ? 'bg-green-100 text-green-800' :
                  locationStats.air_quality_index <= 100 ? 'bg-yellow-100 text-yellow-800' :
                  locationStats.air_quality_index <= 150 ? 'bg-orange-100 text-orange-800' :
                  locationStats.air_quality_index <= 200 ? 'bg-red-100 text-red-800' :
                  locationStats.air_quality_index <= 300 ? 'bg-purple-100 text-purple-800' :
                  'bg-red-900 text-white'
                }`}>
                  {locationStats.air_quality_index <= 50 ? 'Good' :
                   locationStats.air_quality_index <= 100 ? 'Moderate' :
                   locationStats.air_quality_index <= 150 ? 'Slightly Bad' :
                   locationStats.air_quality_index <= 200 ? 'Bad' :
                   locationStats.air_quality_index <= 300 ? 'Very Bad' :
                   'Hazardous'}
                </div>
                {nationalAverages?.air_quality_index && (
                  (() => {
                    const percentDiff = ((locationStats.air_quality_index - nationalAverages.air_quality_index) / nationalAverages.air_quality_index) * 100;
                    const isUp = percentDiff > 0;
                    const isDown = percentDiff < 0;
                    const { TrendingUp, TrendingDown } = require('lucide-react');
                    // For AQI, lower is better, so reverse the colors
                    return (
                      <div className={`inline-flex items-center gap-1 px-1 md:px-2 py-1 rounded-full text-[10px] md:text-xs font-medium ${
                        isUp ? 'bg-red-50 text-red-700' : isDown ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                      } min-w-[50px] md:min-w-[60px] justify-center`}>
                        {isUp && <TrendingUp className="w-3 h-3" />}
                        {isDown && <TrendingDown className="w-3 h-3" />}
                        <span>
                          {isUp ? '+' : isDown ? '-' : ''}{Math.abs(percentDiff).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          ) : (
            <span className="text-gray-400">No data available.</span>
          )}
        </div>
      </Card>
    </div>

    {/* Accessibility Assessment Summary Box */}
    {locationStats?.accessibility_assessment && (
      <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-md overflow-hidden transition-all hover:shadow-lg hover:border-gray-300 p-4 mb-6">
        <div className="text-sm font-medium text-gray-700 mb-3">Accessibility</div>
        <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">
          {cleanAssessmentText(locationStats.accessibility_assessment)}
        </p>
      </div>
    )}

    {/* Tourism Summary Box - INSIDE the Location Quality card */}
    <TourismSummaryBox 
      assessment={locationStats?.tourism_assessment_competition || "Tourism assessment based on local tourism industry data and visitor patterns."}
      tourismIndex={locationStats?.tourism_index}
      tourismDeviation={locationStats?.tourism_index && nationalAverages?.tourism_index 
        ? ((locationStats.tourism_index - nationalAverages.tourism_index) / nationalAverages.tourism_index) * 100 
        : 0}
    />
              </div>
            </Card>
        </>
      )}
    </div>
  )
}

export default CompetitionTab 
