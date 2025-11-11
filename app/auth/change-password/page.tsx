'use client'

import { Suspense } from 'react'
import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Lock, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'
import BackgroundPaths from "@/components/kokonutui/background-paths"
import { useTheme } from "next-themes"

type ChangePasswordState = 'loading' | 'ready' | 'success' | 'error'

// Advanced password strength checker
function getPasswordStrength(password: string) {
  let score = 0
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  }
  
  score = Object.values(checks).filter(Boolean).length
  
  return {
    score,
    checks,
    strength: score < 2 ? 'weak' : score < 4 ? 'medium' : 'strong',
    color: score < 2 ? 'bg-red-500' : score < 4 ? 'bg-yellow-500' : 'bg-green-500'
  }
}

// Loading fallback component
function ChangePasswordLoading() {
  return (
    <>
      <header className="px-2 lg:px-6 h-16 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold hover:opacity-80 transition-opacity">
            <img src="/logo-v3.png" alt="Bizalyze" className="h-8 w-auto" />
          </Link>
          <div></div>
        </div>
      </header>
      <main>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="bg-card rounded-lg border border-border shadow-lg p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Loading...</h2>
            <p className="text-muted-foreground">Please wait while we verify your reset link...</p>
          </div>
        </div>
      </main>
    </>
  )
}

function ChangePasswordPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setTheme } = useTheme()
  
  const [state, setState] = useState<ChangePasswordState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [isRecoverySession, setIsRecoverySession] = useState(false)
  
  // Password form state
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)

  const passwordStrength = getPasswordStrength(password)
  const passwordValid = passwordStrength.score >= 4 // Require strong password
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0
  const canSubmitPassword = passwordValid && passwordsMatch && password.length > 0

  // Force light mode on change password page
  useEffect(() => {
    setTheme("light")
  }, [setTheme])

  // Get redirect URL: URL param > localStorage > default
  const getRedirectUrl = (): string => {
    // 1. Check URL parameter first
    const redirectParam = searchParams.get('redirect') || searchParams.get('next')
    if (redirectParam) {
      return redirectParam
    }
    
    // 2. Check localStorage for last visited page
    if (typeof window !== 'undefined') {
      try {
        const lastPage = localStorage.getItem('lastVisitedPage')
        if (lastPage && lastPage.startsWith('/')) {
          return lastPage
        }
      } catch (e) {
        console.warn('Failed to access localStorage:', e)
      }
    }
    
    // 3. Default to user dashboard
    return '/user/dashboard'
  }

  // Handle recovery token from URL (supports both query params and hash fragments)
  useEffect(() => {
    async function handleRecoveryToken() {
      try {
        // Check query params first (Supabase standard format: ?token_hash=...&type=recovery)
        const queryParams = new URLSearchParams(window.location.search)
        const tokenHash = queryParams.get('token_hash')
        const queryType = queryParams.get('type')
        
        // Also check URL hash (alternative format: #access_token=...&type=recovery)
        const hash = window.location.hash
        const hashParams = new URLSearchParams(hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const hashType = hashParams.get('type')
        const errorParam = hashParams.get('error') || queryParams.get('error')
        const errorCode = hashParams.get('error_code') || queryParams.get('error_code')
        
        console.log('Password reset page loaded:', { 
          hasTokenHash: !!tokenHash,
          hasAccessToken: !!accessToken, 
          queryType,
          hashType,
          hasError: !!errorParam,
          errorCode 
        })
        
        // Check for errors
        if (errorParam) {
          if (errorCode === 'token_expired' || errorCode === 'otp_expired') {
            setError('This password reset link has expired. Please request a new one.')
            setState('error')
            return
          }
          setError(errorParam || 'Invalid reset link')
          setState('error')
          return
        }
        
        // Handle query params format (?token_hash=...&type=recovery)
        if (tokenHash && queryType === 'recovery') {
          console.log('Recovery token_hash found in query params, verifying...')
          
          // Verify OTP using token_hash
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery'
          })
          
          if (error) {
            console.error('Recovery token verification failed:', error)
            setError(error.message || 'Invalid or expired reset link. Please request a new one.')
            setState('error')
            return
          }
          
          if (!data.user) {
            setError('No user found. Please request a new password reset link.')
            setState('error')
            return
          }
          
          console.log('Recovery token verified for user:', data.user.email)
          
          // Check if we're in a recovery session
          const { data: { session } } = await supabase.auth.getSession()
          
          if (session) {
            console.log('Recovery session confirmed')
            setIsRecoverySession(true)
            setState('ready')
          } else {
            setError('Session not found. Please click the reset link from your email again.')
            setState('error')
          }
        }
        // Handle hash fragment format (#access_token=...&type=recovery)
        else if (accessToken && hashType === 'recovery') {
          console.log('Recovery access_token found in URL hash, verifying...')
          
          // Verify the token and get user
          const { data, error } = await supabase.auth.getUser(accessToken)
          
          if (error) {
            console.error('Recovery token verification failed:', error)
            setError(error.message || 'Invalid or expired reset link. Please request a new one.')
            setState('error')
            return
          }
          
          if (!data.user) {
            setError('No user found. Please request a new password reset link.')
            setState('error')
            return
          }
          
          console.log('Recovery token verified for user:', data.user.email)
          
          // Check if we're in a recovery session
          const { data: { session } } = await supabase.auth.getSession()
          
          if (session) {
            console.log('Recovery session confirmed')
            setIsRecoverySession(true)
            setState('ready')
          } else {
            setError('Session not found. Please click the reset link from your email again.')
            setState('error')
          }
        } else if ((queryType || hashType) && queryType !== 'recovery' && hashType !== 'recovery') {
          // Wrong token type
          setError('This link is not for password reset. Please check your email for the correct link.')
          setState('error')
        } else {
          // No recovery token - check if user is already in a recovery session
          const { data: { session } } = await supabase.auth.getSession()
          
          if (session) {
            // Check if we might be in recovery mode
            console.log('Checking existing session for recovery mode...')
            setIsRecoverySession(true)
            setState('ready')
          } else {
            setError('No password reset link found. Please request a new password reset email.')
            setState('error')
          }
        }
      } catch (err) {
        console.error('Recovery token handling failed:', err)
        setError(err instanceof Error ? err.message : 'Failed to process reset link')
        setState('error')
      }
    }

    handleRecoveryToken()
  }, [])

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmitPassword || !isRecoverySession) return

    setIsUpdatingPassword(true)
    setError(null)

    try {
      console.log('Updating password in recovery session...')

      // Update the user's password (only works in recovery session)
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) {
        // Check if error is because we're not in recovery session
        if (updateError.message.includes('recovery') || updateError.message.includes('session')) {
          throw new Error('This reset link is no longer valid. Please request a new password reset email.')
        }
        throw new Error(updateError.message || 'Failed to update password')
      }

      console.log('Password updated successfully')

      // Clear any stored redirect URLs
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('lastVisitedPage')
        } catch (e) {
          console.warn('Failed to clear localStorage:', e)
        }
      }

      // Show success and redirect
      setState('success')
      const redirectUrl = getRedirectUrl()
      
      console.log('Password update complete, redirecting to:', redirectUrl)
      
      setTimeout(() => {
        router.push(redirectUrl)
      }, 1500)

    } catch (err) {
      console.error('Password update failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to set password')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  // Branded header component
  const BrandedHeader = () => (
    <header className="px-2 lg:px-6 h-16 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold hover:opacity-80 transition-opacity">
          <img src="/logo-v3.png" alt="Bizalyze" className="h-8 w-auto" />
        </Link>
        <div></div>
      </div>
    </header>
  )

  // Loading state
  if (state === 'loading') {
    return (
      <>
        <BrandedHeader />
        <main>
          <BackgroundPaths noCenter={true} title="" className="pt-0">
            <div className="min-h-screen flex items-center justify-center px-4">
              <div className="bg-card rounded-lg border border-border shadow-lg p-8 max-w-md w-full text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Verifying Reset Link
                </h2>
                <p className="text-muted-foreground">
                  Please wait while we verify your password reset link...
                </p>
              </div>
            </div>
          </BackgroundPaths>
        </main>
      </>
    )
  }

  // Success state
  if (state === 'success') {
    return (
      <>
        <BrandedHeader />
        <main>
          <BackgroundPaths noCenter={true} title="" className="pt-0">
            <div className="min-h-screen flex items-center justify-center px-4">
              <div className="bg-card rounded-lg border border-border shadow-lg p-8 max-w-md w-full text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Password Updated!
                </h2>
                <p className="text-muted-foreground mb-4">
                  Your password has been successfully updated.
                </p>
                <div className="flex items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Redirecting...
                </div>
              </div>
            </div>
          </BackgroundPaths>
        </main>
      </>
    )
  }

  // Error state
  if (state === 'error') {
    return (
      <>
        <BrandedHeader />
        <main>
          <BackgroundPaths noCenter={true} title="" className="pt-0">
            <div className="min-h-screen flex items-center justify-center px-4">
              <div className="bg-card rounded-lg border border-border shadow-lg p-8 max-w-md w-full text-center">
                <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Reset Link Invalid
                </h2>
                <p className="text-muted-foreground mb-6">
                  {error || 'This password reset link is invalid or has expired. Please request a new one.'}
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => router.push('/auth/reset-password')}
                    className="flex-1"
                  >
                    Request New Link
                  </Button>
                  <Button
                    onClick={() => router.push('/')}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    Go Home
                  </Button>
                </div>
              </div>
            </div>
          </BackgroundPaths>
        </main>
      </>
    )
  }

  // Ready state - show password form
  return (
    <>
      <BrandedHeader />
      <main>
        <BackgroundPaths noCenter={true} title="" className="pt-0">
          <div className="min-h-screen flex items-center justify-center px-4">
            <div className="bg-card rounded-lg border border-border shadow-lg p-8 max-w-md w-full">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Set New Password
                </h2>
                <p className="text-muted-foreground">
                  Enter your new password below
                </p>
              </div>

              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div>
                  <input
                    type={showPasswords ? "text" : "password"}
                    placeholder="New password (8+ characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                      password && !passwordValid ? 'border-destructive' : ''
                    }`}
                    autoComplete="new-password"
                    required
                  />
                  {password && !passwordValid && (
                    <div className="text-xs text-destructive mt-1">Password does not meet requirements</div>
                  )}
                  
                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                            style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground capitalize">
                          {passwordStrength.strength}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <input
                    type={showPasswords ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                      confirmPassword && !passwordsMatch ? 'border-destructive' : ''
                    }`}
                    autoComplete="new-password"
                    required
                  />
                  {confirmPassword && !passwordsMatch && (
                    <div className="text-xs text-destructive mt-1">Passwords do not match</div>
                  )}
                </div>

                {/* Password Requirements */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-foreground mb-3">Password Requirements</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${passwordStrength.checks.length ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className={passwordStrength.checks.length ? 'text-green-700' : 'text-muted-foreground'}>
                        8+ characters
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${passwordStrength.checks.uppercase ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className={passwordStrength.checks.uppercase ? 'text-green-700' : 'text-muted-foreground'}>
                        Uppercase letter
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${passwordStrength.checks.number ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className={passwordStrength.checks.number ? 'text-green-700' : 'text-muted-foreground'}>
                        Number
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${passwordStrength.checks.symbol ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className={passwordStrength.checks.symbol ? 'text-green-700' : 'text-muted-foreground'}>
                        Symbol
                      </span>
                    </div>
                  </div>
                </div>

                {/* Show/Hide Passwords Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showPasswords ? "Hide" : "Show"} Passwords
                  </button>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={!canSubmitPassword || isUpdatingPassword}
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </Button>

                {error && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm text-center">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    {error}
                  </div>
                )}
              </form>
            </div>
          </div>
        </BackgroundPaths>
      </main>
    </>
  )
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<ChangePasswordLoading />}>
      <ChangePasswordPageContent />
    </Suspense>
  )
}
