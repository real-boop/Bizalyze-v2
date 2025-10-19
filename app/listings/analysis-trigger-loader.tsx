import React, { useEffect, useState } from "react";

interface AnalysisTriggerLoaderProps {
  status: {
    scrapeStatus: "pending" | "processing" | "complete" | "failed";
    analysisStatuses: Array<"pending" | "processing" | "complete" | "failed">;
    scrapeDataPresent?: boolean;
    analysisRawPresent?: boolean;
  };
  onComplete?: () => void;
  instantComplete?: boolean;
}

const ANALYSIS_STEPS = [
  { key: "fetching", label: "Fetching Data" },
  { key: "analyzing", label: "Analyzing Data" },
  { key: "loading", label: "Loading Dashboard" },
];

export const AnalysisTriggerLoader: React.FC<AnalysisTriggerLoaderProps> = ({ status, onComplete, instantComplete }) => {
  const [stepsStatus, setStepsStatus] = useState<{ [key: string]: "processing" | "done" | "error" }>({
    fetching: "processing",
    analyzing: "processing",
    loading: "processing",
  });
  const [showBigCheck, setShowBigCheck] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[Loader] status prop:', status);
  }, [status]);

  // Handle instant complete (all steps green, no polling)
  useEffect(() => {
    if (instantComplete) {
      setStepsStatus({ fetching: "done", analyzing: "done", loading: "done" });
      setShowBigCheck(true);
      const timeout = setTimeout(() => {
        setLoading(false);
        if (onComplete) onComplete();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [instantComplete, onComplete]);

  // Step 1: Fetching Data (only check scrapeDataPresent)
  useEffect(() => {
    if (instantComplete) return;
    // Debug log
    console.log('[Loader] scrapeDataPresent:', status.scrapeDataPresent);
    if (status.scrapeDataPresent) {
      setStepsStatus((prev) => ({ ...prev, fetching: 'done', analyzing: 'processing' }));
    } else {
      setStepsStatus((prev) => ({ ...prev, fetching: 'processing', analyzing: 'processing', loading: 'processing' }));
    }
  }, [status.scrapeDataPresent, instantComplete]);

  // Step 2: Analyzing Data (only check analysisRawPresent)
  useEffect(() => {
    if (instantComplete) return;
    if (stepsStatus.fetching !== 'done') return;
    // Debug log
    console.log('[Loader] analysisRawPresent:', status.analysisRawPresent);
    if (status.analysisRawPresent) {
      setStepsStatus((prev) => ({ ...prev, analyzing: 'done' }));
    } else {
      setStepsStatus((prev) => ({ ...prev, analyzing: 'processing' }));
    }
  }, [status.analysisRawPresent, stepsStatus.fetching, instantComplete]);

  // Step 3: Loading Dashboard
  useEffect(() => {
    if (instantComplete) return;
    if (stepsStatus.analyzing === "done" && stepsStatus.loading !== "done") {
      setTimeout(() => {
        setStepsStatus((prev) => ({ ...prev, loading: "done" }));
        setShowBigCheck(true);
        setTimeout(() => {
          setLoading(false);
          if (onComplete) onComplete();
        }, 1000); // Delay before hiding loader and calling onComplete
      }, 1000); // Fake dashboard loading for 1 second
    }
  }, [stepsStatus.analyzing, stepsStatus.loading, onComplete, instantComplete]);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md flex flex-col items-center">
        {/* Step List */}
        <ul className="space-y-3 w-full">
          {ANALYSIS_STEPS.map((step) => (
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
              </span>
              <span className={stepsStatus[step.key] === "done" ? "text-green-700 font-semibold" : stepsStatus[step.key] === "error" ? "text-red-600 font-semibold" : "text-gray-700"}>{step.label}</span>
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
        <div className="text-sm text-gray-500 mt-6">Getting your data... this might take a minute.</div>
      </div>
    </div>
  );
}; 