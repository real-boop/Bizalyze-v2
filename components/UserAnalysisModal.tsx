"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { AnalysisTriggerLoader } from "../app/listings/analysis-trigger-loader"
import { MultiStepAnalysisLoader } from "./multi-step-analysis-loader";
import { useAnalysisStatus } from "@/hooks/useAnalysisStatus";
import { AnalysisErrorOverlay } from "./analysis-error-overlay";
import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import { supabase } from '@/lib/supabase';
import { X } from "lucide-react"

interface UserAnalysisModalProps {
  isOpen: boolean
  onClose: () => void
  userEmail: string
  paymentSuccess?: boolean
  checkoutId?: string
}

export function UserAnalysisModal({ isOpen, onClose, userEmail, paymentSuccess, checkoutId }: UserAnalysisModalProps) {
  // Form state
  const [categories, setCategories] = useState<{ id: string; display_name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; display_name: string } | null>(null);
  const [listingUrl, setListingUrl] = useState("");
  const [listingText, setListingText] = useState("");
  const [isFetchingCategories, setIsFetchingCategories] = useState(false);
  const [urlError, setUrlError] = useState<string>("");
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  
  // Analysis state
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [showLoader, setShowLoader] = useState(false);
  const [loaderStatus, setLoaderStatus] = useState<{ scrapeStatus: "pending" | "completed" | "processing" | "failed"; analysisStatuses: ("pending" | "completed" | "processing" | "failed")[]; scrapeDataPresent: boolean; analysisRawPresent: boolean }>({ scrapeStatus: "pending", analysisStatuses: [], scrapeDataPresent: false, analysisRawPresent: false });
  const [loaderBusinessId, setLoaderBusinessId] = useState<string | null>(null);
  const [analysisCompleteInstant, setAnalysisCompleteInstant] = useState(false);
  const redirectTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Payment state
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(paymentSuccess || false);
  const [storedCheckoutId, setStoredCheckoutId] = useState<string | null>(checkoutId || null);
  const checkoutInstanceRef = useRef<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch categories on mount and cleanup abandoned checkouts
  useEffect(() => {
    if (isOpen) {
      setIsFetchingCategories(true);
      fetch("/api/business-categories")
        .then(res => res.json())
        .then(data => {
          setCategories(data.categories || []);
        })
        .finally(() => setIsFetchingCategories(false));
    }
    
    // Cleanup abandoned checkouts (older than 10 minutes)
    const savedData = localStorage.getItem('pendingAnalysisForm');
    if (savedData) {
      try {
        const formData = JSON.parse(savedData);
        const timeDiff = Date.now() - formData.timestamp;
        if (timeDiff > 600000) { // 10 minutes
          localStorage.removeItem('pendingAnalysisForm');
        }
      } catch (error) {
        localStorage.removeItem('pendingAnalysisForm');
      }
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCategory(null);
      setListingUrl("");
      setListingText("");
      setUrlError("");
      setDuplicateError(null);
      setAnalyzeError("");
      setShowLoader(false);
      setLoaderBusinessId(null);
      setPaymentCompleted(false);
      setStoredCheckoutId(null);
    }
  }, [isOpen]);

  // Restore form data after payment redirect (EXACT same logic as start page)
  useEffect(() => {
    if (isOpen && paymentSuccess && checkoutId && categories.length > 0) {
      const storedData = localStorage.getItem('pendingAnalysisForm');
      
      if (storedData) {
        try {
          const formData = JSON.parse(storedData);
          
          // Restore form data
          setListingUrl(formData.listingUrl || '');
          setListingText(formData.listingText || '');
          
          // Restore category AFTER other fields to prevent clearing
          if (formData.categoryId && categories.length > 0) {
            const cat = categories.find(c => c.id === formData.categoryId);
            setSelectedCategory(cat || null);
          }
          
          // DON'T clear localStorage here - let startAnalysisAfterPayment() do it when user actually starts analysis
          console.log('✅ Form data restored - localStorage preserved until analysis starts');
        } catch (error) {
          console.error('Failed to restore form data:', error);
        }
      }
      
      // Mark payment as completed
      setPaymentCompleted(true);
      setStoredCheckoutId(checkoutId);
      
      // Show success message
      toast.success("Payment successful! Click 'Start Analysis' to begin.");
    }
  }, [isOpen, paymentSuccess, checkoutId, categories]);

  // HTML stripping for textarea
  function stripHtml(input: string) {
    const div = document.createElement("div");
    div.innerHTML = input;
    return div.textContent || div.innerText || "";
  }

  // Handler for textarea paste
  function handleTextPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    setListingText(stripHtml(text));
  }

  // Handler for textarea change
  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setListingText(stripHtml(e.target.value));
  }

  // URL validation function
  function validateUrl(url: string): boolean {
    return /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/.test(url);
  }

  // Check for duplicate listing
  const checkForDuplicate = async (listingUrl: string) => {
    try {
      const response = await fetch("/api/validate-analysis-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          listing_url: listingUrl
        })
      });

      if (!response.ok) {
        throw new Error('Failed to check for duplicates');
      }

      const data = await response.json();
      return data.hasAnalyzedThisListing || false;
    } catch (error) {
      console.error('Error checking for duplicate:', error);
      return false; // Allow submission if check fails
    }
  };

  // Update URL handler to validate and check for duplicates
  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setListingUrl(value);
    setDuplicateError(null); // Clear duplicate error when URL changes
    
    if (!value) {
      setUrlError("");
    } else if (!validateUrl(value)) {
      setUrlError("Please enter a valid URL (e.g. https://www.example.com)");
    } else {
      setUrlError("");
      // Check for duplicate after a short delay
      const timeoutId = setTimeout(async () => {
        const isDuplicate = await checkForDuplicate(value);
        if (isDuplicate) {
          setDuplicateError("You already analyzed this business. Please check your dashboard.");
        }
      }, 500); // 500ms delay to avoid too many API calls
      
      return () => clearTimeout(timeoutId);
    }
  }

  const canFillUrl = !!selectedCategory;
  const canFillText = !!selectedCategory && listingUrl.length > 0 && urlError === "";
  const canSubmit = !!selectedCategory && listingUrl.length > 0 && listingText.length > 0 && urlError === "" && !duplicateError;

  // Handle form submission - either checkout or analysis
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzeLoading(true);
    setAnalyzeError("");
    setDuplicateError(null);
    
    try {
      if (!selectedCategory || !listingUrl || !listingText) {
        setAnalyzeError("All fields are required.");
        setAnalyzeLoading(false);
        return;
      }

      // If payment is completed, start analysis
      if (paymentCompleted && storedCheckoutId) {
        await startAnalysisAfterPayment(storedCheckoutId, {
          categoryId: selectedCategory.id,
          listingUrl,
          listingText
        });
        setAnalyzeLoading(false);
        return;
      }

      // Check for duplicate before proceeding to checkout
      const isDuplicate = await checkForDuplicate(listingUrl);
      if (isDuplicate) {
        setDuplicateError("You already analyzed this business. Please check your dashboard.");
        setAnalyzeLoading(false);
        return;
      }

      // Go to checkout
      await handleDirectCheckout(
        userEmail,
        true, // hasAccount = true for authenticated users
        { 
          categoryId: selectedCategory.id,
          listingUrl,
          listingText 
        }
      );
      setAnalyzeLoading(false);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Failed to start analysis");
      setAnalyzeLoading(false);
    }
  };

  // Polling helper function - checks payment status as backup
  const startPolling = (checkoutId: string, onSuccess: () => void) => {
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds (2s interval)
    
    console.log('🔄 Starting payment polling backup...');
    
    const pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        const response = await fetch(`/api/check-payment-status?checkoutId=${checkoutId}`);
        const data = await response.json();
        
        if (data.paid) {
          clearInterval(pollInterval);
          console.log('✅ Payment confirmed via polling!');
          onSuccess();
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          console.log('⏱️ Polling timeout - payment may still be processing');
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000); // Poll every 2 seconds
    
    return pollInterval;
  };

  // Direct checkout handler (simplified from original)
  const handleDirectCheckout = async (email: string, hasAccount: boolean, businessData: any) => {
    setIsProcessingPayment(true);
    
    // Save form data to localStorage before checkout
    const formData = {
      email,
      categoryId: selectedCategory?.id,
      listingUrl,
      listingText,
      timestamp: Date.now()
    };
    localStorage.setItem('pendingAnalysisForm', JSON.stringify(formData));
    
    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: `analysis-${Date.now()}`,
          customerEmail: email.toLowerCase(),
          businessData,
          successUrl: `${window.location.origin}/user/dashboard?payment_success=true&token={CHECKOUT_ID}` // Redirect back to dashboard
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { checkoutUrl, checkoutId } = await response.json();
      
      // CREATE PENDING RECORD (works for both new and existing users)
      const accountResponse = await fetch('/api/auth/create-temp-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.toLowerCase(),
          businessData: {
            categoryId: businessData.categoryId,
            listingUrl: businessData.listingUrl,
            listingText: businessData.listingText
          }
        })
      });

      if (!accountResponse.ok) {
        console.error('Failed to create pending record');
      }
      
      const checkout = await PolarEmbedCheckout.create(checkoutUrl, 'light');
      checkoutInstanceRef.current = checkout;
      
      // Listen for when order is confirmed (payment submitted) - start polling backup
      checkout.addEventListener('confirmed', (event) => {
        console.log('Order confirmed, starting polling backup...');
        
        // Start polling as backup in case success event fails
        pollingIntervalRef.current = startPolling(checkoutId, () => {
          toast.success("Payment successful! Click 'Start Analysis' to begin.");
          setStoredCheckoutId(checkoutId);
          setPaymentCompleted(true);
          setIsProcessingPayment(false);
          if (checkoutInstanceRef.current) {
            checkoutInstanceRef.current.close();
            checkoutInstanceRef.current = null;
          }
        });
      });
      
      checkout.addEventListener('success', (event) => {
        console.log('Payment successful!', event.detail);
        
        // Stop polling since success event fired
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        toast.success("Payment successful! Click 'Start Analysis' to begin.");
        
        // Store checkout ID and mark payment as completed
        setStoredCheckoutId(checkoutId);
        setPaymentCompleted(true);
        
        // Close checkout but keep modal open
        setIsProcessingPayment(false);
        checkoutInstanceRef.current = null;
      });

      checkout.addEventListener('close', () => {
        console.log('Checkout closed');
        
        // Clean up polling on close
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        setIsProcessingPayment(false);
        checkoutInstanceRef.current = null;
        
        // NOTE: We intentionally DON'T clear localStorage here to preserve form data
        // for restoration after payment success redirect. localStorage is cleared
        // in startAnalysisAfterPayment() when the user actually starts the analysis.
      });

    } catch (error) {
      console.error('Payment error:', error);
      toast.error("Payment failed. Please try again.");
      setIsProcessingPayment(false);
    }
  };

  // Start analysis after payment
  const startAnalysisAfterPayment = async (checkoutId: string, businessData: any) => {
    // Clear localStorage now that analysis is starting
    localStorage.removeItem('pendingAnalysisForm');
    console.log('🧹 Cleared localStorage - analysis starting');
    
    try {
      const response = await fetch('/api/trigger-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: businessData.categoryId,
          listingUrl: businessData.listingUrl,
          listingText: businessData.listingText,
          paymentCompleted: true,
          checkoutId: checkoutId,
          email: userEmail
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }
      
      const result = await response.json();
      
      // Show loader and start analysis process
      setShowLoader(true);
      setLoaderBusinessId(result.business_id);
      setAnalysisCompleteInstant(false);
      
    } catch (error) {
      setAnalyzeError('Analysis failed. Please try again.');
    } finally {
      setAnalyzeLoading(false);
    }
  };

  // Cleanup redirect timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeout.current) clearTimeout(redirectTimeout.current)
    }
  }, [])

  // Cleanup checkout instance and polling on unmount
  useEffect(() => {
    return () => {
      if (checkoutInstanceRef.current) {
        checkoutInstanceRef.current.close();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const { statuses, isComplete, error, retry, isRetrying } = useAnalysisStatus(loaderBusinessId);

  const handleCancel = () => {
    setShowLoader(false);
    setLoaderBusinessId(null);
    setAnalyzeLoading(false);
  };

  const handleViewPartial = () => {
    if (loaderBusinessId) {
      window.location.href = `/dashboard/${loaderBusinessId}?partial=true`;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Fullscreen loader overlay */}
      {(analyzeLoading || showLoader) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
            {error ? (
              <AnalysisErrorOverlay
                error={error}
                businessId={loaderBusinessId ?? ""}
                onRetry={retry}
                onCancel={handleCancel}
                onViewPartial={handleViewPartial}
                isRetrying={isRetrying}
              />
            ) : (
              <MultiStepAnalysisLoader
                status={{
                  step1Status: statuses.step1,
                  step2Status: statuses.step2,
                  step3Status: statuses.step3,
                  step4Status: statuses.step4,
                  step5Status: statuses.step5
                }}
                businessId={loaderBusinessId ?? ""}
                onComplete={() => {
                  // Don't unmount - just redirect immediately
                  if (loaderBusinessId) {
                    const tokenParam = storedCheckoutId ? `?token=${storedCheckoutId}` : '';
                    window.location.href = `/dashboard/${loaderBusinessId}${tokenParam}`;
                  }
                }}
                onError={(err) => {
                  setAnalyzeError(err);
                  setShowLoader(false);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold">Analyze New Business</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <div className="p-6">
            <form className="space-y-6" onSubmit={handleAnalyze}>
              {/* Category Dropdown */}
              <div>
                <label className="block font-semibold mb-2 text-base">Business Category</label>
                <select
                  className="w-full bg-white border border-gray-200 rounded-xl h-12 px-4 text-base sm:text-sm disabled:opacity-50 transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none hover:border-gray-300"
                  value={selectedCategory?.id || ""}
                  onChange={e => {
                    const cat = categories.find(c => c.id === e.target.value);
                    setSelectedCategory(cat || null);
                    setListingUrl("");
                    setListingText("");
                    setUrlError("");
                    setPaymentCompleted(false);
                    setStoredCheckoutId(null);
                  }}
                  required
                  disabled={isFetchingCategories || paymentCompleted}
                >
                  <option value="" disabled>
                    {isFetchingCategories ? "Loading categories..." : "Select a category"}
                  </option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.display_name}</option>
                  ))}
                </select>
              </div>

              {/* Listing URL Field */}
              <div>
                <label className="block font-semibold mb-2 text-base">Listing URL</label>
                <Input
                  type="url"
                  placeholder="Paste business listing URL here..."
                  value={listingUrl}
                  onChange={handleUrlChange}
                  className={`bg-white border border-gray-200 rounded-xl h-12 px-4 text-base sm:text-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none hover:border-gray-300 ${urlError ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                  required
                  disabled={!canFillUrl || paymentCompleted}
                />
                {urlError && <div className="text-red-500 text-sm mt-1">{urlError}</div>}
                {duplicateError && <div className="text-red-500 text-sm mt-1">{duplicateError}</div>}
              </div>

              {/* Listing Text Field */}
              <div>
                <label className="block font-semibold mb-2 text-base">Listing Text</label>
                <textarea
                  placeholder="Paste the business listing text here (make sure you capture all listing data!)"
                  value={listingText}
                  onChange={handleTextChange}
                  onPaste={handleTextPaste}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-base sm:text-sm resize-none overflow-auto placeholder:text-muted-foreground transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none hover:border-gray-300"
                  style={{ minHeight: 90, maxHeight: 140 }}
                  required
                  disabled={!canFillText || paymentCompleted}
                  maxLength={7500}
                />
                <div className="text-xs text-gray-500 mt-1">Plain text only. Max 7500 characters.</div>
              </div>

              {/* Email Field (read-only) */}
              <div>
                <label className="block font-semibold mb-2 text-base">Email</label>
                <Input
                  type="email"
                  value={userEmail}
                  className="bg-gray-50 border border-gray-200 rounded-xl h-12 px-4 text-base sm:text-sm"
                  disabled
                />
                <div className="text-xs text-gray-500 mt-1">Email from your account</div>
              </div>

              {/* Payment Success Message */}
              {paymentCompleted && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-green-800 text-sm font-medium">
                    ✅ Payment successful! Click "Start Analysis" to begin the analysis.
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full rounded-xl px-6 py-4 text-base font-semibold"
                disabled={!canSubmit || analyzeLoading || isProcessingPayment}
              >
                {analyzeLoading ? "Processing..." : 
                 isProcessingPayment ? "Opening Payment..." :
                 paymentCompleted ? "Start Analysis" :
                 "Proceed to Checkout"}
              </Button>
              
              {analyzeError && <div className="text-red-500 text-sm mt-2">{analyzeError}</div>}
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
