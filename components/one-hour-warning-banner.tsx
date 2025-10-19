"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, Mail, Clock } from 'lucide-react'

interface OneHourWarningBannerProps {
  secondsRemaining: number
  email: string // Keep for internal validation, but don't display
  onGraceExpired: () => void
  onDismiss?: () => void
}

export const OneHourWarningBanner: React.FC<OneHourWarningBannerProps> = ({
  secondsRemaining,
  email,
  onGraceExpired,
  onDismiss
}) => {
  const [timeLeft, setTimeLeft] = useState(secondsRemaining)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [showEmailInput, setShowEmailInput] = useState(false)
  
  // Email sent state to disable resend form
  const [emailSent, setEmailSent] = useState(false)

  // Countdown timer - use server-calculated time as starting point
  useEffect(() => {
    if (timeLeft <= 0) {
      onGraceExpired()
      return
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setTimeout(() => onGraceExpired(), 0)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, onGraceExpired])

  // Update timer when server value changes (e.g., on page refresh)
  useEffect(() => {
    setTimeLeft(secondsRemaining)
  }, [secondsRemaining])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleResendEmail = async () => {
    if (!emailInput || !isValidEmail(emailInput)) {
      setResendError('Please enter a valid email address')
      return
    }

    setIsResending(true)
    setResendSuccess(false)
    setResendError(null)
    
    try {
      const response = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput })
      })

      if (response.ok) {
        setResendSuccess(true)
        setEmailSent(true)
        
        // Hide success message after 5 seconds
        setTimeout(() => setResendSuccess(false), 5000)
        console.log('Verification email resent successfully')
      } else {
        const errorData = await response.json()
        setResendError(errorData.error || 'Failed to resend verification email')
        
        // Hide error message after 8 seconds (longer for more complex messages)
        setTimeout(() => setResendError(null), 8000)
      }
    } catch (error) {
      console.error('Error resending verification email:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to send email. Please try again.'
      setResendError(errorMessage)
      
      // Hide error message after 8 seconds (longer for more complex messages)
      setTimeout(() => setResendError(null), 8000)
    } finally {
      setIsResending(false)
    }
  }

  if (isDismissed) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 max-w-md w-full text-center relative">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-yellow-600" />
        </div>
        
        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Access Expires in {formatTime(timeLeft)}
        </h2>
        
        {/* Description */}
        <p className="text-gray-600 mb-6">
          Verify your email to retain permanent access. We sent a verification email to the address provided during checkout.
        </p>
        
        {/* Email info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 mb-2">
            Didn't receive it?
          </p>
          <div className="text-xs text-gray-600 space-y-1">
            <p>• Check spam folder</p>
            <p>• Verification link expires in 24h</p>
          </div>
        </div>
        
        {/* Email input and resend button */}
        <div className="space-y-4 mb-6">
          {!showEmailInput ? (
            <Button
              onClick={() => setShowEmailInput(true)}
              disabled={emailSent}
              className="w-full"
            >
              <Mail className="w-4 h-4 mr-2" />
              {emailSent ? 'Email Sent' : 'Resend Verification Email'}
            </Button>
          ) : (
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Enter your email address"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={emailSent}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                autoComplete="email"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleResendEmail}
                  disabled={isResending || !emailInput || !isValidEmail(emailInput) || emailSent}
                  className="flex-1"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {isResending ? 'Sending...' : 'Send Email'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEmailInput(false)
                    setEmailInput('')
                    setResendError(null)
                  }}
                  disabled={emailSent}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Success message */}
        {resendSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
            ✅ Verification email sent! Check your inbox.
          </div>
        )}
        
        {/* Error message with support email */}
        {resendError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {resendError}
            {resendError.includes('No account found') && (
              <div className="mt-2">
                <p className="text-sm">
                  If you accidentally misspelled your email during checkout, please contact us at{' '}
                  <a 
                    href="mailto:contact@bizalyze.app?subject=Wrong Email During Checkout&body=Hi, I used the wrong email address during checkout. My payment details are: [Please include your checkout ID or payment reference]"
                    className="text-red-600 hover:text-red-800 underline"
                  >
                    contact@bizalyze.app
                  </a>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

