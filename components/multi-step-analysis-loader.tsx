import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AnalysisErrorOverlay } from "./analysis-error-overlay";

interface MultiStepAnalysisLoaderProps {
  status: {
    step1Status: "pending" | "processing" | "completed" | "failed";
    step2Status: "pending" | "processing" | "completed" | "failed";
    step3Status: "pending" | "processing" | "completed" | "failed";
    step4Status: "pending" | "processing" | "completed" | "failed";
    step5Status: "pending" | "processing" | "completed" | "failed";
  };
  businessId: string;
  error?: {
    step: string;
    message: string;
    canViewPartial: boolean;
  } | null;
  onRetry?: () => void;
  onCancel?: () => void;
  onViewPartial?: () => void;
  isRetrying?: boolean;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

const ANALYSIS_STEPS = [
  { key: "step1", label: "Preparing Inputs" },
  { key: "step2", label: "Getting Location Data" },
  { key: "step3", label: "Analyzing Business Data" },
  { key: "step4", label: "Analyzing Location Data" },
  { key: "step5", label: "Creating Recommendation" },
];

export const MultiStepAnalysisLoader: React.FC<MultiStepAnalysisLoaderProps> = ({ 
  status, 
  businessId,
  error,
  onRetry,
  onCancel,
  onViewPartial,
  isRetrying,
  onComplete, 
  onError 
}) => {
  const router = useRouter();
  const [stepsStatus, setStepsStatus] = useState<{ [key: string]: "processing" | "done" | "error" | "pending" }>({
    step1: "processing",
    step2: "pending",
    step3: "pending",
    step4: "pending",
    step5: "pending",
  });
  const [showBigCheck, setShowBigCheck] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dotCount, setDotCount] = useState(1);

  // Animated dots effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount(prev => prev === 3 ? 1 : prev + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Map API statuses to UI states
  useEffect(() => {
    const newStepsStatus = { ...stepsStatus };
    Object.entries(status).forEach(([key, value]) => {
      const stepKey = key.replace('Status', '');
      if (value === 'processing') {
        newStepsStatus[stepKey] = 'processing';
      } else if (value === 'completed') {
        newStepsStatus[stepKey] = 'done';
      } else if (value === 'failed') {
        newStepsStatus[stepKey] = 'error';
      }
    });
    setStepsStatus(newStepsStatus);
  }, [status]);

  // Handle step 5 completion
  useEffect(() => {
    if (status.step5Status === "completed") {
      setStepsStatus(prev => ({ ...prev, step5: "done" }));
      setShowBigCheck(true);
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
        // Keep loading true - don't unmount loader
      }, 1000);
    } else if (status.step5Status === "failed") {
      setStepsStatus(prev => ({ ...prev, step5: "error" }));
      toast.error("Failed to create recommendation. Please try again.");
      // Don't set loading to false - let error handling manage the state
      if (onError) onError("Failed to create recommendation");
    }
  }, [status.step5Status, onComplete, onError, businessId, router]);

  if (!loading && !error) return null;

  return (
    <div className="relative">
      {/* Existing loader content */}
      <div className={`space-y-6 ${error ? 'blur-sm pointer-events-none' : ''}`}>
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
                {stepsStatus[step.key] === "pending" && (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                )}
              </span>
              <span className={stepsStatus[step.key] === "done" ? "text-green-700 font-semibold" : 
                stepsStatus[step.key] === "error" ? "text-red-600 font-semibold" : 
                stepsStatus[step.key] === "processing" ? "text-blue-600 font-semibold" :
                "text-gray-400"}>{step.label}</span>
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
        <div className="text-sm text-gray-500 mt-6">
          Processing your analysis, this can take 2-3 minutes{'.'.repeat(dotCount)}
        </div>
      </div>
      
      {/* Error overlay */}
      {error && onRetry && onCancel && onViewPartial && (
        <AnalysisErrorOverlay
          error={error}
          businessId={businessId}
          onRetry={onRetry}
          onCancel={onCancel}
          onViewPartial={onViewPartial}
          isRetrying={isRetrying || false}
        />
      )}
    </div>
  );

}; 
