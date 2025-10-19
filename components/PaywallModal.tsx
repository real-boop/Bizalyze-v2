"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Lock, CreditCard, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface PaywallModalProps {
  businessId: string
  businessInfo: { name?: string; listing_url?: string } | null
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  businessId,
  businessInfo
}) => {
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  
  // Enhanced error handling states
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  const handleSignIn = () => {
    setShowLoginForm(true)
  }

  const handlePurchase = () => {
    // Redirect to start page to purchase
    window.location.href = '/start'
  }

  // Email validation helper (from State 3 banner)
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  // Simple resend verification - uses email from login form
  const handleResendVerification = async () => {
    if (!loginEmail || !isValidEmail(loginEmail)) {
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
        body: JSON.stringify({ email: loginEmail })
      })

      if (response.ok) {
        setResendSuccess(true)
        setEmailSent(true)
        
        // Keep success message visible (no timeout)
        console.log('Verification email resent successfully')
      } else {
        const errorData = await response.json()
        setResendError(errorData.error || 'Failed to resend verification email')
        
        // Hide error message after 8 seconds
        setTimeout(() => setResendError(null), 8000)
      }
    } catch (error) {
      console.error('Error resending verification email:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to send email. Please try again.'
      setResendError(errorMessage)
      
      // Hide error message after 8 seconds
      setTimeout(() => setResendError(null), 8000)
    } finally {
      setIsResending(false)
    }
  }

  // Simple forgot password - uses email from login form
  const handleForgotPassword = async () => {
    if (!loginEmail || !isValidEmail(loginEmail)) {
      setResendError('Please enter a valid email address')
      return
    }

    setIsResending(true)
    setResendSuccess(false)
    setResendError(null)
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
        redirectTo: `${window.location.origin}/auth/change-password`
      })

      if (error) {
        setResendError(error.message)
        // Hide error message after 8 seconds
        setTimeout(() => setResendError(null), 8000)
      } else {
        setResendSuccess(true)
        setEmailSent(true)
        // Keep success message visible (no timeout)
        console.log('Password reset email sent successfully')
      }
    } catch (error) {
      console.error('Error sending password reset email:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to send reset email. Please try again.'
      setResendError(errorMessage)
      
      // Hide error message after 8 seconds
      setTimeout(() => setResendError(null), 8000)
    } finally {
      setIsResending(false)
    }
  }

  // Enhanced login handler with better error detection
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)
    setLoginError(null)
    setResendError(null)
    setResendSuccess(false)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password
      })
      
      if (error) {
        // Enhanced error handling - provide more specific messages
        if (error.message.includes('Invalid login credentials')) {
          setLoginError('Invalid email or password. Please check your credentials.')
        } else if (error.message.includes('Email not confirmed')) {
          setLoginError('Please verify your email address before signing in.')
        } else {
          setLoginError(error.message)
        }
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
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-blue-600" />
        </div>
        
        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Access This Analysis
        </h2>
        
        {!showLoginForm ? (
          <>
            {/* Purchase Section */}
            <div className="text-sm text-gray-600 mb-4">
              New to this analysis?
            </div>
            
            <Button
              onClick={handlePurchase}
              className="w-full mb-4"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Purchase Access ($29)
            </Button>
            
            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-4 text-sm text-gray-500">OR</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>
            
            {/* Sign In Button */}
            <div className="text-sm text-gray-600 mb-4">
              Already purchased this analysis?
            </div>
            
            <Button
              onClick={handleSignIn}
              variant="outline"
              className="w-full"
            >
              <Lock className="w-4 h-4 mr-2" />
              Sign In to Access
            </Button>
          </>
        ) : (
          // Enhanced login form with smart error handling
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
            
            {/* Enhanced error messages */}
            {loginError && (
              <div className="text-red-600 text-sm text-center">
                {loginError}
              </div>
            )}
            
            {/* Success message for resend */}
            {resendSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
                ✅ Email sent, please check your inbox.
              </div>
            )}
            
            {/* Error message for resend */}
            {resendError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
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
            
            <Button 
              type="submit" 
              disabled={isLoggingIn || !loginEmail || !password || emailSent} 
              className="w-full"
            >
              {isLoggingIn ? 'Signing in...' : 'Sign In'}
            </Button>
            
            {/* Show both options when there's a login error */}
            {loginError && (
              <div className="flex justify-center gap-4 text-sm">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isResending || emailSent}
                  className="text-blue-600 hover:text-blue-800 underline disabled:text-gray-400"
                >
                  Resend Verification Email
                </button>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResending || emailSent}
                  className="text-blue-600 hover:text-blue-800 underline disabled:text-gray-400"
                >
                  Forgot Password?
                </button>
              </div>
            )}
            
            
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => {
                setShowLoginForm(false)
                setLoginError(null)
                setPassword('')
                setResendError(null)
                setResendSuccess(false)
                setEmailSent(false)
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
