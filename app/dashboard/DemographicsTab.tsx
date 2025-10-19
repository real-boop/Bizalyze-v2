import React, { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader } from "./components/UIComponents"

// Define the expected shape of the demographics data
interface DemographicsData {
  median_income: number | null;
  median_age: number | null;
  population_density: number | null;
  homeownership_rate: number | null;
  employment_rate: number | null;
  population_2024: number | null;
  population_2023: number | null;
  median_rent: number | null;
  average_home_values: number | null;
  ethnicity_distribution: Record<string, number> | null;
  household_income_distribution: Record<string, number> | null;
  age_distribution: Record<string, number> | null;
  average_household_size: number | null;
  demographics_status: string | null;
  livingCosts: {
    averageResidentialRent: number | null;
    avgSqftPriceResidential: number | null;
    commercialRentPerSqft: { office: number | null; retail: number | null; industrial: number | null };
    avgSqftPriceCommercial: { office: number | null; retail: number | null; industrial: number | null };
  } | null;
  cost_of_living_index: number | null;
  purchasingPowerAssessment: string | null;
  operatingCostsAssessment: string | null;
}

// Add new interface for demographics score data
interface DemographicsScoreData {
  demographics_score: number | null;
  demographics_assessment: string | null;
  demographics_positive: string[] | null;
  demographics_negative: string[] | null;
}

interface DemographicsTabProps {
  businessId: string;
  expandAllDetails?: boolean;
}

// ADDED: getScoreInfo function (moved outside main component)
const getScoreInfo = (score: number) => {
  if (score > 6) return { 
    label: 'Good', 
    gradient: 'linear-gradient(45deg, #10b981, #059669)',
    glassBg: 'bg-green-50/80',
    textColor: 'text-green-700'
  };
  if (score >= 4) return { 
    label: 'Average', 
    gradient: 'linear-gradient(45deg, #f59e0b, #d97706)',
    glassBg: 'bg-yellow-50/80',
    textColor: 'text-yellow-700'
  };
  return { 
    label: 'Poor', 
    gradient: 'linear-gradient(45deg, #ef4444, #dc2626)',
    glassBg: 'bg-red-50/80',
    textColor: 'text-red-700'
  };
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
            <span key={index} className="px-3 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200 font-medium">
              {keyword}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Negatives</h4>
        <div className="flex flex-wrap gap-2">
          {negatives.map((keyword, index) => (
            <span key={index} className="px-3 py-1 bg-red-50 text-red-700 text-xs rounded-full border border-red-200 font-medium">
              {keyword}
            </span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const DemographicsTab: React.FC<DemographicsTabProps> = ({ businessId, expandAllDetails = false }) => {
  const [demographics, setDemographics] = useState<DemographicsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const [nationalAverages, setNationalAverages] = useState<any | null>(null)
  const [demographicsScore, setDemographicsScore] = useState<DemographicsScoreData | null>(null)
  const [scoreData, setScoreData] = useState<any | null>(null)

  // Ref guards to prevent refetching
  const hasFetchedRef = useRef(false)
  const lastBusinessIdRef = useRef<string | null>(null)

  // Add state for collapsible sections
  const [expandedSections, setExpandedSections] = useState<{
    ethnicity: boolean;
    income: boolean;
    age: boolean;
    livingCosts: boolean;
  }>({
    ethnicity: false,
    income: false,
    age: false,
    livingCosts: false
  });

  // Toggle function for sections
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Expand all sections when exporting
  useEffect(() => {
    if (expandAllDetails) {
      setExpandedSections({
        ethnicity: true,
        income: true,
        age: true,
        livingCosts: true
      });
    }
  }, [expandAllDetails]);

  // Fetch from location_data_collection.demographics_raw_data
  const fetchDemographics = async () => {
    setLoading(true)
    setError(null)
    
    // Fetch demographics data
    const { data, error } = await supabase
      .from("location_data_collection")
      .select("demographics_raw_data, demographics_status, location_economics_raw_data")
      .eq("business_id", businessId)
      .order("demographics_collected_at", { ascending: false })
      .limit(1)
      .single()
    
    // Fetch demographics score data - get raw_response instead of separate columns
    const { data: scoreData, error: scoreError } = await supabase
      .from("demographics_score")
      .select("raw_response, analysis_status")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    
    if (error) {
      setError("Failed to load demographics data.")
      setDemographics(null)
    } else if (data && data.demographics_raw_data) {
      const raw = data.demographics_raw_data
      let locationEconomics = null
      
      // Parse location economics data
      if (data.location_economics_raw_data) {
        try {
          locationEconomics = typeof data.location_economics_raw_data === 'string' 
            ? JSON.parse(data.location_economics_raw_data) 
            : data.location_economics_raw_data
        } catch (e) {
          console.error("Failed to parse location economics data:", e)
        }
      }
      
      setDemographics({
        median_income: raw.coreMetrics?.medianIncome ?? null,
        median_age: raw.coreMetrics?.medianAge ?? null,
        population_density: locationEconomics?.coreMetrics?.populationDensity ?? null,
        homeownership_rate: raw.coreMetrics?.homeOwnershipRate ?? null,
        employment_rate: raw.coreMetrics?.employmentRate ?? null,
        population_2024: locationEconomics?.coreMetrics?.population2024 ?? null,
        population_2023: locationEconomics?.coreMetrics?.population2023 ?? null,
        median_rent: locationEconomics?.coreMetrics?.medianRent ?? null,
        average_home_values: locationEconomics?.coreMetrics?.averageHomeValues ?? null,
        ethnicity_distribution: raw.populationComposition?.ethnicityDistribution ?? null,
        household_income_distribution: raw.populationComposition?.householdIncomeDistribution ?? null,
        age_distribution: raw.populationComposition?.ageDistribution ?? null,
        average_household_size: raw.coreMetrics?.averageHouseholdSize ?? null,
        demographics_status: data.demographics_status ?? null,
        livingCosts: raw.livingCosts ?? null,
        cost_of_living_index: locationEconomics?.locationQuality?.economics?.cost_of_living_index ?? null,
        purchasingPowerAssessment: raw.purchasingPowerAssessment ?? null,
        operatingCostsAssessment: locationEconomics?.operatingCostsAssessment ?? null,
      })
    } else {
      setError("No demographics data found.")
      setDemographics(null)
    }
    
    // Set demographics score data from raw_response
    if (scoreData && scoreData.raw_response) {
      let parsed = scoreData.raw_response
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed)
        } catch (e) {
          console.error("Failed to parse demographics score data:", e)
          setDemographicsScore(null)
          setLoading(false)
          return
        }
      }
      
      setDemographicsScore({
        demographics_score: parsed.demographics_score ?? null,
        demographics_assessment: parsed.demographics_assessment ?? null,
        demographics_positive: parsed.demographics_positive_tags ?? null,
        demographics_negative: parsed.demographics_negative_tags ?? null,
      })
    } else {
      setDemographicsScore(null)
    }
    
    // Store scoreData for status
    setScoreData(scoreData)
    
    setLoading(false)
    
    // Fetch national averages for 2024 (single row, all metrics)
    supabase
      .from("national_averages")
      .select("*")
      .eq("year", 2024)
      .single()
      .then(({ data }) => {
        setNationalAverages(data)
      })
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
    
    fetchDemographics()
    return () => {}
  }, [businessId])

  // Status UI logic
  const status = scoreData?.analysis_status || "unknown"
  let statusContent = null
  if (loading || refreshing || status === "pending" || status === "processing") {
    statusContent = (
      <div className="flex items-center gap-2 text-blue-600"><span className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></span> Analysis in progress…</div>
    )
  } else if (status === "failed") {
    statusContent = (
      <div className="flex items-center gap-2 text-red-600">Analysis failed. <button onClick={fetchDemographics} className="ml-2 px-2 py-1 bg-red-100 rounded hover:bg-red-200">Retry</button></div>
    )
  } else if (status === "completed" || status === "complete") {
    statusContent = null // Show result
  } else {
    statusContent = <div className="text-gray-500">Status: {status}</div>
  }

  const COLORS = ["#34C759", "#5AC8FA", "#007AFF", "#AF52DE", "#FF9500", "#FF2D55"]
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)

  // Format Home Ownership and Employment Rate as percentages
  const formatPercent = (value: number) => {
    if (value <= 1) {
      return `${(value * 100).toFixed(0)}%`;
    }
    return `${value.toFixed(0)}%`;
  };

  const formatHomeValue = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return `$${value.toLocaleString()}`;
  };
  
  const formatPopulation = (value: number): string => {
    return value.toLocaleString();
  };

  // Enhanced text cleaning function for assessment text boxes
  const cleanAssessmentText = (text: string) => {
    if (!text) return text;
    
    // 1. Remove all source references [x] or [x][y][z]
    let cleaned = text.replace(/\[\d+\]/g, '');
    
    // 2. Fix "k" values that should be monetary (90k, 100k, etc.) in income context
    cleaned = cleaned.replace(/\b(\d+)k\b/g, (match, num) => {
      // Check if this k value is in a monetary context
      const beforeMatch = cleaned.substring(0, cleaned.indexOf(match));
      const afterMatch = cleaned.substring(cleaned.indexOf(match) + match.length);
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
    cleaned = cleaned.replace(/\b(\d{4,})\b/g, (match, num) => {
      const number = parseInt(num);
      // Skip years, scores, ranges, percentages, and areas
      if (number >= 1900 && number <= 2100) return match; // years
      if (number <= 100 && !match.includes('.')) return match; // scores
      if (match.includes('-') || match.includes('%')) return match; // ranges/percentages
      
      // Check if this number is followed by area measurements
      const afterMatch = cleaned.substring(cleaned.indexOf(match) + match.length);
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

  // Utility function for percent difference
  function getPercentDiff(local: number, national: number | null) {
    if (typeof local !== 'number' || typeof national !== 'number' || national === 0) return null;
    return ((local - national) / national) * 100;
  }

  // Component to show value with national average comparison
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
    
    // Custom metric mappings for national averages
    const getNationalMetric = (metric: string) => {
      const mappings: { [key: string]: string } = {
        'median_rent': 'average_residential_rent',
        'average_home_values': 'median_home_price'
      };
      const nationalMetric = mappings[metric] || metric;
      return nationalAverages ? nationalAverages[nationalMetric] : null;
    };
    
    const nationalValue = getNationalMetric(metric);
    const percentDiff =
      nationalValue && typeof localValue === 'number' && typeof nationalValue === 'number' && nationalValue !== 0
        ? ((localValue - nationalValue) / nationalValue) * 100
        : null;
    const isUp = percentDiff !== null && percentDiff > 0;
    const isDown = percentDiff !== null && percentDiff < 0;
    
    // UPDATED: Neutral color logic for demographics metrics (removed median_income)
    const useNeutralColors = metric === 'median_age' || metric === 'average_household_size' || 
                            metric === 'homeownership_rate';
    const pillColor = useNeutralColors ? 'text-gray-600' : (isUp ? 'text-green-600' : 'text-red-600');
    const pillBgColor = useNeutralColors ? 'bg-gray-100' : (isUp ? 'bg-green-50' : 'bg-red-50');
    
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
        await fetchDemographics()
      }
    } catch (err: any) {
      setRetryError(err.message || "Failed to retry analysis.")
    }
    setRefreshing(false)
  }

  // Helper for status color
  const getStatusColor = (status: string) => {
    if (loading || refreshing || status === "pending" || status === "processing") return "text-blue-600";
    if (status === "failed" || (error && !demographics)) return "text-red-600";
    if (status === "completed" || status === "complete") return "text-green-600";
    return "text-gray-500";
  };

  // Show only the top bar and error message if error or no data
  const showMainCards = true;

  // Ethnicity mapping
  const ethnicityMap: { [key: string]: string } = {
    asian: "Asian",
    other: "Other",
    hispanicLatino: "Hispanic/Latino",
    whiteCaucasian: "White/Caucasian",
    blackAfricanAmerican: "Black/African American"
  };

  let ethnicityDistribution: { group: string; percentage: number }[] = [];
  let incomeDist: { group: string; percentage: number }[] = [];
  if (demographics) {
    ethnicityDistribution =
      demographics.ethnicity_distribution && typeof demographics.ethnicity_distribution === "object"
        ? Object.entries(demographics.ethnicity_distribution).map(([key, value]) => ({
            group: ethnicityMap[key] || key,
            percentage: typeof value === 'number' ? value : Number(value)
          }))
        : [];
    // Income mapping
    const incomeOrder = [
      { key: "under50k", label: "Under $50K" },
      { key: "from50kTo100k", label: "$50K-$100K" },
      { key: "from100kTo150k", label: "$100K-$150K" },
      { key: "from150kTo200k", label: "$150K-$200K" },
      { key: "over200k", label: "Over $200K" }
    ];
    incomeDist = incomeOrder.map(({ key, label }) => ({
      group: label,
      percentage: demographics.household_income_distribution && demographics.household_income_distribution[key] ? demographics.household_income_distribution[key] : 0
    }));
  }

  // Age Distribution mapping
  let ageDist: { group: string; percentage: number }[] = [];
  if (demographics && demographics.age_distribution) {
    const ageMap: { [key: string]: string } = {
      under25: "Under 25",
      age25to44: "25-44",
      age45to64: "45-64",
      age65plus: "65+"
    };
    ageDist = Object.entries(demographics.age_distribution).map(([key, value]) => ({
      group: ageMap[key] || key,
      percentage: typeof value === 'number' ? value : Number(value)
    }));
  }

  // Score badge component with gradient border and glass morphism
  const ScoreBadge = ({ score }: { score: number }) => {
    const scoreInfo = getScoreInfo(score);

    return (
      <div className="mb-4">
        <div 
          className="rounded-lg p-1"
          style={{ background: scoreInfo.gradient }}
        >
          <div className={`w-full px-6 py-3 ${scoreInfo.glassBg} backdrop-blur-sm rounded-md font-semibold text-center ${scoreInfo.textColor}`}>
            {scoreInfo.label}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Status & Retry Card */}
      <Card className="flex flex-row items-center justify-between px-6 py-3 mb-2 !bg-gray-300 border border-white shadow">
        {/* Status Text */}
        <div className={`font-medium ${getStatusColor(status)}`}>
          {loading || refreshing || status === "pending" || status === "processing" ? (
            <span className="flex items-center gap-2"><span className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></span> Analysis in progress…</span>
          ) : (error && !demographics) || status === "failed" ? (
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
      {loading && <div className="p-8 text-left text-gray-500">Loading demographics...</div>}
      {retryError && <div className="p-2 text-left text-red-500">{retryError}</div>}
      {error && !demographics && <div className="p-2 text-left text-red-500">{error}</div>}
      
      {/* Main Cards - always visible now */}
      {showMainCards && (
        <>
          {/* Score Badge and Summary Box */}
          {demographicsScore && demographicsScore.demographics_score ? (
            <Card className="relative">
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900">Demographics Fit</h3>
              </CardHeader>
              <div className="px-6 pb-6">
                <SummaryBox 
                  assessment={demographicsScore.demographics_assessment || "No assessment available."}
                  positives={demographicsScore.demographics_positive || []}
                  negatives={demographicsScore.demographics_negative || []}
                  score={demographicsScore.demographics_score || 0}
                />
                
                {/* Key Demographics - moved under summary box, smaller header */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-4">
                    Key Demographics <span className="text-xs text-gray-500 font-normal">(vs. national avg.)</span>
                  </h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {/* Population 2024 */}
                    <Card>
                      <div className="p-6">
                        <div className="flex items-center text-gray-500 mb-2">
                          <span className="text-sm font-medium text-gray-700">Population</span>
                        </div>
                        {demographics ? (
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-1 md:gap-2">
                              <span className="text-lg md:text-2xl font-bold text-gray-900">
                                {demographics?.population_2024 ? formatPopulation(demographics.population_2024) : 'N/A'}
                              </span>
                              {demographics?.population_2024 && demographics?.population_2023 && (
                                (() => {
                                  const yoyChange = ((demographics.population_2024 - demographics.population_2023) / demographics.population_2023) * 100;
                                  const isPositive = yoyChange > 0;
                                  const { TrendingUp, TrendingDown } = require('lucide-react');
                                  return (
                                    <div className={`inline-flex items-center gap-1 px-1 md:px-2 py-1 rounded-full text-[10px] md:text-xs font-medium ${
                                      isPositive ? 'bg-green-50 text-green-700' : 
                                      yoyChange < 0 ? 'bg-red-50 text-red-700' : 
                                      'bg-gray-100 text-gray-600'
                                    } min-w-[50px] md:min-w-[60px] justify-center`}>
                                      {isPositive && <TrendingUp className="w-3 h-3" />}
                                      {yoyChange < 0 && <TrendingDown className="w-3 h-3" />}
                                      <span>
                                        {isPositive ? '+' : ''}{yoyChange.toFixed(1)}% 1Y
                                      </span>
                                    </div>
                                  );
                                })()
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">No demographics data found.</span>
                        )}
                      </div>
                    </Card>
                    {/* Population Density */}
                    <Card>
                      <div className="p-6">
                        <div className="flex items-center text-gray-500 mb-2">
                          <span className="text-sm font-medium text-gray-700">Population <span className="text-xs font-normal">(per sq mi)</span></span>
                        </div>
                        {demographics ? (
                          <MetricWithNationalAvg
                            metric="population_density"
                            localValue={demographics?.population_density ?? 0}
                            formatValue={(v) => v.toLocaleString()}
                            maxWidth="220px"
                          />
                        ) : (
                          <span className="text-gray-400">No demographics data found.</span>
                        )}
                      </div>
                    </Card>
                    {/* Median Age */}
                    <Card>
                      <div className="p-6">
                        <div className="flex items-center text-gray-500 mb-2">
                          <span className="text-sm font-medium text-gray-700">Median Age</span>
                        </div>
                        {demographics ? (
                          <MetricWithNationalAvg
                            metric="median_age"
                            localValue={demographics?.median_age ?? 0}
                            formatValue={(v) => v.toString()}
                            maxWidth="220px"
                          />
                        ) : (
                          <span className="text-gray-400">No demographics data found.</span>
                        )}
                      </div>
                    </Card>
                    {/* Average Household Size */}
                    <Card>
                      <div className="p-6">
                        <div className="flex items-center text-gray-500 mb-2">
                          <span className="text-sm font-medium text-gray-700">Household Size</span>
                        </div>
                        {demographics ? (
                          <MetricWithNationalAvg
                            metric="average_household_size"
                            localValue={demographics?.average_household_size ?? 0}
                            formatValue={(v) => v.toString()}
                            maxWidth="220px"
                          />
                        ) : (
                          <span className="text-gray-400">No demographics data found.</span>
                        )}
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            // Show placeholder when no demographics score data exists
            <Card className="relative">
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900">Demographics Assessment</h3>
              </CardHeader>
              <div className="px-6 pb-6">
                <div className="text-center text-gray-500 py-8">
                  <p>No demographics assessment available yet.</p>
                  <p className="text-sm mt-2">The assessment will appear here once the demographics analysis is complete.</p>
                </div>
              </div>
            </Card>
          )}

          {/* NEW: Detailed Population Data Card */}
          <Card className="relative">
            <CardHeader>
              <h3 className="text-base font-semibold text-gray-900">Detailed Population Data</h3>
            </CardHeader>
            <div className="px-6 pb-6 space-y-4">
              {/* Ethnicity Distribution */}
              <div className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleSection('ethnicity')}
                  className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <h4 className="text-sm font-medium text-gray-700">Ethnicity Distribution</h4>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.ethnicity ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.ethnicity && (
                  <div className="px-4 pb-4">
                    {demographics && ethnicityDistribution.length > 0 ? (
                      <>
                        <div className="w-full h-12 mb-6 relative">
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/0 via-white/20 to-white/0 pointer-events-none z-20" />
                          <div className="w-full h-full flex rounded-xl overflow-hidden relative z-0">
                            {ethnicityDistribution.map((entry, i) => (
                              <div
                                key={i}
                                className={`h-full transition-all duration-300 hover:opacity-90 border-r border-white ${i === ethnicityDistribution.length - 1 ? '' : ''}`}
                                style={{
                                  width: `${entry.percentage}%`,
                                  backgroundColor: COLORS[i % COLORS.length],
                                  boxShadow: 'inset 0 2px 16px 0 rgba(0,0,0,0.18)',
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4">
                          {ethnicityDistribution.map((entry, i) => {
                            const isHighest = entry.percentage === Math.max(...ethnicityDistribution.map(e => e.percentage));
                            return (
                              <div key={i} className="flex items-center">
                                <div className="w-3 h-3 mr-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                <span className={`text-sm text-gray-700 ${isHighest ? 'font-bold' : ''}`}>
                                  {entry.group}: {entry.percentage}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-gray-400 py-8">No ethnicity data found.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Income Distribution */}
              <div className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleSection('income')}
                  className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <h4 className="text-sm font-medium text-gray-700">Income Distribution</h4>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.income ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.income && (
                  <div className="px-4 pb-4">
                    {demographics && incomeDist.length > 0 ? (
                      <>
                        <div className="w-full h-12 mb-6 relative">
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/0 via-white/20 to-white/0 pointer-events-none z-20" />
                          <div className="w-full h-full flex rounded-xl overflow-hidden relative z-0">
                            {incomeDist.map((entry, i) => (
                              <div
                                key={i}
                                className={`h-full transition-all duration-300 hover:opacity-90 border-r border-white ${i === incomeDist.length - 1 ? '' : ''}`}
                                style={{
                                  width: `${entry.percentage}%`,
                                  backgroundColor: COLORS[i % COLORS.length],
                                  boxShadow: 'inset 0 2px 16px 0 rgba(0,0,0,0.18)',
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4">
                          {incomeDist.map((entry, i) => {
                            const isHighest = entry.percentage === Math.max(...incomeDist.map(e => e.percentage));
                            return (
                              <div key={i} className="flex items-center">
                                <div className="w-3 h-3 mr-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                <span className={`text-sm text-gray-700 ${isHighest ? 'font-bold' : ''}`}>
                                  {entry.group}: {entry.percentage}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-gray-400 py-8">No income distribution data found.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Age Distribution */}
              <div className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleSection('age')}
                  className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <h4 className="text-sm font-medium text-gray-700">Age Distribution</h4>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.age ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.age && (
                  <div className="px-4 pb-4">
                    {ageDist.length > 0 ? (
                      <>
                        <div className="w-full h-12 mb-6 relative">
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/0 via-white/20 to-white/0 pointer-events-none z-20" />
                          <div className="w-full h-full flex rounded-xl overflow-hidden relative z-0">
                            {ageDist.map((entry, i) => (
                              <div
                                key={i}
                                className={`h-full transition-all duration-300 hover:opacity-90 border-r border-white ${i === ageDist.length - 1 ? '' : ''}`}
                                style={{
                                  width: `${entry.percentage}%`,
                                  backgroundColor: COLORS[i % COLORS.length],
                                  boxShadow: 'inset 0 2px 16px 0 rgba(0,0,0,0.18)',
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4">
                          {ageDist.map((entry, i) => {
                            const isHighest = entry.percentage === Math.max(...ageDist.map(e => e.percentage));
                            return (
                              <div key={i} className="flex items-center">
                                <div className="w-3 h-3 mr-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                <span className={`text-sm text-gray-700 ${isHighest ? 'font-bold' : ''}`}>
                                  {entry.group}: {entry.percentage}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-gray-400 py-8">No age distribution data found.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Living Costs - always visible */}
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-gray-900">
                Purchasing Power <span className="text-xs text-gray-500 font-normal">(vs. national avg.)</span>
              </h3>
            </CardHeader>
            <div className="px-6 pb-6">
              {/* Four-card grid matching key demographics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
                {/* Median Income */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-2">
                      <span className="text-sm font-medium text-gray-700">Median Income</span>
                    </div>
                    {demographics ? (
                      <MetricWithNationalAvg
                        metric="median_income"
                        localValue={demographics?.median_income ?? 0}
                        formatValue={formatCurrency}
                        maxWidth="220px"
                      />
                    ) : (
                      <span className="text-gray-400">No demographics data found.</span>
                    )}
                  </div>
                </Card>
                {/* Median Rent */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-2">
                      <span className="text-sm font-medium text-gray-700">Median Rent</span>
                    </div>
                    {demographics ? (
                      <MetricWithNationalAvg
                        metric="median_rent"
                        localValue={demographics?.median_rent ?? 0}
                        formatValue={(v) => `$${v.toLocaleString()}`}
                        maxWidth="220px"
                      />
                    ) : (
                      <span className="text-gray-400">No demographics data found.</span>
                    )}
                  </div>
                </Card>
                {/* Avg. Home Value */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-2">
                      <span className="text-sm font-medium text-gray-700">Avg. Home Value</span>
              </div>
                    {demographics ? (
                      <MetricWithNationalAvg
                        metric="average_home_values"
                        localValue={demographics?.average_home_values ?? 0}
                        formatValue={formatHomeValue}
                        maxWidth="220px"
                      />
                    ) : (
                      <span className="text-gray-400">No demographics data found.</span>
                    )}
                                      </div>
                </Card>
                {/* Employment Rate */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-2">
                      <span className="text-sm font-medium text-gray-700">Employment Rate</span>
                                      </div>
                    {demographics ? (
                      <MetricWithNationalAvg
                        metric="employment_rate"
                        localValue={demographics?.employment_rate ?? 0}
                        formatValue={formatPercent}
                        maxWidth="220px"
                      />
                    ) : (
                      <span className="text-gray-400">No demographics data found.</span>
                    )}
                  </div>
                </Card>
              </div>

              {/* Local Purchasing Power Summary */}
              <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-md overflow-hidden transition-all hover:shadow-lg hover:border-gray-300 p-4">
                <div className="text-sm font-medium text-gray-700 mb-3">Local Purchasing Power</div>
                <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">
                  {cleanAssessmentText(demographics?.purchasingPowerAssessment || "No purchasing power assessment available.")}
                </p>
              </div>

              {/* Local Operating Costs Summary */}
              <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-md overflow-hidden transition-all hover:shadow-lg hover:border-gray-300 p-4 mt-6">
                <div className="text-sm font-medium text-gray-700 mb-3">Local Operating Costs</div>
                <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">
                  {cleanAssessmentText(demographics?.operatingCostsAssessment || "No operating costs assessment available.")}
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

export default DemographicsTab 
