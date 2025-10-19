import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface AnalysisErrorOverlayProps {
  error: {
    step: string;
    message: string;
    canViewPartial: boolean;
  };
  businessId: string;
  onRetry: () => void;
  onCancel: () => void;
  onViewPartial: () => void;
  isRetrying: boolean;
}

export function AnalysisErrorOverlay({
  error,
  businessId,
  onRetry,
  onCancel,
  onViewPartial,
  isRetrying
}: AnalysisErrorOverlayProps) {
  return (
    <div className="text-center">
      <div className="flex items-center gap-3 mb-4 justify-center">
        <AlertTriangle className="h-6 w-6 text-red-500" />
        <h3 className="text-lg font-semibold">Taking longer than expected...</h3>
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {error.message}
      </p>
      <div className="flex gap-3">
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          className="flex-1"
        >
          {isRetrying ? "Retrying..." : "Retry"}
        </Button>
        {error.canViewPartial ? (
          <Button
            variant="secondary"
            onClick={onViewPartial}
            className="flex-1"
          >
            View Partial Dashboard
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
} 