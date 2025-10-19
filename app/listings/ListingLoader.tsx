import React, { useEffect, useState } from "react";

interface LoaderProps {
  sessionId: string;
  onComplete?: () => void;
  dataReady?: boolean;
  onDataReady?: () => void;
}

const STATIC_STEPS = [
  { key: "clean", label: "Clean & Analyze Search Query" },
  { key: "perplexity", label: "On-Market Source 1 (Perplexity)" },
  { key: "bbs", label: "On-Market Source 2 (BizBuySell)" },
  { key: "bb", label: "On-Market Source 3 (BizBen)" },
  { key: "bfs", label: "On-Market Source 4 (BusinessesForSale)" },
  { key: "gmaps", label: "Off-Market Source (Google Maps)" },
  { key: "preparing", label: "Preparing Data" },
];

const STEP_BACKEND_KEYS = {
  clean: "clean-search", // or whatever the backend uses for this step
  perplexity: "Perplexity",
  bbs: "BizBuySell",
  bb: "BizBen",
  bfs: "BusinessesForSale",
  gmaps: "Google Maps",
};

export const Loader: React.FC<LoaderProps> = ({ sessionId, onComplete, dataReady, onDataReady }) => {
  const [stepsStatus, setStepsStatus] = useState<{ [key: string]: "processing" | "done" | "error" | "not_selected" }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBigCheck, setShowBigCheck] = useState(false);
  const [preparingData, setPreparingData] = useState(true);
  const [allStepsComplete, setAllStepsComplete] = useState(false);
  const [preparingDataDone, setPreparingDataDone] = useState(false);

  // Helper to determine if a step is selected (based on backend data)
  function isStepSelected(stepKey: string, backendSteps: any[]): boolean {
    if (stepKey === "preparing") return true; // Always selected
    if (stepKey === "clean") return true; // Always selected
    if (stepKey === "perplexity") return backendSteps.some((s) => s.label === "Perplexity");
    if (stepKey === "bbs") return backendSteps.some((s) => s.label === "BizBuySell");
    if (stepKey === "bb") return backendSteps.some((s) => s.label === "BizBen");
    if (stepKey === "bfs") return backendSteps.some((s) => s.label === "BusinessesForSale");
    if (stepKey === "gmaps") return backendSteps.some((s) => s.label === "Google Maps");
    return false;
  }

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/search-status?id=${sessionId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unknown error");
        const newStatus: { [key: string]: "processing" | "done" | "error" | "not_selected" } = {};
        // Clean step: done if search_translator_response is filled, else processing
        newStatus.clean = data.search_translator_response ? "done" : "processing";
        // Perplexity
        if (data.on_market) {
          if (data.perplexity_status === "complete") newStatus.perplexity = "done";
          else if (data.perplexity_status === "failed") newStatus.perplexity = "error";
          else if (data.perplexity_status === "pending") newStatus.perplexity = "processing";
          else newStatus.perplexity = "not_selected";
        } else {
          newStatus.perplexity = "not_selected";
        }
        // BizBuySell
        if (data.on_market) {
          if (data.onmarket_bbs_status === "complete") newStatus.bbs = "done";
          else if (data.onmarket_bbs_status === "failed") newStatus.bbs = "error";
          else if (data.onmarket_bbs_status === "pending") newStatus.bbs = "processing";
          else newStatus.bbs = "not_selected";
        } else {
          newStatus.bbs = "not_selected";
        }
        // BizBen
        if (data.on_market) {
          if (data.onmarket_bb_status === "complete") newStatus.bb = "done";
          else if (data.onmarket_bb_status === "failed") newStatus.bb = "error";
          else if (data.onmarket_bb_status === "pending") newStatus.bb = "processing";
          else newStatus.bb = "not_selected";
        } else {
          newStatus.bb = "not_selected";
        }
        // BusinessesForSale
        if (data.on_market) {
          if (data.onmarket_bfs_status === "complete") newStatus.bfs = "done";
          else if (data.onmarket_bfs_status === "failed") newStatus.bfs = "error";
          else if (data.onmarket_bfs_status === "pending") newStatus.bfs = "processing";
          else newStatus.bfs = "not_selected";
        } else {
          newStatus.bfs = "not_selected";
        }
        // Off-Market (Google Maps)
        if (data.off_market) {
          if (data.offmarket_gmaps_status === "complete") newStatus.gmaps = "done";
          else if (data.offmarket_gmaps_status === "failed") newStatus.gmaps = "error";
          else if (data.offmarket_gmaps_status === "pending") newStatus.gmaps = "processing";
          else newStatus.gmaps = "not_selected";
        } else {
          newStatus.gmaps = "not_selected";
        }
        // Preparing Data step is always last, controlled by frontend
        newStatus.preparing = preparingData ? "processing" : "done";
        setStepsStatus(newStatus);
        setError(data.error || null);
        // All steps done?
        const allDone = STATIC_STEPS.every((s) => newStatus[s.key] === "done" || newStatus[s.key] === "not_selected");
        if (allDone) {
          setShowBigCheck(true);
          setTimeout(() => {
            setLoading(false);
            if (onComplete) onComplete();
          }, 1500); // Show big check for 1.5s before hiding loader
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch status");
      }
    };
    fetchStatus();
    interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [sessionId, onComplete, preparingData]);

  // Update stepsStatus when preparingData changes
  useEffect(() => {
    if (!preparingData) {
      setStepsStatus((prev) => ({ ...prev, preparing: "done" }));
    }
  }, [preparingData]);

  // Listen for onDataReady prop from parent/tabs
  useEffect(() => {
    if (dataReady && preparingData) {
      setPreparingData(false);
      setPreparingDataDone(true);
      setTimeout(() => {
        setShowBigCheck(true);
        setTimeout(() => {
          setLoading(false);
          if (onComplete) onComplete();
        }, 1000);
      }, 300);
    }
  }, [dataReady, preparingData, onComplete]);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md flex flex-col items-center">
        {/* Step List */}
        <ul className="space-y-3 w-full">
          {STATIC_STEPS.map((step, idx) => (
            <li key={step.key} className="flex items-center gap-3">
              {/* Status Icon */}
              <span className={`inline-block w-6 h-6 rounded-full border-2 flex items-center justify-center
                ${stepsStatus[step.key] === "done" ? 'border-green-500 bg-green-100' :
                  stepsStatus[step.key] === "processing" ? 'border-blue-400 bg-white' :
                  stepsStatus[step.key] === "error" ? 'border-red-500 bg-red-100' :
                  'border-gray-300 bg-gray-100'}`}
              >
                {stepsStatus[step.key] === "done" && (
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                )}
                {stepsStatus[step.key] === "processing" && (
                  <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                )}
                {stepsStatus[step.key] === "error" && (
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                )}
                {stepsStatus[step.key] === "not_selected" && (
                  <span className="w-3 h-3 bg-gray-300 rounded-full flex items-center justify-center text-xs text-gray-500">N/A</span>
                )}
              </span>
              <span className={stepsStatus[step.key] === "done" ? "text-green-700 font-semibold" : stepsStatus[step.key] === "error" ? "text-red-600 font-semibold" : stepsStatus[step.key] === "not_selected" ? "text-gray-400" : "text-gray-700"}>{step.label}</span>
            </li>
          ))}
        </ul>
        {/* Big Green Checkmark */}
        {showBigCheck && (
          <div className="flex flex-col items-center mt-8 animate-bounce">
            <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="white" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 13l3 3 7-7" />
            </svg>
            <div className="text-green-700 font-bold text-lg mt-2">All done!</div>
          </div>
        )}
        {error && <div className="text-red-500 text-sm mt-4 text-center">{error}</div>}
        <div className="text-sm text-gray-500 mt-6">Working on it. Give us a second.</div>
      </div>
    </div>
  );
}; 
