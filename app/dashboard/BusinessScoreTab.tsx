import React, { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader } from "./components/UIComponents"
import { useState as useAccordionState } from "react"
import { BarChart3, Award } from 'lucide-react'

// Define the expected shape of the business analysis data
interface BusinessAnalysisData {
  revenue: number | null;
  cash_flow: number | null;
  revenue_multiple_result?: string | null;
  revenue_multiple_score?: number | null;
  sde_multiple_result?: string | null;
  sde_multiple_score?: number | null;
  profit_margin_result?: string | null;
  profit_margin_score?: number | null;
  revenue_per_sqft_result?: string | null;
  revenue_per_sqft_score?: number | null;
  years_operation_result?: string | null;
  years_operation_score?: number | null;
  lease_terms_result?: string | null;
  lease_terms_score?: number | null;
  analysis_status?: string | null;
  score_percentage?: number | null;
  lease_remaining_years?: number | null;
  lease_renewal_options?: string | null;
  equipment_age?: string | null;
  equipment_description?: string | null;
  ff_and_e?: number | null;
  washer_count?: number | null;
  dryer_count?: number | null;
  payment_system_type?: string | null;
  payment_system_description?: string | null;
  years_in_operation?: number | null;
  monthly_rent?: number | null;
  square_footage?: number | null;
  employees?: number | null | string;
  misc_details?: string[] | null;
  soft_factors_score?: number | null;
  soft_factors_positive?: string[] | null;
  soft_factors_negative?: string[] | null;
  business_verdict?: string | null;
  operational_score_total?: number | null;
}

interface BusinessScoreTabProps {
  businessId: string;
  expandAllDetails?: boolean;
}

// Remove ScoreGauge component (lines 52-101)

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

const InlineScoreBar = ({ score, label }: { score: number; label: string }) => {
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

const SummaryBox = ({ 
  assessment, 
  positives, 
  negatives, 
  operationalScore,
  softFactorsScore
}: { 
  assessment: string; 
  positives: string[];
  negatives: string[];
  operationalScore?: number;
  softFactorsScore?: number;
}) => (
  <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-md overflow-hidden transition-all hover:shadow-lg hover:border-gray-300 p-4 mb-6">
    <div className="text-sm font-medium text-gray-700 mb-3">Summary</div>
    
    {/* Two inline score bars - vertically stacked */}
    <div className="space-y-3 mb-4">
      {/* Key Metrics Score Bar */}
      {operationalScore !== undefined && (
        <div>
          <div className="text-xs text-gray-600 mb-1">Operations</div>
          <InlineScoreBar score={operationalScore} label="Key Metrics" />
        </div>
      )}
      
      {/* Soft Factors Score Bar */}
      {softFactorsScore !== undefined && (
        <div>
          <div className="text-xs text-gray-600 mb-1">Soft Factors</div>
          <InlineScoreBar score={softFactorsScore} label="Soft Factors" />
        </div>
      )}
    </div>
    
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

const BusinessScoreTab: React.FC<BusinessScoreTabProps> = ({ businessId, expandAllDetails = false }) => {
  const [analysis, setAnalysis] = useState<BusinessAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  // Ref guards to prevent refetching
  const hasFetchedRef = useRef(false)
  const lastBusinessIdRef = useRef<string | null>(null)

  // Accordion state for each section (must be at top level)
  const [openLease, setOpenLease] = useState(true);
  const [openEquipment, setOpenEquipment] = useState(false);
  const [openPayment, setOpenPayment] = useState(false);
  const [openOther, setOpenOther] = useState(false);
  const [openPositive, setOpenPositive] = useState(false);
  const [openNegative, setOpenNegative] = useState(false);

  // Expand all details if prop is true
  useEffect(() => {
    if (expandAllDetails) {
      setOpenLease(true);
      setOpenEquipment(true);
      setOpenPayment(true);
      setOpenOther(true);
      setOpenPositive(true);
      setOpenNegative(true);
    }
  }, [expandAllDetails]);

  const fetchAnalysis = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from("operational_score")
      .select("raw_response, analysis_status")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    if (error) {
      setError("Failed to load business analysis data.")
      setAnalysis(null)
    } else if (data) {
      let parsed = data.raw_response
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed)
        } catch (e) {
          setError("Failed to parse analysis data.")
          setAnalysis(null)
          setLoading(false)
          return
        }
      }
      setAnalysis({
        revenue: parsed.revenue ?? null,
        cash_flow: parsed.cash_flow ?? null,
        revenue_multiple_result: parsed.revenue_multiple_result ?? null,
        revenue_multiple_score: parsed.revenue_multiple_score ?? null,
        sde_multiple_result: parsed.sde_multiple_result ?? null,
        sde_multiple_score: parsed.sde_multiple_score ?? null,
        profit_margin_result: parsed.profit_margin_result ?? null,
        profit_margin_score: parsed.profit_margin_score ?? null,
        revenue_per_sqft_result: parsed.revenue_per_sqft_result ?? null,
        revenue_per_sqft_score: parsed.revenue_per_sqft_score ?? null,
        years_operation_result: parsed.years_operation_result ?? null,
        years_operation_score: parsed.years_operation_score ?? null,
        lease_terms_result: parsed.lease_terms_result ?? null,
        lease_terms_score: parsed.lease_terms_score ?? null,
        analysis_status: data.analysis_status ?? null,
        score_percentage: parsed.operational_score_percentage ?? null,
        lease_remaining_years: parsed.lease_remaining_years ?? null,
        lease_renewal_options: parsed.lease_renewal_options ?? null,
        equipment_age: parsed.equipment_age ?? null,
        equipment_description: parsed.equipment_description ?? null,
        ff_and_e: parsed.ff_and_e ?? null,
        washer_count: parsed.washer_count ?? null,
        dryer_count: parsed.dryer_count ?? null,
        payment_system_type: parsed.payment_system_type ?? null,
        payment_system_description: parsed.payment_system_description ?? null,
        years_in_operation: parsed.years_in_operation ?? null,
        monthly_rent: parsed.monthly_rent ?? null,
        square_footage: parsed.square_footage ?? null,
        employees: parsed.employees ?? null,
        misc_details: parsed.misc_details ?? null,
        soft_factors_score: parsed.soft_factors_score ?? null,
        soft_factors_positive: parsed.soft_factors_positive ?? null,
        soft_factors_negative: parsed.soft_factors_negative ?? null,
        business_verdict: parsed.business_verdict ?? null,
        operational_score_total: parsed.operational_score_total ?? null,
      })
    } else {
      setAnalysis(null)
    }
    setLoading(false)
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
    
    let isMounted = true
    setLoading(true)
    setError(null)
    fetchAnalysis()
    return () => {
      isMounted = false
    }
  }, [businessId])

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined || isNaN(Number(value))) return "N/A";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value))
  }
  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined || isNaN(Number(value))) return "N/A";
    return Number(value).toLocaleString();
  }
  const formatString = (value: string | null) => {
    if (!value) return "N/A";
    return value;
  }

  // Helper to normalize result values
  const normalizeResult = (value: string | null) => {
    if (value === null || value === undefined || value === '' || value === 'null') return 'N/A';
    return value;
  };

  // Prepare scoring data from analysis (NEW 6 metrics)
  const scoringRows = analysis ? [
    {
      metric: "Revenue Multiple",
      result: normalizeResult(analysis.revenue_multiple_result ?? null),
      score: analysis.revenue_multiple_score ?? null,
    },
    {
      metric: "Cash Flow Multiple",
      result: normalizeResult(analysis.sde_multiple_result ?? null),
      score: analysis.sde_multiple_score ?? null,
    },
    {
      metric: "Profit Margin",
      result: normalizeResult(analysis.profit_margin_result ?? null),
      score: analysis.profit_margin_score ?? null,
    },
    {
      metric: "Revenue per SqFt",
      result: normalizeResult(analysis.revenue_per_sqft_result ?? null),
      score: analysis.revenue_per_sqft_score ?? null,
    },
    {
      metric: "Years in Operation",
      result: normalizeResult(analysis.years_operation_result ?? null),
      score: analysis.years_operation_score ?? null,
    },
    {
      metric: "Lease Terms Remaining",
      result: normalizeResult(analysis.lease_terms_result ?? null),
      score: analysis.lease_terms_score ?? null,
    },
  ] : [];

  // Helper for material style colored dot
  const getDotColor = (score: number | null | undefined) => {
    if (score === 10) return 'bg-[#22c55e]'; // green
    if (score === 5) return 'bg-[#facc15]'; // yellow
    return 'bg-[#ef4444]'; // red
  };

  // Helper for total score color (full fill)
  const getTotalColor = (percentage: number) => {
    if (percentage > 70) return '#22c55e';
    if (percentage >= 35) return '#facc15';
    return '#ef4444';
  };

  // Helper for total score label and color
  const getTotalScoreLabel = (score: number | null | undefined) => {
    if (score == null) return { label: 'N/A', color: 'bg-gray-300 text-gray-500', border: 'border-gray-200', shadow: 'shadow-gray-200/60' };
    if (score > 6) return { label: 'Good', color: 'bg-green-400/80 text-green-900', border: 'border-green-200', shadow: 'shadow-green-300/60' };
    if (score >= 4) return { label: 'Average', color: 'bg-yellow-300/80 text-yellow-900', border: 'border-yellow-200', shadow: 'shadow-yellow-200/60' };
    return { label: 'Poor', color: 'bg-red-400/80 text-red-900', border: 'border-red-200', shadow: 'shadow-red-200/60' };
  };

  // Helper for soft factors score label and color
  const getSoftFactorsScoreLabel = (score: number | null | undefined) => {
    if (score == null) return { label: 'N/A', color: 'bg-gray-300 text-gray-500', border: 'border-gray-200', shadow: 'shadow-gray-200/60' };
    if (score > 6) return { label: 'Good', color: 'bg-green-400/80 text-green-900', border: 'border-green-200', shadow: 'shadow-green-300/60' };
    if (score >= 4) return { label: 'Average', color: 'bg-yellow-300/80 text-yellow-900', border: 'border-yellow-200', shadow: 'shadow-yellow-200/60' };
    return { label: 'Poor', color: 'bg-red-400/80 text-red-900', border: 'border-red-200', shadow: 'shadow-red-200/60' };
  };

  // NEW: Helper functions for gradient borders (like demographics tab)
  const getTotalScoreGradient = (score: number | null | undefined) => {
    if (score == null) return 'linear-gradient(45deg, #9ca3af, #6b7280)';
    if (score > 6) return 'linear-gradient(45deg, #10b981, #059669)';
    if (score >= 4) return 'linear-gradient(45deg, #f59e0b, #d97706)';
    return 'linear-gradient(45deg, #ef4444, #dc2626)';
  };

  const getSoftFactorsScoreGradient = (score: number | null | undefined) => {
    if (score == null) return 'linear-gradient(45deg, #9ca3af, #6b7280)';
    if (score > 6) return 'linear-gradient(45deg, #10b981, #059669)';
    if (score >= 4) return 'linear-gradient(45deg, #f59e0b, #d97706)';
    return 'linear-gradient(45deg, #ef4444, #dc2626)';
  };

  // Status UI logic
  const status = analysis?.analysis_status || "unknown"
  let statusContent = null
  if (loading || refreshing || status === "pending" || status === "processing") {
    statusContent = (
      <div className="flex items-center gap-2 text-blue-600"><span className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></span> Analysis in progress…</div>
    )
  } else if (status === "failed") {
    statusContent = (
      <div className="flex items-center gap-2 text-red-600">Analysis failed. <button onClick={fetchAnalysis} className="ml-2 px-2 py-1 bg-red-100 rounded hover:bg-red-200">Retry</button></div>
    )
  } else if (status === "completed" || status === "complete") {
    statusContent = null // Show result
  } else {
    statusContent = <div className="text-gray-500">Status: {status}</div>
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
        await fetchAnalysis()
      }
    } catch (err: any) {
      setRetryError(err.message || "Failed to retry analysis.")
    }
    setRefreshing(false)
  }

  // Helper for status color
  const getStatusColor = (status: string) => {
    if (loading || refreshing || status === "pending" || status === "processing") return "text-blue-600";
    if (status === "failed" || error) return "text-red-600";
    if (status === "completed" || status === "complete") return "text-green-600";
    return "text-gray-500";
  };

  // Always render the top card
  return (
    <div className="space-y-8">
      {/* Top Status & Retry Card */}
      <Card className="flex flex-row items-center justify-between px-6 py-3 mb-2 !bg-gray-300 border border-white shadow">
        {/* Status Text */}
        <div className={`font-medium ${getStatusColor(status)}`}> 
          {loading || refreshing || status === "pending" || status === "processing" ? (
            <span className="flex items-center gap-2"><span className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></span> Analysis in progress…</span>
          ) : (error || status === "failed") ? (
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
      {loading && <div className="p-8 text-left text-gray-500">Loading business analysis...</div>}
      {retryError && <div className="p-2 text-left text-red-500">{retryError}</div>}
      {error && <div className="p-2 text-left text-red-500">{error}</div>}
      {/* NEW: Score Cards and Summary Section */}
      {analysis ? (
        <Card className="relative">
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Business Performance</h3>
          </CardHeader>
          <div className="px-6 pb-6">
            {/* Summary Box with Business Verdict + Soft Factors Positives/Negatives */}
            <SummaryBox 
              assessment={analysis?.business_verdict ?? 'N/A'}
              positives={analysis?.soft_factors_positive ?? []}
              negatives={analysis?.soft_factors_negative ?? []}
              operationalScore={analysis?.operational_score_total ?? undefined}
              softFactorsScore={analysis?.soft_factors_score ?? undefined}
            />

            {/* Key Metrics Section - moved from overview */}
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-4">Key Metrics</h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {/* Revenue */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-2">
                      <span className="text-sm font-medium text-gray-700">Revenue</span>
                    </div>
                    <span className="text-lg md:text-2xl font-bold text-gray-900 mb-1">{formatCurrency(analysis?.revenue ?? null)}</span>
                  </div>
                </Card>
                {/* Cash Flow */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-2">
                      <span className="text-sm font-medium text-gray-700">Cash Flow</span>
                    </div>
                    <span className="text-lg md:text-2xl font-bold text-gray-900 mb-1">{formatCurrency(analysis?.cash_flow ?? null)}</span>
                  </div>
                </Card>
                {/* Revenue Multiple */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-2">
                      <span className="text-sm font-medium text-gray-700">Revenue Multiple</span>
                    </div>
                    <span className="text-lg md:text-2xl font-bold text-gray-900 mb-1">{formatString(analysis?.revenue_multiple_result ?? null)}</span>
                  </div>
                </Card>
                {/* SDE Multiple */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center text-gray-500 mb-2">
                      <span className="text-sm font-medium text-gray-700">Cash Flow Multiple</span>
                    </div>
                    <span className="text-lg md:text-2xl font-bold text-gray-900 mb-1">{formatString(analysis?.sde_multiple_result ?? null)}</span>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        // Show placeholder when no analysis data exists
        <Card className="relative">
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Business Assessment</h3>
          </CardHeader>
          <div className="px-6 pb-6">
            <div className="text-center text-gray-500 py-8">
              <p>No business analysis available yet.</p>
              <p className="text-sm mt-2">The assessment will appear here once the business analysis is complete.</p>
            </div>
          </div>
        </Card>
      )}

      {/* KEEP EXISTING SECTIONS FOR NOW - will remove after testing */}
      {/* Classic Table with Icon Score - For Comparison */}
      <Card className="mt-8">
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">Operational Score</h3>
        </CardHeader>
        <div className="overflow-x-auto px-6 pb-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Result</th>
                <th className="px-4 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">Score</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {scoringRows.map((item, idx) => (
                <tr key={item.metric} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">{item.metric}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.result}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block w-5 h-5 rounded-full border border-gray-200 ${getDotColor(item.score)}`}
                      style={{ boxShadow: '0 2px 8px 0 rgba(0,0,0,0.12)' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Replace Details card with Additional Data card */}
      <Card className="mt-8">
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">Additional Data</h3>
        </CardHeader>
        <div className="px-6 pb-6">
          {/* Four-card grid above table (matching Key Metrics style) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
            {/* Equipment Age */}
            <Card>
              <div className="p-6">
                <div className="flex items-center text-gray-500 mb-2">
                  <span className="text-sm font-medium text-gray-700">Equipment Age</span>
                </div>
                <span className="text-lg md:text-2xl font-bold text-gray-900">
                  {analysis?.equipment_age ?? 'N/A'}
                </span>
              </div>
            </Card>
            {/* FF&E */}
            <Card>
              <div className="p-6">
                <div className="flex items-center text-gray-500 mb-2">
                  <span className="text-sm font-medium text-gray-700">FF&E</span>
                </div>
                <span className="text-lg md:text-2xl font-bold text-gray-900">
                  {analysis?.ff_and_e != null ? formatCurrency(analysis.ff_and_e) : 'N/A'}
                </span>
              </div>
            </Card>
            {/* Square Footage */}
            <Card>
              <div className="p-6">
                <div className="flex items-center text-gray-500 mb-2">
                  <span className="text-sm font-medium text-gray-700">Square Footage</span>
                </div>
                <span className="text-lg md:text-2xl font-bold text-gray-900">
                  {analysis?.square_footage != null ? analysis.square_footage.toLocaleString() : 'N/A'}
                </span>
              </div>
            </Card>
            {/* Rent */}
            <Card>
              <div className="p-6">
                <div className="flex items-center text-gray-500 mb-2">
                  <span className="text-sm font-medium text-gray-700">Monthly Rent</span>
                </div>
                <span className="text-lg md:text-2xl font-bold text-gray-900">
                  {analysis?.monthly_rent != null ? formatCurrency(analysis.monthly_rent) : 'N/A'}
                </span>
              </div>
            </Card>
          </div>

          {/* Collapsible section with demographics tab style */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => setOpenOther((v) => !v)}
              className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <h4 className="text-sm font-medium text-gray-700">Misc. operational info</h4>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${openOther ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openOther && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-2 gap-y-1 sm:gap-y-0 mb-2 sm:mb-0 items-start">
                  <div className="text-sm text-gray-500 py-1 sm:py-0">Equipment Data:</div>
                  <div className="text-sm text-gray-900 py-1 sm:py-0">{analysis?.equipment_description ?? 'N/A'}</div>
                  <div className="text-sm text-gray-500 py-1 sm:py-0">Employees:</div>
                  <div className="text-sm text-gray-900 py-1 sm:py-0">{analysis?.employees ?? 'N/A'}</div>
                  <div className="text-sm text-gray-500 py-1 sm:py-0">Lease Options:</div>
                  <div className="text-sm text-gray-900 py-1 sm:py-0">{analysis?.lease_renewal_options ?? 'N/A'}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

export default BusinessScoreTab 