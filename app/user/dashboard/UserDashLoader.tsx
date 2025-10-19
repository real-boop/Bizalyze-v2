import React, { useEffect, useState } from "react";

interface UserDashLoaderProps {
  onComplete?: () => void;
  dataReady?: boolean;
  onDataReady?: () => void;
}

export const UserDashLoader: React.FC<UserDashLoaderProps> = ({ onComplete, dataReady, onDataReady }) => {
  const [loading, setLoading] = useState(true);
  const [showBigCheck, setShowBigCheck] = useState(false);

  // Simple loading logic - just wait for data to be ready
  useEffect(() => {
    if (dataReady) {
      // Show success state briefly before completing
      setShowBigCheck(true);
      setTimeout(() => {
        setLoading(false);
        if (onComplete) onComplete();
      }, 1000); // Show big check for 1s before hiding loader
    }
  }, [dataReady, onComplete]);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md flex flex-col items-center">
        
        {/* Simple loading message */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading your businesses...</h3>
          <p className="text-sm text-gray-600 text-center">
            Fetching your analyzed business reports
          </p>
        </div>

        {/* Big Green Checkmark - shown when data is ready */}
        {showBigCheck && (
          <div className="flex flex-col items-center mt-8 animate-bounce">
            <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="white" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 13l3 3 7-7" />
            </svg>
            <div className="text-green-700 font-bold text-lg mt-2">Ready!</div>
          </div>
        )}

        <div className="text-sm text-gray-500 mt-6">Please wait a moment.</div>
      </div>
    </div>
  );
};
