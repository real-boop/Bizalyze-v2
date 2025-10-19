"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { AnalysisTriggerLoader } from "../app/listings/analysis-trigger-loader"
import { MultiStepAnalysisLoader } from "./multi-step-analysis-loader";
import { useAnalysisStatus } from "@/hooks/useAnalysisStatus";
import { AnalysisErrorOverlay } from "./analysis-error-overlay";
import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AuthModal from './AuthModal';

// Placeholder for dashboard tab component. Replace with your actual import if available.
function Tabs({ tabs, activeTab, onTabChange }: { tabs: string[]; activeTab: string; onTabChange: (tab: string) => void }) {
  return (
    <div className="flex border-b mb-4">
      {tabs.map(tab => (
        <button
          key={tab}
          className={`px-4 py-2 -mb-px border-b-2 font-medium transition-colors duration-200 ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-blue-600'}`}
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

export function BusinessSearchForm({ 
  analyzeOpen: externalAnalyzeOpen, 
  setAnalyzeOpen: externalSetAnalyzeOpen,
  findOpen: externalFindOpen,
  setFindOpen: externalSetFindOpen
}: {
  analyzeOpen?: boolean;
  setAnalyzeOpen?: (open: boolean) => void;
  findOpen?: boolean;
  setFindOpen?: (open: boolean) => void;
}) {
  // Use external state if provided, otherwise use internal state
  const [internalAnalyzeOpen, setInternalAnalyzeOpen] = useState(true)
  const [internalFindOpen, setInternalFindOpen] = useState(false)
  
  const analyzeOpen = externalAnalyzeOpen !== undefined ? externalAnalyzeOpen : internalAnalyzeOpen
  const setAnalyzeOpen = externalSetAnalyzeOpen || setInternalAnalyzeOpen
  const findOpen = externalFindOpen !== undefined ? externalFindOpen : internalFindOpen
  const setFindOpen = externalSetFindOpen || setInternalFindOpen

  // Form state for find business
  const [searchInput, setSearchInput] = useState("")
  const [onMarket, setOnMarket] = useState(false)
  const [offMarket, setOffMarket] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [cleanedSearch, setCleanedSearch] = useState("")
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const [searchError, setSearchError] = useState("");

  // Results state
  const [onMarketLoading, setOnMarketLoading] = useState(false)
  const [offMarketLoading, setOffMarketLoading] = useState(false)
  const [onMarketResults, setOnMarketResults] = useState<any[]>([])
  const [offMarketResults, setOffMarketResults] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState("On-market")

  // Analyze panel state
  const [analyzeUrl, setAnalyzeUrl] = useState("")
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [analyzeError, setAnalyzeError] = useState("")
  const [analyzeResult, setAnalyzeResult] = useState<any>(null)

  // Add state for loader and status
  const [showLoader, setShowLoader] = useState(false)
  const [loaderStatus, setLoaderStatus] = useState<{ scrapeStatus: "pending" | "completed" | "processing" | "failed"; analysisStatuses: ("pending" | "completed" | "processing" | "failed")[]; scrapeDataPresent: boolean; analysisRawPresent: boolean }>({ scrapeStatus: "pending", analysisStatuses: [], scrapeDataPresent: false, analysisRawPresent: false })
  const [loaderBusinessId, setLoaderBusinessId] = useState<string | null>(null)
  const [analysisCompleteInstant, setAnalysisCompleteInstant] = useState(false)
  const redirectTimeout = useRef<NodeJS.Timeout | null>(null)

  // Add new state for category dropdown and listing fields
  const [categories, setCategories] = useState<{ id: string; display_name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; display_name: string } | null>(null);
  const [listingUrl, setListingUrl] = useState("");
  const [listingText, setListingText] = useState("");
  const [isFetchingCategories, setIsFetchingCategories] = useState(false);
  // Add state for URL validation
  const [urlError, setUrlError] = useState<string>("");

  // Add email state and validation
  const [email, setEmail] = useState("");
  const [emailValidation, setEmailValidation] = useState<{
    canGetFree: boolean;
    hasAccount: boolean;
    isAccountVerified: boolean;
    hasPaidForThisListing: boolean;
    needsPayment: boolean;
    hasPaymentAccess: boolean; // Added this field back
  } | null>(null);
  const [emailValidationStatus, setEmailValidationStatus] = useState<'pending' | 'validating' | 'valid' | 'invalid'>('pending');

  // Payment state
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [paymentCheckoutId, setPaymentCheckoutId] = useState<string | null>(null);
  
  // Direct checkout state
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const checkoutInstanceRef = useRef<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup checkout instance and polling on unmount
  useEffect(() => {
    return () => {
      if (checkoutInstanceRef.current) {
        checkoutInstanceRef.current.close();
        checkoutInstanceRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Login modal state for existing users
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Session state to track if user is logged in
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // User ID state to track created account
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch categories on mount
  useEffect(() => {
    setIsFetchingCategories(true);
    fetch("/api/business-categories")
      .then(res => res.json())
      .then(data => {
        setCategories(data.categories || []);
      })
      .finally(() => setIsFetchingCategories(false));
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
      setUserId(session?.user?.id || null);
    });

    // Also get the current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);


  // Debounced email validation
  useEffect(() => {
    // Skip validation if payment was completed
    if (paymentCompleted) {
      return; // Status already set to 'valid' in payment success detection
    }
    
    // Reset validation if email is empty, too short, or invalid format
    if (!email || email.length < 3 || !isValidEmail(email)) {
      setEmailValidationStatus('pending');
      setEmailValidation(null);
      return;
    }

    setEmailValidationStatus('validating');
    
    const timeoutId = setTimeout(async () => {
      try {
        console.log('🔍 Making email validation API call for:', email, 'listingUrl:', listingUrl);
        const response = await fetch("/api/validate-analysis-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            email,
            listing_url: listingUrl || null
          })
        });
        
        const data = await response.json();
        console.log('🔍 API Response:', data);
        
        if (response.ok) {
          setEmailValidation({
            canGetFree: data.canGetFree,
            hasAccount: data.hasAccount,
            isAccountVerified: data.isAccountVerified,
            hasPaidForThisListing: data.hasPaidForThisListing,
            needsPayment: !data.canGetFree,
            hasPaymentAccess: data.hasPaidForThisListing
          });
          setEmailValidationStatus(data.canGetFree ? 'valid' : 'invalid');
          
          // Note: We no longer auto-disable form when detecting existing paid analyses
          // Form disablement is now handled by localStorage flag after actual checkout completion
          if (data.hasPaidForThisListing) {
            console.log('✅ API detected user already paid for this listing - but not disabling form');
            // Form will remain enabled - user can run analysis directly
          }
          
          console.log('🔍 Email validation result:', {
            canGetFree: data.canGetFree,
            hasPaidForThisListing: data.hasPaidForThisListing,
            emailValidationStatus: data.canGetFree ? 'valid' : 'invalid'
          });
        } else {
          setEmailValidationStatus('invalid');
          setEmailValidation(null);
          console.log('🔍 Email validation failed');
        }
      } catch (error) {
        console.error('Email validation error:', error);
        setEmailValidationStatus('invalid');
        setEmailValidation(null);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [email, listingUrl, paymentCompleted]); // Add paymentCompleted dependency

  // Reset payment state when email changes (new user) - but not after successful payment
  useEffect(() => {
    // Only reset if we're not in a payment success flow
    const searchParams = new URLSearchParams(window.location.search);
    const isPaymentSuccess = searchParams.get('payment_success') === 'true';
    
    const isCheckoutCompleted = localStorage.getItem('checkout_completed') === 'true';
    
    if (!isPaymentSuccess && !isCheckoutCompleted) {
      setPaymentCompleted(false);
      setPaymentCheckoutId(null);
    }
  }, [email]);

  // Email validation function
  function isValidEmail(email: string): boolean {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  }

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
    // Simple regex for http(s):// and domain
    return /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/.test(url);
  }

  // Update URL handler to validate
  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setListingUrl(value);
    if (!value) {
      setUrlError("");
    } else if (!validateUrl(value)) {
      setUrlError("Please enter a valid URL (e.g. https://www.example.com)");
    } else {
      setUrlError("");
    }
  }

  const canFillUrl = !!selectedCategory;
  const canFillText = !!selectedCategory && listingUrl.length > 0 && urlError === "";
  const canFillEmail = !!selectedCategory && listingUrl.length > 0 && listingText.length > 0 && urlError === "";
  const canSubmit = !!selectedCategory && listingUrl.length > 0 && listingText.length > 0 && email.length > 0 && urlError === "";
  
  // Debug logging
  console.log('🔍 Button State Debug:', {
    canSubmit,
    selectedCategory: !!selectedCategory,
    listingUrl: listingUrl.length > 0,
    listingText: listingText.length > 0,
    email: email.length > 0,
    urlError: urlError === "",
    emailValidationStatus,
    emailValidation: emailValidation?.hasAccount,
    paymentCompleted,
    showLoginModal
  });

  // Handle AI cleaning
  const handleCleanSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSearchError("")
    setShowConfirmation(false)
    setIsEditing(false)
    try {
      const res = await fetch("/api/clean-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to clean search")
      setCleanedSearch(data.search)
      setShowConfirmation(true)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Failed to clean search")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle search after confirmation
  const handleSearch = async (finalQuery: string) => {
    setShowConfirmation(false)
    setSearchError("")
    setIsLoading(true)
    try {
      // Step 1: Start the search session
      const startRes = await fetch("/api/search-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cleaned_query: finalQuery,
          on_market: onMarket,
          off_market: offMarket
        }),
      })
      const startData = await startRes.json()
      if (!startRes.ok || !startData.sessionId) throw new Error(startData.error || "Failed to start search session")
      const sessionId = startData.sessionId

      // Immediately redirect to listings page
      window.location.href = `/listings/${sessionId}`
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Failed to start business search")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle analyze panel submit
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    setAnalyzeLoading(true)
    setAnalyzeError("")
    setAnalyzeResult(null)
    
    try {
      if (!selectedCategory || !listingUrl || !listingText || !email) {
        setAnalyzeError("All fields including email are required.");
        setAnalyzeLoading(false);
        return;
      }

      // If payment was completed, skip email validation and go straight to analysis
      if (paymentCompleted) {
        await startAnalysis();
        return;
      }

      // Check if user has access to analysis but isn't logged in - force login first
      if (emailValidationStatus === 'valid' && emailValidation && !isLoggedIn && emailValidation.isAccountVerified) {
        // User has access to analysis but isn't logged in - force login first
        storeFormData();
        setShowLoginModal(true);
        setAnalyzeLoading(false);
        return;
      }

      // Email validation is already done automatically, so we know the status
      if (emailValidationStatus === 'invalid') {
        // Check if user exists and is logged in
        const { data: { session } } = await supabase.auth.getSession();
        
        if (emailValidation?.hasAccount && !session) {
          // Store form data in localStorage before showing login modal
          storeFormData();
          
          // Existing user but not logged in - show login modal
          setShowLoginModal(true);
          setAnalyzeLoading(false);
          return;
        }
        
        // Store form data before payment
        storeFormData();
        
        // Go directly to checkout (same functionality as PaymentModal)
        await handleDirectCheckout(
          email,
          emailValidation?.hasAccount || false,
          { 
            categoryId: selectedCategory.id,
            listingUrl,
            listingText 
          }
        );
        setAnalyzeLoading(false);
        return;
      }

      // For new emails, proceed with analysis
      setShowLoader(true);
      setLoaderBusinessId(null);
      setAnalysisCompleteInstant(false);

      const requestBody: any = {
        categoryId: selectedCategory.id,
        listingUrl,
        listingText,
        email
      };
      
      // Add checkoutId if this is a paid analysis
      console.log('[Frontend] Payment status:', { paymentCompleted, paymentCheckoutId });
      if (paymentCompleted && paymentCheckoutId) {
        requestBody.checkoutId = paymentCheckoutId;
        console.log('[Frontend] Adding checkoutId to request:', paymentCheckoutId);
      } else {
        console.log('[Frontend] Not adding checkoutId - paymentCompleted:', paymentCompleted, 'paymentCheckoutId:', paymentCheckoutId);
      }

      const res = await fetch("/api/trigger-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze business");
      
      if (data.business_id) {
        setLoaderBusinessId(data.business_id);
        if (data.status === "completed") {
          setLoaderStatus({ scrapeStatus: "completed", analysisStatuses: ["completed"], scrapeDataPresent: false, analysisRawPresent: false });
          setAnalysisCompleteInstant(true);
          redirectTimeout.current = setTimeout(() => {
            const tokenParam = paymentCheckoutId ? `?token=${paymentCheckoutId}` : '';
            window.location.href = `/dashboard/${data.business_id}${tokenParam}`;
          }, 1000);
          return;
        }
        // If not complete, polling will handle redirect
      } else {
        setAnalyzeResult(data);
      }
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Failed to analyze business");
      setShowLoader(false);
    } finally {
      setAnalyzeLoading(false);
    }
  }

  // Start analysis function for paid users
  const startAnalysis = async () => {
    setAnalyzeLoading(true);
    setAnalyzeError("");
    
    // Clear localStorage now that analysis is starting
    localStorage.removeItem('pendingAnalysisForm');
    console.log('🧹 Cleared localStorage - analysis starting');
    
    try {
      const requestBody: any = {
        categoryId: selectedCategory?.id,
        listingUrl,
        listingText,
        email
      };
      
      // Add payment info if this is a paid analysis
      console.log('[Frontend] Payment status (startAnalysis):', { paymentCompleted, paymentCheckoutId });
      if (paymentCompleted && paymentCheckoutId) {
        requestBody.paymentCompleted = true;
        requestBody.checkoutId = paymentCheckoutId;
        requestBody.email = email;
        requestBody.userId = userId;
        console.log('[Frontend] Adding payment info to request:', { checkoutId: paymentCheckoutId, email, userId });
      } else {
        console.log('[Frontend] Not adding payment info - paymentCompleted:', paymentCompleted, 'paymentCheckoutId:', paymentCheckoutId);
      }

      const response = await fetch('/api/trigger-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
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

  // Cleanup checkout instance on unmount
  useEffect(() => {
    return () => {
      if (checkoutInstanceRef.current) {
        checkoutInstanceRef.current.close();
      }
    };
  }, []);

  // Store form data in localStorage before payment
  const storeFormData = () => {
    const formData = {
      email,
      categoryId: selectedCategory?.id,
      listingUrl,
      listingText,
      timestamp: Date.now()
    };
    console.log('🔍 STORING FORM DATA:', formData);
    localStorage.setItem('pendingAnalysisForm', JSON.stringify(formData));
    console.log('🔍 FORM DATA STORED IN LOCALSTORAGE');
    
    // Verify it was stored
    const stored = localStorage.getItem('pendingAnalysisForm');
    console.log('🔍 VERIFICATION - Stored data:', stored ? 'Found' : 'Not found');
  };

  // Detect payment success from URL parameters IMMEDIATELY (don't wait for categories)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const paymentSuccess = searchParams.get('payment_success');
    const checkoutId = searchParams.get('token');
    
    // Set payment state IMMEDIATELY to prevent email validation race condition
    if (paymentSuccess === 'true' && checkoutId) {
      console.log('✅ Payment success detected from URL - setting state immediately');
      console.log('🔍 Checkout ID:', checkoutId);
      
      setPaymentCompleted(true);
      setPaymentCheckoutId(checkoutId);
      setEmailValidationStatus('valid');
      
      // Update database immediately to sync with frontend
      const updatePaymentStatus = async () => {
        try {
          console.log('🔄 [FRONTEND] Updating database immediately...');
          
          // Get email from localStorage (available immediately, unlike state)
          const storedData = localStorage.getItem('pendingAnalysisForm');
          const emailFromStorage = storedData ? JSON.parse(storedData).email : null;
          
          console.log('🔍 [FRONTEND] Email from localStorage:', emailFromStorage);
          
          if (!emailFromStorage) {
            console.error('❌ [FRONTEND] No email found in localStorage');
            return;
          }
          
          const response = await fetch('/api/check-payment-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'update_payment_status',
              checkoutId: checkoutId,
              email: emailFromStorage
            })
          });
          
          const result = await response.json();
          if (result.success) {
            console.log('✅ [FRONTEND] Database updated successfully');
          } else {
            console.log('⚠️ [FRONTEND] Database update result:', result);
          }
        } catch (error) {
          console.error('❌ [FRONTEND] Failed to update database:', error);
        }
      };
      
      updatePaymentStatus();
      
      // Clean up URL parameters immediately
      window.history.replaceState({}, '', window.location.pathname);
      console.log('✅ URL parameters cleaned up');
      
      // Show success message
      toast.success("Payment successful! Click 'Run Analysis' to begin.");
      setAnalyzeOpen(true);
      console.log('✅ Payment state set - paymentCompleted: true');
    }
  }, []); // Run ONCE on mount, don't wait for categories

  // Restore form data AFTER categories load
  useEffect(() => {
    if (paymentCompleted && categories.length > 0) {
      console.log('✅ Restoring form data after categories loaded');
      console.log('🔍 Payment completed:', paymentCompleted);
      console.log('🔍 Categories loaded:', categories.length);
      
      // Check all localStorage keys to see what's there
      console.log('🔍 All localStorage keys:', Object.keys(localStorage));
      
      const storedData = localStorage.getItem('pendingAnalysisForm');
      console.log('🔍 Stored form data:', storedData ? 'Found' : 'Not found');
      if (storedData) {
        console.log('🔍 Raw stored data:', storedData);
      }
      
      if (storedData) {
        try {
          const formData = JSON.parse(storedData);
          console.log('🔍 Parsed form data:', formData);
          
          // Restore form data
          setEmail(formData.email || '');
          setListingUrl(formData.listingUrl || '');
          setListingText(formData.listingText || '');
          console.log('✅ Basic form data restored');
          
          // Restore category
          if (formData.categoryId) {
            const cat = categories.find(c => c.id === formData.categoryId);
            if (cat) {
              setSelectedCategory(cat);
              console.log('✅ Category restored:', cat.display_name);
            } else {
              console.log('⚠️ Category not found:', formData.categoryId);
            }
          }
          
          // DON'T clear localStorage here - let startAnalysis() do it when user actually starts analysis
          console.log('✅ Form data restored - localStorage preserved until analysis starts');
          
          // Scroll to form
          setTimeout(() => {
            const formElement = document.querySelector('[data-form-section]');
            if (formElement) {
              formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              console.log('✅ Scrolled to form');
            }
          }, 100);
        } catch (error) {
          console.error('❌ Failed to restore form data:', error);
        }
      }
    }
  }, [paymentCompleted, categories]); // Run when BOTH payment completed AND categories loaded


  // UI
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

  const handlePaymentSuccess = (businessId: string) => {
    setPaymentCompleted(true);
    toast.success("Payment successful! Click 'Start Analysis' to begin.");
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

  const handleDirectCheckout = async (email: string, hasAccount: boolean, businessData: any) => {
    setIsProcessingPayment(true);
    
    try {
      // ALWAYS create/update pending record (works for both new and existing users)
      console.log('Creating/updating pending record for:', email);
      const accountResponse = await fetch('/api/auth/create-temp-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          businessData
        })
      });

      if (!accountResponse.ok) {
        const errorData = await accountResponse.json();
        console.error('Error creating pending record:', errorData);
        // Continue to checkout even if this fails (webhook can handle it)
      }

      const accountData = await accountResponse.json();
      console.log('✅ Pending record ready, proceeding to checkout');

      // Create checkout session (same as PaymentModal)
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: `analysis-${Date.now()}`,
          customerEmail: email.toLowerCase(), // Normalize email to lowercase
          businessData,
          userId // Pass user_id for webhook (null for existing users, will be looked up by email)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { checkoutUrl, checkoutId } = await response.json();
      
      // Open embedded checkout (same as PaymentModal)
      const checkout = await PolarEmbedCheckout.create(checkoutUrl, 'light');
      checkoutInstanceRef.current = checkout;
      
      // All the same event listeners as PaymentModal
      checkout.addEventListener('loaded', (event) => {
        console.log('Checkout loaded');
      });

      checkout.addEventListener('confirmed', (event) => {
        console.log('Order confirmed, starting polling backup...');
        
        // Start polling as backup in case success event fails
        pollingIntervalRef.current = startPolling(checkoutId, () => {
          toast.success("Payment successful! Analysis will begin shortly.");
          setPaymentCompleted(true);
          setPaymentCheckoutId(checkoutId);
          localStorage.setItem('checkout_completed', 'true');
          localStorage.setItem('checkout_id', checkoutId);
          handlePaymentSuccess(`analysis-${Date.now()}`);
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
        
        toast.success("Payment successful! Analysis will begin shortly.");
        
        // CRITICAL FIX: Capture checkoutId and set payment state (same as current flow)
        setPaymentCompleted(true);
        setPaymentCheckoutId(checkoutId);
        localStorage.setItem('checkout_completed', 'true');
        localStorage.setItem('checkout_id', checkoutId);
        
        // Call the same success handler
        handlePaymentSuccess(`analysis-${Date.now()}`);
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
        // in startAnalysis() when the user actually starts the analysis.
      });

    } catch (error) {
      console.error('Payment error:', error);
      toast.error("Payment failed. Please try again.");
      setIsProcessingPayment(false);
    }
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
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
                    const tokenParam = paymentCheckoutId ? `?token=${paymentCheckoutId}` : '';
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
      <div className="max-w-2xl lg:max-w-4xl lg:mx-auto w-full">
        {/* Analyze a business listing panel - FIRST */}
        <Card className="w-full transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:ring-2 hover:ring-blue-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:shadow-lg">
          <div
            className="w-full flex justify-between items-center p-6 text-left cursor-pointer select-none"
            onClick={() => setAnalyzeOpen(!analyzeOpen)}
            aria-expanded={analyzeOpen}
          >
            <span className="font-semibold text-lg">Analyze a business listing</span>
            <span className="ml-2">{analyzeOpen ? "▲" : "▼"}</span>
          </div>
          {analyzeOpen && (
            <CardContent className="pt-4 pb-8" data-form-section>
              <form className="space-y-6" onSubmit={handleAnalyze}>
                {/* Category Dropdown */}
                <label className="block font-semibold mb-1 text-base">Business Category</label>
                <select
                  className="w-full bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-gray-700 rounded-xl h-12 px-4 text-base sm:text-sm disabled:opacity-50 transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600"
                  value={selectedCategory?.id || ""}
                  onChange={e => {
                    const cat = categories.find(c => c.id === e.target.value);
                    setSelectedCategory(cat || null);
                    setListingUrl("");
                    setListingText("");
                    setUrlError("");
                    setEmail("");
                    setEmailValidation(null);
                    setEmailValidationStatus('pending');
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

                {/* Listing URL Field */}
                <label className="block font-semibold mb-1 text-base mt-4">Listing URL</label>
                <Input
                  type="url"
                  placeholder="Paste business listing URL here..."
                  value={listingUrl}
                  onChange={handleUrlChange}
                  className={`bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-gray-700 rounded-xl h-12 px-4 text-base sm:text-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600 ${urlError ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                  required
                  disabled={!canFillUrl || paymentCompleted}
                />
                {urlError && <div className="text-red-500 text-sm mt-1 mb-2">{urlError}</div>}

                {/* Listing Text Field */}
                <label className="block font-semibold mb-1 text-base mt-4">Listing Text</label>
                <textarea
                  placeholder="Paste the business listing text here (make sure you capture all listing data!)"
                  value={listingText}
                  onChange={handleTextChange}
                  onPaste={handleTextPaste}
                  className="w-full bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-base sm:text-sm resize-none overflow-auto placeholder:text-muted-foreground transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600"
                  style={{ minHeight: 90, maxHeight: 140 }}
                  required
                  disabled={!canFillText || paymentCompleted}
                  maxLength={7500}
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Plain text only. Max 7500 characters.</div>

                {/* Email Field - appears after text is filled */}
                {canFillEmail && (
                  <>
                    <label className="block font-semibold mb-1 text-base mt-4">Your Email (to check your payment status)</label>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-gray-700 rounded-xl h-12 px-4 text-base sm:text-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600"
                      required
                      disabled={analyzeLoading || showLoader || isProcessingPayment || paymentCompleted}
                    />
                    {/* Email validation status */}
                    {emailValidationStatus === 'validating' && (
                      <div className="text-sm mt-2 text-blue-500">
                        🔄 Validating email...
                      </div>
                    )}
                    {emailValidationStatus === 'valid' && emailValidation && (
                      <div className="text-sm mt-2 text-green-500">
                        ✅ You have already paid for this business report
                      </div>
                    )}
                    {emailValidationStatus === 'invalid' && emailValidation && (
                      <div className="text-sm mt-2 text-red-500">
                        Complete payment to start your analysis
                      </div>
                    )}
                  </>
                )}


                {/* Analyze Button */}
                <Button
                  type="submit"
                  className="w-full rounded-xl px-6 py-4 text-base font-semibold"
                  disabled={!canSubmit || analyzeLoading || isProcessingPayment || showLoginModal || emailValidationStatus === 'validating'}
                >
                  {analyzeLoading ? "Analyzing..." : 
                   emailValidationStatus === 'validating' ? "Validating email..." :
                   paymentCompleted ? "Run Analysis" :
                   // Check for verified accounts that need to log in (regardless of payment status)
                   emailValidation?.hasAccount && emailValidation?.isAccountVerified && !isLoggedIn ? "Login to Continue" :
                   emailValidationStatus === 'invalid' && emailValidation?.canGetFree && !isLoggedIn ? "Login to Continue" :
                   emailValidationStatus === 'valid' && !isLoggedIn && emailValidation?.isAccountVerified ? "Login to Continue" :
                   emailValidationStatus === 'invalid' ? "Checkout for Analysis" :
                   emailValidationStatus === 'valid' ? "Run Analysis" :
                   emailValidationStatus === 'pending' ? "Enter valid email" :
                   "Analyze Business"}
                </Button>
                {analyzeError && <div className="text-red-500 text-sm mt-2">{analyzeError}</div>}
                {!analyzeLoading && !showLoader && !analysisCompleteInstant && analyzeResult && (
                  <div className="mt-4 p-4 border rounded-xl bg-gray-50 dark:bg-gray-900">
                    <div className="font-semibold mb-2">Analysis Result:</div>
                    <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(analyzeResult, null, 2)}</pre>
                  </div>
                )}
              </form>
            </CardContent>
          )}
        </Card>

        {/* Collapsible Find Business Panel - SECOND */}
        <Card className="w-full mt-8 relative transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:ring-2 hover:ring-blue-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:shadow-lg">
          {/* Overlay to disable interaction */}
          <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-10 rounded-lg flex items-center justify-start">
            <div className="text-left p-6">
              <p className="font-semibold text-gray-700 dark:text-gray-300">Coming Soon</p>
              <p className="text-sm text-gray-500">This feature will be available shortly</p>
            </div>
          </div>
          
          <div
            className="w-full flex justify-between items-center p-6 text-left cursor-pointer select-none"
            onClick={() => setFindOpen(!findOpen)}
            aria-expanded={findOpen}
          >
            <span className="font-semibold text-lg">Find a business to buy</span>
            <span className="ml-2">{findOpen ? "▲" : "▼"}</span>
          </div>
          {findOpen && (
            <CardContent className="pt-4 pb-8">
              <form className="space-y-4" onSubmit={handleCleanSearch}>
                <Input
                  type="text"
                  placeholder="Enter location and business type..."
                  className="bg-white/95 dark:bg-black/95 border border-black/10 dark:border-white/10 rounded-xl h-12 px-4 text-base sm:text-sm"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  required
                  disabled={isLoading || showConfirmation}
                />
                {/* Subtext restored */}
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  (e.g. "car washes in houston, texas" or "laundromats in new york city")
                </div>
                <div className="flex items-center gap-6 mt-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={onMarket}
                      onChange={e => setOnMarket(e.target.checked)}
                      disabled={isLoading || showConfirmation}
                      title="Listed businesses for sale"
                    />
                    On-market listings
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={offMarket}
                      onChange={e => setOffMarket(e.target.checked)}
                      disabled={isLoading || showConfirmation}
                      title="Actively operating businesses"
                    />
                    Off-market businesses
                  </label>
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-xl px-6 py-4 text-base font-semibold mt-4"
                  disabled={isLoading || showConfirmation || (!onMarket && !offMarket)}
                >
                  {isLoading ? "Cleaning..." : "Search"}
                </Button>
              </form>
              {searchError && <div className="text-red-500 text-sm mt-2">{searchError}</div>}
              {/* Confirmation and edit step */}
              {showConfirmation && !isEditing && (
                <div className="mt-6 p-4 border rounded-xl bg-gray-50 dark:bg-gray-900">
                  <div className="mb-2 text-base">We'll find businesses for:</div>
                  <div className="font-semibold text-lg mb-4">{cleanedSearch}</div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleSearch(cleanedSearch)}
                      className="px-6 py-2 rounded-xl font-semibold"
                    >
                      Approve & Start Search
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setIsEditing(true)
                        setEditValue(cleanedSearch)
                      }}
                      className="px-6 py-2 rounded-xl font-semibold"
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              )}
              {showConfirmation && isEditing && (
                <div className="mt-6 p-4 border rounded-xl bg-gray-50 dark:bg-gray-900">
                  <div className="mb-2 text-base">Edit your search:</div>
                  <Input
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="mb-4 bg-white/95 dark:bg-black/95 border border-black/10 dark:border-white/10 rounded-xl h-12 px-4 text-base sm:text-lg"
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setCleanedSearch(editValue)
                        setIsEditing(false)
                      }}
                      className="px-6 py-2 rounded-xl font-semibold"
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setIsEditing(false)}
                      className="px-6 py-2 rounded-xl font-semibold"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
        {/* Results Tabs */}
        {(findOpen && (onMarketResults.length > 0 || offMarketResults.length > 0 || onMarketLoading || offMarketLoading)) && (
          <div className="mt-8">
            <Tabs
              tabs={[onMarket ? "On-market" : null, offMarket ? "Off-market" : null].filter(Boolean) as string[]}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
            <div>
              {activeTab === "On-market" && (
                <div>
                  {onMarketLoading ? (
                    <div className="text-blue-600 font-semibold py-8 text-center">Loading on-market results...</div>
                  ) : (
                    <ul className="divide-y">
                      {onMarketResults.map((result, idx) => (
                        <li key={idx} className="py-4">{JSON.stringify(result)}</li>
                      ))}
                      {onMarketResults.length === 0 && <li className="py-4 text-gray-500">No results found.</li>}
                    </ul>
                  )}
                </div>
              )}
              {activeTab === "Off-market" && (
                <div>
                  {offMarketLoading ? (
                    <div className="text-green-600 font-semibold py-8 text-center">Loading off-market results...</div>
                  ) : (
                    <ul className="divide-y">
                      {offMarketResults.map((result, idx) => (
                        <li key={idx} className="py-4">{JSON.stringify(result)}</li>
                      ))}
                      {offMarketResults.length === 0 && <li className="py-4 text-gray-500">No results found.</li>}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}


        {/* Login Modal for Existing Users */}
        <AuthModal 
          open={showLoginModal} 
          onOpenChange={setShowLoginModal}
          onSignIn={() => {
            // Login successful - close modal and restore form data
            setShowLoginModal(false);
            
            // Restore form data from localStorage (same as payment success flow)
            const storedData = localStorage.getItem('pendingAnalysisForm');
            if (storedData) {
              try {
                const formData = JSON.parse(storedData);
                
                // Restore form data
                setEmail(formData.email || '');
                setListingUrl(formData.listingUrl || '');
                setListingText(formData.listingText || '');
                
                // Restore category AFTER other fields to prevent clearing
                if (formData.categoryId && categories.length > 0) {
                  const cat = categories.find(c => c.id === formData.categoryId);
                  setSelectedCategory(cat || null);
                }
                
                // DON'T clear localStorage here - let startAnalysis() do it when user actually starts analysis
                console.log('✅ Form data restored (second location) - localStorage preserved until analysis starts');
              } catch (error) {
                console.error('Failed to restore form data:', error);
              }
            }
            
            // No need to re-validate - we already have the emailValidation data
          }}
          defaultEmail={email}
        />
      </div>
    </motion.div>
  )
}

