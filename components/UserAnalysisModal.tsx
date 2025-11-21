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
import { US_STATES } from "@/lib/us-states"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

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
  const [businessName, setBusinessName] = useState<string>("");
  const [listingType, setListingType] = useState<'public' | 'private'>('public');
  const [state, setState] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [revenue, setRevenue] = useState<string>("");
  const [sde, setSde] = useState<string>("");
  const [listingUrl, setListingUrl] = useState("");
  const [listingText, setListingText] = useState("");
  const [isFetchingCategories, setIsFetchingCategories] = useState(false);
  const [urlError, setUrlError] = useState<string>("");
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  
  // Pre-validation state
  const [preValidatedBusinessId, setPreValidatedBusinessId] = useState<string | null>(null);
  const [isPreValidating, setIsPreValidating] = useState(false);
  const [preValidationError, setPreValidationError] = useState<string>("");
  const [generatedVirtualUrl, setGeneratedVirtualUrl] = useState<string | null>(null);
  
  // User ID state (from session)
  const [userId, setUserId] = useState<string | null>(null);
  
  // PDF upload state
  const [inputMethod, setInputMethod] = useState<'text' | 'pdf'>('text');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [pdfError, setPdfError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
  
  // Check if form is pre-validated (disable all fields)
  const isPreValidated = !!preValidatedBusinessId && !paymentCompleted;

  // Get user ID from session
  useEffect(() => {
    const getUserId = async () => {
      console.log('[UserAnalysisModal] 🔍 Fetching user session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[UserAnalysisModal] ❌ Error fetching session:', error);
      }
      if (session?.user?.id) {
        console.log('[UserAnalysisModal] ✅ User ID found:', session.user.id);
        setUserId(session.user.id);
      } else {
        console.log('[UserAnalysisModal] ⚠️ No user session found');
        setUserId(null);
      }
    };
    getUserId();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[UserAnalysisModal] 🔄 Auth state changed:', event, session?.user?.id || 'no user');
      if (session?.user?.id) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
      setBusinessName("");
      setListingType('public');
      setState("");
      setCity("");
      setRevenue("");
      setSde("");
      setListingUrl("");
      setListingText("");
      setUrlError("");
      setDuplicateError(null);
      setAnalyzeError("");
      setShowLoader(false);
      setLoaderBusinessId(null);
      setPaymentCompleted(false);
      setStoredCheckoutId(null);
      setInputMethod('text');
      setPdfFile(null);
      setPdfExtracting(false);
      setPdfError("");
      setPreValidatedBusinessId(null);
      setIsPreValidating(false);
      setPreValidationError("");
      setGeneratedVirtualUrl(null);
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
          setListingType(formData.listingType || 'public');
          setBusinessName(formData.businessName || '');
          setState(formData.state || '');
          setCity(formData.city || '');
          setRevenue(formData.revenue || '');
          setSde(formData.sde || '');
          setListingUrl(formData.listingUrl || '');
          setListingText(formData.listingText || '');
          setGeneratedVirtualUrl(formData.listingUrl?.startsWith('internal://offmarket') ? formData.listingUrl : null);
          setPreValidatedBusinessId(formData.preValidatedBusinessId || null);
          
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

  // Currency formatting helpers (from quick-valuation-form)
  function formatCurrencyInput(value: string): string {
    // Remove all non-numeric characters
    const numericValue = value.replace(/\D/g, '')
    if (!numericValue) return ''
    
    // Format with commas
    return parseInt(numericValue).toLocaleString()
  }

  // Parse formatted currency string back to number or return null for "N/A"
  function parseCurrencyInput(value: string): number | null {
    const upperValue = value.toUpperCase().trim();
    if (upperValue === 'N/A' || upperValue === 'NA') {
      return null;
    }
    const cleaned = value.replace(/\D/g, '');
    return cleaned ? parseInt(cleaned) : null;
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

  // PDF to base64 conversion
  const convertPdfToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (data:application/pdf;base64,)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Extract text from PDF
  const handlePdfExtraction = async (file: File) => {
    setPdfExtracting(true);
    setPdfError("");
    setListingText(""); // Clear previous text
    
    try {
      // Validate file size (10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setPdfError("PDF file is too large. Maximum size is 10MB.");
        setPdfExtracting(false);
        return;
      }

      // Validate file type
      if (file.type !== 'application/pdf') {
        setPdfError("Please upload a valid PDF file.");
        setPdfExtracting(false);
        return;
      }

      const base64 = await convertPdfToBase64(file);
      
      const response = await fetch('/api/extract-pdf-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pdfBase64: base64,
          filename: file.name 
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Extraction failed');
      }

      // Auto-fill textarea with extracted text
      setListingText(data.extractedText);
      
      if (data.wasTruncated) {
        toast.warning("PDF text was truncated to 7500 characters.");
      } else {
        toast.success("PDF text extracted successfully!");
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract PDF';
      setPdfError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setPdfExtracting(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
      handlePdfExtraction(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      handlePdfExtraction(file);
    } else {
      setPdfError("Please drop a valid PDF file.");
    }
  };

  // Reset PDF when switching to text mode, clear text when switching to PDF mode (unless PDF already extracted)
  const handleInputMethodChange = (value: 'text' | 'pdf') => {
    setInputMethod(value);
    if (value === 'text') {
      setPdfFile(null);
      setPdfError("");
      setListingText("");
    } else if (value === 'pdf') {
      // Clear text when switching to PDF mode, but only if no PDF file is already uploaded
      // (if PDF is already uploaded, keep the extracted text)
      if (!pdfFile) {
        setListingText("");
      }
    }
  };

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

  // Validation: location and revenue/SDE are required
  const hasLocation = !!state && !!city.trim();
  const hasRevenue = revenue.trim() !== "";
  const hasSde = sde.trim() !== "";
  const hasValidRevenue = revenue.trim().toUpperCase() === 'N/A' || parseCurrencyInput(revenue) !== null;
  const hasValidSde = sde.trim().toUpperCase() === 'N/A' || parseCurrencyInput(sde) !== null;
  
  // URL is only required for public listings
  const canFillUrl = !!selectedCategory && hasLocation && hasRevenue && hasSde && hasValidRevenue && hasValidSde;
  const urlRequired = listingType === 'public';
  const hasValidUrl = !urlRequired || (listingUrl.length > 0 && urlError === "");
  
  // Text can be filled if category is selected and (private listing OR valid URL)
  const canFillText = !!selectedCategory && hasLocation && hasRevenue && hasSde && hasValidRevenue && hasValidSde && (listingType === 'private' || hasValidUrl);
  
  // Can submit if all required fields are filled
  const canSubmit = !!selectedCategory && 
                    hasLocation && 
                    hasRevenue && 
                    hasSde && 
                    hasValidRevenue && 
                    hasValidSde && 
                    hasValidUrl && 
                    listingText.length > 0 && 
                    !duplicateError &&
                    !!userId; // Require user to be logged in
  
  // Debug logging for button state
  useEffect(() => {
    console.log('[UserAnalysisModal] 🔘 Button state:', {
      canSubmit,
      selectedCategory: !!selectedCategory,
      hasLocation,
      hasRevenue,
      hasSde,
      hasValidRevenue,
      hasValidSde,
      hasValidUrl,
      hasListingText: listingText.length > 0,
      duplicateError: !!duplicateError,
      userId: !!userId,
      isPreValidating,
      analyzeLoading,
      isProcessingPayment,
      paymentCompleted,
      preValidatedBusinessId: !!preValidatedBusinessId
    });
  }, [canSubmit, selectedCategory, hasLocation, hasRevenue, hasSde, hasValidRevenue, hasValidSde, hasValidUrl, listingText.length, duplicateError, userId, isPreValidating, analyzeLoading, isProcessingPayment, paymentCompleted, preValidatedBusinessId]);

  // Handle form submission - two-phase: pre-validate then checkout
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[UserAnalysisModal] 🚀 Form submission started');
    console.log('[UserAnalysisModal] 📋 Form state:', {
      selectedCategory: selectedCategory?.id,
      businessName,
      listingType,
      state,
      city,
      revenue,
      sde,
      listingUrl,
      listingTextLength: listingText.length,
      userId,
      preValidatedBusinessId,
      inputMethod
    });
    
    setAnalyzeLoading(true);
    setAnalyzeError("");
    setDuplicateError(null);
    setPreValidationError("");
    
    try {
      // Validate required fields
      if (!selectedCategory || !state || !city.trim() || !revenue.trim() || !sde.trim() || !listingText.trim()) {
        console.log('[UserAnalysisModal] ❌ Validation failed: missing required fields');
        setAnalyzeError("All fields are required.");
        setAnalyzeLoading(false);
        return;
      }

      // Validate user ID
      if (!userId) {
        console.log('[UserAnalysisModal] ❌ Validation failed: no user ID');
        setAnalyzeError("Please ensure you are logged in.");
        setAnalyzeLoading(false);
        return;
      }
      
      console.log('[UserAnalysisModal] ✅ All validations passed');

      // Determine final listing URL
      let finalListingUrl: string;

      if (listingType === 'public') {
        // Use user-provided URL for public listings
        finalListingUrl = listingUrl;
      } else {
        // Private listing: use backend-generated URL if available (after pre-validation)
        // Otherwise send empty - backend will generate hash
        finalListingUrl = generatedVirtualUrl || '';
      }

      // Validate URL for public listings
      if (listingType === 'public' && (!finalListingUrl || urlError)) {
        setAnalyzeError("Please enter a valid listing URL.");
        setAnalyzeLoading(false);
        return;
      }

      // Format revenue/SDE for top metadata block
      const revenueDisplay = revenue.trim().toUpperCase() === 'N/A' 
        ? 'N/A' 
        : `$${parseCurrencyInput(revenue)?.toLocaleString() || '0'}`;
      const sdeDisplay = sde.trim().toUpperCase() === 'N/A' 
        ? 'N/A' 
        : `$${parseCurrencyInput(sde)?.toLocaleString() || '0'}`;
      
      // Create top metadata block before listing text
      // NOTE: User inputs are ALWAYS included in metadata block, whether PDF or text input
      // This ensures step1 data cleaning has access to user-provided data
      const nameLine = businessName.trim() ? `Business Name: ${businessName.trim()}\n` : '';
      const enhancedListingText = `=== USER INPUTS ===
${nameLine}Location: ${city}, ${state}
Annual Revenue: ${revenueDisplay}
SDE/Cash Flow: ${sdeDisplay}
================================

NOTE: The above are user-provided inputs. If the extracted text below contains conflicting information (e.g., different location, revenue, or SDE), these data takes precedence.

${listingText}`;
      
      console.log('[UserAnalysisModal] 📝 Enhanced listing text created, length:', enhancedListingText.length);

      // PHASE 1: Pre-validation (if not already done)
      if (!preValidatedBusinessId) {
        console.log('[UserAnalysisModal] 🔄 Starting pre-validation phase...');
        setIsPreValidating(true);
        
        try {
          const preValidatePayload = {
            categoryId: selectedCategory.id,
            listingUrl: finalListingUrl, // For public listings, this is the provided URL
            listingText: enhancedListingText, // Contains metadata block + user text/PDF content
            listingType,
            state,
            city,
            revenue,
            sde,
            email: userEmail,
            userId
          };
          
          console.log('[UserAnalysisModal] 📤 Calling pre-validate-business API:', {
            categoryId: preValidatePayload.categoryId,
            listingType: preValidatePayload.listingType,
            listingUrl: preValidatePayload.listingUrl,
            listingTextLength: preValidatePayload.listingText.length,
            userId: preValidatePayload.userId
          });
          
          const preValidateResponse = await fetch('/api/pre-validate-business', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preValidatePayload)
          });
          
          console.log('[UserAnalysisModal] 📥 Pre-validation response status:', preValidateResponse.status);

          const preValidateData = await preValidateResponse.json();
          console.log('[UserAnalysisModal] 📥 Pre-validation response data:', preValidateData);

          if (!preValidateResponse.ok) {
            console.log('[UserAnalysisModal] ❌ Pre-validation failed:', preValidateResponse.status, preValidateData);
            // Handle specific error cases
            if (preValidateResponse.status === 409) {
              // User already analyzed this business
              console.log('[UserAnalysisModal] ⚠️ Duplicate business detected');
              setDuplicateError(preValidateData.error || "You already analyzed this business.");
              if (preValidateData.existingBusinessId) {
                setPreValidatedBusinessId(preValidateData.existingBusinessId);
              }
            } else {
              setPreValidationError(preValidateData.error || 'Pre-validation failed');
              setAnalyzeError(preValidateData.error || 'Data validation failed. Please check your inputs and try again.');
            }
            setIsPreValidating(false);
            setAnalyzeLoading(false);
            return;
          }

          // Pre-validation successful
          console.log('[UserAnalysisModal] ✅ Pre-validation successful, business_id:', preValidateData.business_id);
          setPreValidatedBusinessId(preValidateData.business_id);
          setGeneratedVirtualUrl(preValidateData.listingUrl); // Store the URL (hash-based for private)
          setIsPreValidating(false);
          
          // Store in localStorage
          const formData = {
            email: userEmail,
            categoryId: selectedCategory.id,
            businessName,
            listingType,
            state,
            city,
            revenue,
            sde,
            listingUrl: preValidateData.listingUrl, // Store the final URL (hash-based for private)
            listingText,
            preValidatedBusinessId: preValidateData.business_id,
            timestamp: Date.now()
          };
          localStorage.setItem('pendingAnalysisForm', JSON.stringify(formData));
          console.log('[UserAnalysisModal] 💾 Form data saved to localStorage');
          
          toast.success("Data validated successfully! Click 'Proceed to Checkout' to continue.");
          setAnalyzeLoading(false);
          return;
        } catch (err) {
          console.error('[UserAnalysisModal] ❌ Pre-validation error:', err);
          setPreValidationError(err instanceof Error ? err.message : 'Pre-validation failed');
          setAnalyzeError(err instanceof Error ? err.message : 'Pre-validation failed');
          setIsPreValidating(false);
          setAnalyzeLoading(false);
          return;
        }
      }

      // PHASE 2: Proceed to checkout (pre-validation already done)
      console.log('[UserAnalysisModal] 🔄 Starting checkout phase, business_id:', preValidatedBusinessId);
      // If payment is completed, start analysis
      if (paymentCompleted && storedCheckoutId) {
        await startAnalysisAfterPayment(storedCheckoutId, {
          categoryId: selectedCategory.id,
          listingUrl: generatedVirtualUrl || finalListingUrl,
          listingText: enhancedListingText,
          state,
          city,
          businessId: preValidatedBusinessId // Pass pre-validated business_id
        });
        setAnalyzeLoading(false);
        return;
      }

      // Go to checkout
      await handleDirectCheckout(
        userEmail,
        true, // hasAccount = true for authenticated users
        { 
          categoryId: selectedCategory.id,
          listingUrl: generatedVirtualUrl || finalListingUrl,
          listingText: enhancedListingText,
          state,
          city,
          listingType,
          businessId: preValidatedBusinessId // Pass pre-validated business_id
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
      businessName,
      listingType,
      state,
      city,
      revenue,
      sde,
      listingUrl: generatedVirtualUrl || listingUrl, // Use generated URL if available
      listingText,
      preValidatedBusinessId: preValidatedBusinessId, // Store pre-validated business_id
      timestamp: Date.now()
    };
    localStorage.setItem('pendingAnalysisForm', JSON.stringify(formData));
    console.log('[UserAnalysisModal] 💾 Form data saved to localStorage before checkout');
    
    try {
      // FEATURE FLAG: Check if Polar payments are disabled (CLIENT-SIDE CHECK BEFORE API CALL)
      const paymentsDisabled = process.env.NEXT_PUBLIC_DISABLE_POLAR_PAYMENTS === 'true';
      
      if (paymentsDisabled) {
        console.log('🚫 Polar payments disabled - bypassing checkout entirely (no API call)');
        
        // NOTE: No need to call create-temp-account anymore
        // Pre-validation already created user_businesses record with user_id and business_id
        
        // Simulate payment success
        const mockCheckoutId = `disabled-payment-${Date.now()}`;
        setStoredCheckoutId(mockCheckoutId);
        setPaymentCompleted(true);
        
        toast.success("Payment bypassed. Click 'Start Analysis' to begin.");
        setIsProcessingPayment(false);
        return; // Exit early - never call the checkout API
      }

      // ONLY reach here if payments are ENABLED
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
      
      // NOTE: No need to call create-temp-account anymore
      // Pre-validation already created user_businesses record with user_id and business_id
      
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
          state: businessData.state,
          city: businessData.city,
          businessId: businessData.businessId || preValidatedBusinessId, // Pass pre-validated business_id
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
      {/* Only show loader AFTER payment (not during pre-validation) */}
      {(showLoader && !isPreValidating) && (
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
                <label className="block font-semibold mb-2 text-sm sm:text-base">Business Category</label>
                <select
                  className="w-full bg-white border border-gray-200 rounded-xl h-12 px-4 text-sm disabled:opacity-50 transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300"
                  style={{ fontSize: '0.875rem' }}
                  value={selectedCategory?.id || ""}
                  onChange={e => {
                    const cat = categories.find(c => c.id === e.target.value);
                    setSelectedCategory(cat || null);
                    setBusinessName("");
                    setListingType('public');
                    setState("");
                    setCity("");
                    setRevenue("");
                    setSde("");
                    setListingUrl("");
                    setListingText("");
                    setUrlError("");
                    setPaymentCompleted(false);
                    setStoredCheckoutId(null);
                  }}
                  required
                  disabled={isFetchingCategories || paymentCompleted || isPreValidated}
                >
                  <option value="" disabled>
                    {isFetchingCategories ? "Loading categories..." : "Select a category"}
                  </option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.display_name}</option>
                  ))}
                </select>
              </div>

              {/* Business Name */}
              <div>
                <label className="block font-semibold mb-2 text-sm sm:text-base">Business Name</label>
                <Input
                  type="text"
                  placeholder="Enter business name (optional)"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl h-12 px-4 text-sm transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300"
                  style={{ fontSize: '0.875rem' }}
                  disabled={!selectedCategory || paymentCompleted || isPreValidated}
                />
              </div>

              {/* State and City - 2 column grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-2 text-sm sm:text-base">State</label>
                  <select
                    className="w-full bg-white border border-gray-200 rounded-xl h-12 px-4 text-sm disabled:opacity-50 transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300"
                    style={{ fontSize: '0.875rem' }}
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    required
                    disabled={!selectedCategory || paymentCompleted || isPreValidated}
                  >
                    <option value="" disabled>Select a state</option>
                    {US_STATES.map((stateOption) => (
                      <option key={stateOption.value} value={stateOption.value}>
                        {stateOption.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-2 text-sm sm:text-base">City</label>
                  <Input
                    type="text"
                    placeholder="Enter city name"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="bg-white border border-gray-200 rounded-xl h-12 px-4 text-sm transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300"
                    style={{ fontSize: '0.875rem' }}
                    required
                    disabled={!selectedCategory || paymentCompleted || isPreValidated}
                  />
                </div>
              </div>

              {/* Revenue and SDE - 2 column grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Revenue - Option 4: Checkbox below input */}
                <div>
                  <label className="block font-semibold mb-2 text-sm sm:text-base">Annual Revenue ($)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm sm:text-base">$</span>
                    <Input
                      type="text"
                      placeholder="0"
                      value={revenue === 'N/A' ? '' : revenue}
                      onChange={(e) => {
                        if (revenue !== 'N/A') {
                          const formatted = formatCurrencyInput(e.target.value);
                          setRevenue(formatted);
                        }
                      }}
                      className="bg-white border border-gray-200 rounded-xl h-12 pl-8 pr-4 text-sm transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300"
                      style={{ fontSize: '0.875rem' }}
                      required
                      disabled={revenue === 'N/A' || !selectedCategory || paymentCompleted || isPreValidated}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox
                      id="revenue-na"
                      checked={revenue === 'N/A'}
                      onCheckedChange={(checked) => {
                        setRevenue(checked ? 'N/A' : '');
                      }}
                      disabled={!selectedCategory || paymentCompleted || isPreValidated}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="revenue-na" className="text-xs sm:text-sm text-gray-600 cursor-pointer">
                      N/A
                    </Label>
                  </div>
                </div>
                {/* SDE - Option 4: Checkbox below input */}
                <div>
                  <label className="block font-semibold mb-2 text-sm sm:text-base">SDE/Cash Flow ($)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm sm:text-base">$</span>
                    <Input
                      type="text"
                      placeholder="0"
                      value={sde === 'N/A' ? '' : sde}
                      onChange={(e) => {
                        if (sde !== 'N/A') {
                          const formatted = formatCurrencyInput(e.target.value);
                          setSde(formatted);
                        }
                      }}
                      className="bg-white border border-gray-200 rounded-xl h-12 pl-8 pr-4 text-sm transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300"
                      style={{ fontSize: '0.875rem' }}
                      required
                      disabled={sde === 'N/A' || !selectedCategory || paymentCompleted || isPreValidated}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox
                      id="sde-na"
                      checked={sde === 'N/A'}
                      onCheckedChange={(checked) => {
                        setSde(checked ? 'N/A' : '');
                      }}
                      disabled={!selectedCategory || paymentCompleted || isPreValidated}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="sde-na" className="text-xs sm:text-sm text-gray-600 cursor-pointer">
                      N/A
                    </Label>
                  </div>
                </div>
              </div>

              {/* Listing Type Radio Buttons */}
              <div>
                <label className="block font-semibold mb-2 text-sm sm:text-base">Listing Type</label>
                <RadioGroup
                  value={listingType}
                  onValueChange={(value) => {
                    setListingType(value as 'public' | 'private');
                    if (value === 'private') {
                      setListingUrl("");
                      setUrlError("");
                      setDuplicateError(null);
                    }
                  }}
                  disabled={!selectedCategory || !hasLocation || !hasRevenue || !hasSde || paymentCompleted || isPreValidated}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="public" id="public" />
                    <Label htmlFor="public" className="cursor-pointer text-xs sm:text-sm font-normal whitespace-nowrap">Public listing</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="private" id="private" />
                    <Label htmlFor="private" className="cursor-pointer text-xs sm:text-sm font-normal whitespace-nowrap">Off-market</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Listing URL Field - Conditional */}
              {listingType === 'public' && (
                <div>
                  <label className="block font-semibold mb-2 text-sm sm:text-base">Listing URL</label>
                  <Input
                    type="url"
                    placeholder="Paste business listing URL here..."
                    value={listingUrl}
                    onChange={handleUrlChange}
                    className={`bg-white border border-gray-200 rounded-xl h-12 px-4 text-sm transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300 ${urlError ? 'border-red-500 focus:border-red-500 focus-visible:ring-0' : ''}`}
                    style={{ fontSize: '0.875rem' }}
                    required
                    disabled={!canFillUrl || paymentCompleted || isPreValidated}
                  />
                  {urlError && <div className="text-red-500 text-sm mt-1">{urlError}</div>}
                  {duplicateError && <div className="text-red-500 text-sm mt-1">{duplicateError}</div>}
                </div>
              )}

              {/* Input Method Selection */}
              <div>
                <label className="block font-semibold mb-2 text-sm sm:text-base">Input Method</label>
                <RadioGroup
                  value={inputMethod}
                  onValueChange={(value) => handleInputMethodChange(value as 'text' | 'pdf')}
                  disabled={!canFillText || paymentCompleted || isPreValidated}
                  className="grid grid-cols-2 gap-4 mb-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="text" id="text" />
                    <Label htmlFor="text" className="cursor-pointer text-xs sm:text-sm font-normal">Paste Text</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pdf" id="pdf" />
                    <Label htmlFor="pdf" className="cursor-pointer text-xs sm:text-sm font-normal">Upload PDF</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Listing Text Field - Text Mode */}
              {inputMethod === 'text' && (
                <div>
                  <label className="block font-semibold mb-2 text-sm sm:text-base">Listing Text</label>
                  <textarea
                    placeholder="Paste the business listing text here (make sure you capture all listing data!)"
                    value={listingText}
                    onChange={handleTextChange}
                    onPaste={handleTextPaste}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none overflow-auto placeholder:text-muted-foreground transition-all duration-200 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none hover:border-gray-300"
                    style={{ minHeight: 90, maxHeight: 140, fontSize: '0.875rem' }}
                    required
                    disabled={!canFillText || paymentCompleted || isPreValidated}
                    maxLength={7500}
                  />
                  <div className="text-xs text-gray-500 mt-1">Plain text only. Max 7500 characters.</div>
                </div>
              )}

              {/* PDF Upload - PDF Mode */}
              {inputMethod === 'pdf' && (
                <div>
                  <label className="block font-semibold mb-2 text-sm sm:text-base">Upload PDF Listing</label>
                  
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={!canFillText || paymentCompleted || pdfExtracting || isPreValidated}
                  />

                  {/* Collapsed file info bar - shown after successful extraction */}
                  {listingText && !pdfExtracting && pdfFile ? (
                    <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="text-green-600 text-xl">✓</div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">{pdfFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!canFillText || paymentCompleted || isPreValidated}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Replace PDF
                      </button>
                    </div>
                  ) : (
                    /* Full drag-and-drop zone - shown when no file or extracting */
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => !pdfExtracting && fileInputRef.current?.click()}
                      className={`w-full border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                        pdfExtracting
                          ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                          : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                      } ${!canFillText || paymentCompleted || isPreValidated ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ minHeight: 140 }}
                    >
                      {pdfExtracting ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                          <p className="text-sm text-gray-600">Extracting text from PDF...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-4xl text-gray-400">📄</div>
                          <p className="text-sm font-medium text-gray-700">
                            Drop PDF here or click to browse
                          </p>
                          <p className="text-xs text-gray-500">Maximum file size: 10MB</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error message */}
                  {pdfError && (
                    <div className="text-red-500 text-sm mt-2">{pdfError}</div>
                  )}

                  {/* Extracted text preview (readonly) */}
                  {listingText && !pdfExtracting && (
                    <div className="mt-4">
                      <label className="block font-semibold mb-2 text-sm sm:text-base">
                        Extracted Text Preview
                      </label>
                      <textarea
                        value={listingText}
                        readOnly
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none overflow-auto transition-all duration-200 text-gray-500 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
                        style={{ minHeight: 90, maxHeight: 140, fontSize: '0.875rem' }}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {listingText.length} / 7500 characters
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Email Field (read-only) */}
              <div>
                <label className="block font-semibold mb-2 text-sm sm:text-base">Email</label>
                <Input
                  type="email"
                  value={userEmail}
                  className="bg-gray-50 border border-gray-200 rounded-xl h-12 px-4 text-sm"
                  style={{ fontSize: '0.875rem' }}
                  disabled
                />
              </div>

              {/* Payment Success Message */}
              {paymentCompleted && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-green-800 text-sm font-medium">
                    ✅ Payment successful! Click "Start Analysis" to begin the analysis.
                  </div>
                </div>
              )}

              {/* Pre-validation feedback */}
              {isPreValidating && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-2">
                  <div className="text-blue-800 text-sm font-medium">
                    🔄 Validating your data... This may take a few seconds.
                  </div>
                </div>
              )}

              {/* Pre-validation success message */}
              {preValidatedBusinessId && !paymentCompleted && !isPreValidating && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-2">
                  <div className="text-green-800 text-sm font-medium">
                    ✅ Data validated successfully! Click "Proceed to Checkout" to continue.
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full rounded-xl px-6 py-4 text-sm sm:text-base font-semibold"
                disabled={!canSubmit || analyzeLoading || isProcessingPayment || isPreValidating}
              >
                {isPreValidating ? "Validating..." :
                 analyzeLoading ? "Processing..." : 
                 isProcessingPayment ? "Opening Payment..." :
                 paymentCompleted ? "Start Analysis" :
                 preValidatedBusinessId ? "Proceed to Checkout" :
                 "Store Data"}
              </Button>
              
              {analyzeError && <div className="text-red-500 text-sm mt-2">{analyzeError}</div>}
              {preValidationError && <div className="text-red-500 text-sm mt-2">{preValidationError}</div>}
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
