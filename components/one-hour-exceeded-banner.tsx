"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface OneHourExceededBannerProps {
  email: string // Keep for internal validation, but don't display
  onResendVerification: (email: string) => Promise<void>
  onSignIn?: () => void
}

export const OneHourExceededBanner: React.FC<OneHourExceededBannerProps> = ({
  email,
  onResendVerification,
  onSignIn
}) => {
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [showEmailInput, setShowEmailInput] = useState(false)
  
  // Login form state
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [loginEmail, setLoginEmail] = useState(email)
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  
  // Email sent state to disable resend form
  const [emailSent, setEmailSent] = useState(false)

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleResendVerification = async () => {
    if (!emailInput || !isValidEmail(emailInput)) {
      setResendError('Please enter a valid email address')
      return
    }

    setIsResending(true)
    setResendSuccess(false)
    setResendError(null)
    
    try {
      await onResendVerification(emailInput)
      setResendSuccess(true)
      setEmailSent(true)
      
      // Hide success message after 5 seconds
      setTimeout(() => setResendSuccess(false), 5000)
    } catch (error) {
      console.error('Failed to resend verification:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to send email. Please try again.'
      setResendError(errorMessage)
      
      // Hide error message after 8 seconds (longer for more complex messages)
      setTimeout(() => setResendError(null), 8000)
    } finally {
      setIsResending(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)
    setLoginError(null)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password
      })
      
      if (error) {
        setLoginError(error.message)
      }
      // If successful, existing auth listener will handle the rest
    } catch (err) {
      setLoginError('Login failed. Please try again.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-red-600" />
        </div>
        
        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Verify Email to Continue
        </h2>
        
        {/* Description */}
        <p className="text-gray-600 mb-6">
          Your 1-hour access period has expired
        </p>
        
        {/* Email info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 mb-2">
            We sent a verification email to the address provided during checkout.
          </p>
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
                  onClick={handleResendVerification}
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
        
        {/* Help text */}
        <div className="text-xs text-gray-500 mb-6 space-y-1">
          <p>Didn't receive it?</p>
          <p>• Check spam folder</p>
          <p>• Verification link expires in 24h</p>
        </div>
        
        {!showLoginForm ? (
          <>
            {/* Divider */}
            <div className="border-t border-gray-200 mb-6"></div>
            
            {/* Sign in option */}
            <div className="text-sm text-gray-600 mb-4">
              Already verified?
            </div>
            
            <Button
              variant="outline"
              onClick={() => setShowLoginForm(true)}
              className="w-full"
            >
              <Lock className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </>
        ) : (
          // Inline login form
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="border-t border-gray-200 mb-6"></div>
            
            <div className="text-sm text-gray-600 mb-4">
              Sign in to continue
            </div>
            
            <input 
              type="email" 
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoComplete="email"
            />
            
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoComplete="current-password"
            />
            
            {loginError && (
              <div className="text-red-600 text-sm text-center">
                {loginError}
              </div>
            )}
            
            <Button 
              type="submit" 
              disabled={isLoggingIn || !loginEmail || !password} 
              className="w-full"
            >
              {isLoggingIn ? 'Signing in...' : 'Sign In'}
            </Button>
            
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => {
                setShowLoginForm(false)
                setLoginError(null)
                setPassword('')
              }}
              className="w-full"
            >
              Back
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}