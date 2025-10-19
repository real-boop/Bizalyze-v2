import { useState, useEffect } from 'react';

interface AnalysisError {
  step: string;
  message: string;
  canViewPartial: boolean;
}

export function useAnalysisStatus(businessId: string | null) {
  const [statuses, setStatuses] = useState({
    step1: 'pending' as 'pending' | 'processing' | 'completed' | 'failed',
    step2: 'pending' as 'pending' | 'processing' | 'completed' | 'failed',
    step3: 'pending' as 'pending' | 'processing' | 'completed' | 'failed',
    step4: 'pending' as 'pending' | 'processing' | 'completed' | 'failed',
    step5: 'pending' as 'pending' | 'processing' | 'completed' | 'failed'
  });

  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<AnalysisError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    
    // Check if all steps are already complete for instant redirect
    const checkInitialStatus = async () => {
      try {
        const res = await fetch(`/api/business-status?id=${businessId}`);
        const data = await res.json();
        
        const allComplete = ['step1_status', 'step2_status', 'step3_status', 'step4_status', 'step5_status']
          .every(step => data[step] === 'completed');
          
        if (allComplete) {
          // Show all green checkmarks for 2 seconds then redirect
          setStatuses({
            step1: 'completed',
            step2: 'completed', 
            step3: 'completed',
          step4: 'completed',
          step5: 'completed'
        });
        setTimeout(() => {
          window.location.href = `/dashboard/${businessId}`;
        }, 2000);
        return;
        }
      } catch (err) {
        console.error('Initial status check failed:', err);
      }
    };
    
    checkInitialStatus();

    // Global timeout: 3 minutes
    const globalTimeout = setTimeout(() => {
      setError({
        step: 'timeout',
        message: 'Analysis timed out after 3 minutes',
        canViewPartial: statuses.step2 === 'completed'
      });
      clearInterval(interval);
    }, 3 * 60 * 1000); // 3 minutes

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/business-status?id=${businessId}`);
        const data = await res.json();

        setStatuses({
          step1: data.step1_status || 'pending',
          step2: data.step2_status || 'pending',
          step3: data.step3_status || 'pending',
          step4: data.step4_status || 'pending',
          step5: data.step5_status || 'pending'
        });

        // Check for failed steps
        const failedStep = Object.entries(data).find(([key, value]) => 
          key.includes('_status') && value === 'failed'
        );

        if (failedStep && !isRetrying) {
          const stepNumber = failedStep[0].replace('step', '').replace('_status', '');
          setError({
            step: stepNumber,
            message: `Step ${stepNumber} failed`,
            canViewPartial: parseInt(stepNumber) >= 3 && data.step2_status === 'completed'
          });
          clearInterval(interval);
          return;
        }

      // Auto-redirect when complete
      if (data.step5_status === 'completed') {
        setIsComplete(true);
        clearInterval(interval);
        clearTimeout(globalTimeout);
        setTimeout(() => {
          window.location.href = `/dashboard/${businessId}`;
        }, 1000);
      }
      } catch (err) {
        if (!isRetrying) {
          setError({
            step: 'network',
            message: 'Connection error occurred',
            canViewPartial: statuses.step2 === 'completed'
          });
        }
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(globalTimeout);
    };
  }, [businessId, isRetrying]);

  const retry = async () => {
    if (!businessId || !error) return;

    setIsRetrying(true);
    setError(null);

    try {
      await fetch('/api/analysis/retry-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, step: error.step })
      });
    } catch (err) {
      setError({
        step: error.step,
        message: 'Retry failed',
        canViewPartial: error.canViewPartial
      });
    } finally {
      setIsRetrying(false);
    }
  };

  return { statuses, isComplete, error, retry, isRetrying };
} 

