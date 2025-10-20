'use client'

import { Suspense } from 'react'
import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { CheckCircle, Key, AlertCircle, Loader2, Mail, Eye, EyeOff } from 'lucide-react'
import BackgroundPaths from "@/components/kokonutui/background-paths"
import { useTheme } from "next-themes"

type ConfirmationState = 'loading' | 'password-setup' | 'auto-login' | 'success' | 'error'

interface UserMetadata {
  isAutoPassword?: boolean
  businessId?: string
  signupPath?: 'pdf-only' | 'full-access'
}

function isValidPassword(password: string): boolean {
  return password.length >= 6
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

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
function AuthConfirmLoading() {
  return (
    <>
      <header className="px-2 lg:px-6 h-16 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-bold hover:opacity-80 transition-opacity">
            <img src="/logo-v3.png" alt="Bizalyze" className="h-8 w-auto" />
          </a>
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
            <p className="text-muted-foreground">Please wait while we process your request...</p>
          </div>
        </div>
      </main>
    </>
  )
}

function AuthConfirmPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setTheme } = useTheme()
  
  const [state, setState] = useState<ConfirmationState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [userMetadata, setUserMetadata] = useState<UserMetadata | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  
  // Password setup form state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)
  
  // NEW: Add state for email form
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [isExistingUser, setIsExistingUser] = useState(false)

  const passwordStrength = getPasswordStrength(newPassword)
  const passwordValid = passwordStrength.score >= 4 // Require strong password
  const passwordsMatch = newPassword === confirmPassword
  const canSubmitPassword = passwordValid && passwordsMatch && newPassword.length > 0

  // Force light mode on auth confirm page
  useEffect(() => {
    setTheme("light")
  }, [setTheme])

  // Extract confirmation parameters from URL
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const redirectTo = searchParams.get('next') || '/dashboard'

  // Handle Supabase's URL format with access_token in hash
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    // Check for access_token in URL hash (Supabase format)
    const hash = window.location.hash
    const hashParams = new URLSearchParams(hash.substring(1))
    const token = hashParams.get('access_token')
    const tokenType = hashParams.get('type')
    
    // NEW: Check for error parameters in URL hash
    const errorParam = hashParams.get('error')
    const errorCode = hashParams.get('error_code')
    
    if (errorParam && errorCode === 'otp_expired') {
      console.log('Found expired link error in URL hash:', { errorParam, errorCode })
      setState('error')
      setError('This confirmation link has expired. Please enter your email to request a new one.')
      return
    }
    
    if (token && tokenType === 'signup') {
      setAccessToken(token)
      console.log('Found access_token in URL hash')
    }
  }, [])

  useEffect(() => {
    async function handleConfirmation() {
      try {
        console.log('Processing email confirmation:', { 
          tokenHash: !!tokenHash, 
          type, 
          hasAccessToken: !!accessToken 
        })

        // Handle both URL formats
        let confirmationData
        
        if (accessToken) {
          // Supabase format with access_token in hash
          console.log('Using access_token from URL hash')
          const { data, error } = await supabase.auth.getUser(accessToken)
          
          if (error) {
            console.error('Access token error:', error)
            throw new Error(error.message || 'Failed to verify access token. Please try again.')
          }
          
          if (!data.user) {
            throw new Error('No user data found. Please try signing up again.')
          }
          
          confirmationData = { data, error: null }
        } else if (tokenHash && type === 'signup') {
          // Traditional format with token_hash in query params
          console.log('Using token_hash from query params')
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'signup'
          })
          
          confirmationData = { data, error }
        } else {
          throw new Error('Invalid confirmation link. Please check your email and try again.')
        }

        if (confirmationData.error) {
          console.error('Confirmation error:', confirmationData.error)
          throw new Error(confirmationData.error.message || 'Failed to confirm email. Please try again.')
        }

        if (!confirmationData.data.user) {
          throw new Error('No user data found. Please try signing up again.')
        }

        console.log('Email confirmed successfully:', {
          userId: confirmationData.data.user.id,
          email: confirmationData.data.user.email,
          metadata: confirmationData.data.user.user_metadata
        })

        const metadata = confirmationData.data.user.user_metadata as UserMetadata
        setUserMetadata(metadata)
        setUserId(confirmationData.data.user.id)

        // Check if this is a PDF-only user (auto-generated password)
        if (metadata?.isAutoPassword === true) {
          console.log('Auto-password user detected, showing password setup')
          setState('password-setup')
        } else {
          console.log('Full-access user detected, proceeding to auto-login')
          setState('auto-login')
          // Auto-redirect after brief delay
          setTimeout(() => {
            const finalRedirect = 'user/dashboard'
            console.log('Redirecting to:', finalRedirect)
            router.push(finalRedirect)
            setState('success')
          }, 2000)
        }

      } catch (err) {
        console.error('Confirmation process failed:', err)
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
        setError(errorMessage)
        setState('error')
      }
    }

    // Only run if we have either tokenHash or accessToken
    if (tokenHash || accessToken) {
      handleConfirmation()
    }
  }, [tokenHash, type, redirectTo, router, accessToken])

  // Function to request new confirmation email for expired links
  const handleRequestNewConfirmation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !isValidEmail(email)) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Use Supabase directly to resend confirmation - NO business relationship needed
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`
        }
      })

      if (error) {
        // Handle specific error cases
        if (error.message.includes('already confirmed') || error.message.includes('already registered')) {
          setIsExistingUser(true)
          setSubmitError(null)
          return
        }
        throw new Error(error.message)
      }

      setSubmitSuccess(true)
    } catch (err) {
      console.error('Failed to resend confirmation:', err)
      setSubmitError(err instanceof Error ? err.message : 'Failed to send confirmation email')
    } finally {
      setIsSubmitting(false)
    }
  }

  // NEW: Function to redirect to landing page with auth modal
  const handleGoToLogin = () => {
    // Redirect to landing page where users can access the AuthModal
    router.push('/')
  }

  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmitPassword || !userId) return

    setIsUpdatingPassword(true)
    setError(null)

    try {
      console.log('Updating password for user:', userId)

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        throw new Error(updateError.message || 'Failed to update password')
      }

      console.log('Password updated successfully')

      // Update user metadata to remove the auto-password flag
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { 
          ...userMetadata,
          isAutoPassword: false,
          passwordSetAt: new Date().toISOString()
        }
      })

      if (metadataError) {
        console.warn('Failed to update metadata (non-critical):', metadataError)
      }

      // Redirect to dashboard
      setState('success')
      const finalRedirect = '/user/dashboard'
      
      console.log('Password setup complete, redirecting to:', finalRedirect)
      
      setTimeout(() => {
        router.push(finalRedirect)
      }, 1500)

    } catch (err) {
      console.error('Password update failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to set password'
      setError(errorMessage)
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
        {/* Add empty div to push logo to left and maintain justify-between spacing */}
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
                  Confirming Your Account
                </h2>
                <p className="text-muted-foreground">
                  Please wait while we set up your account...
                </p>
              </div>
            </div>
          </BackgroundPaths>
        </main>
      </>
    )
  }

  // Password setup state (for PDF-only users)
  if (state === 'password-setup') {
    return (
      <>
        <BrandedHeader />
        <main>
          <BackgroundPaths noCenter={true} title="" className="pt-0">
            <div className="min-h-screen flex items-center justify-center px-4">
              <div className="bg-card rounded-lg border border-border shadow-lg p-8 max-w-md w-full">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Key className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground mb-2">
                    Set Your Password
                  </h2>
                  <p className="text-muted-foreground">
                    Create a secure password to access your dashboard
                  </p>
                </div>

                <form onSubmit={handlePasswordSetup} className="space-y-4">
                  <div>
                    <input
                      type={showPasswords ? "text" : "password"}
                      placeholder="Create password (8+ characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                        newPassword && !passwordValid ? 'border-destructive' : ''
                      }`}
                      autoComplete="new-password"
                    />
                    {newPassword && !passwordValid && (
                      <div className="text-xs text-destructive mt-1">Password does not meet requirements</div>
                    )}
                    
                    {/* Password Strength Indicator */}
                    {newPassword && (
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
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                        confirmPassword && !passwordsMatch ? 'border-destructive' : ''
                      }`}
                      autoComplete="new-password"
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
                        Setting Password...
                      </>
                    ) : (
                      'Access Dashboard'
                    )}
                  </Button>

                  {error && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm text-center">
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

  // Auto-login state (for full-access users)
  if (state === 'auto-login') {
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
                  Welcome Back!
                </h2>
                <p className="text-muted-foreground mb-4">
                  Your account has been confirmed successfully.
                </p>
                <div className="flex items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Redirecting to your dashboard...
                </div>
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
                  All Set!
                </h2>
                <p className="text-muted-foreground mb-4">
                  {userMetadata?.isAutoPassword === false ? 
                    "Your password has been set and you now have full dashboard access." :
                    "Your account is confirmed and ready to use."
                  }
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

  // Error state - UPDATED with email form for expired links
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
                {error?.includes('expired') ? 'Link Expired' : 'Confirmation Failed'}
              </h2>
              <p className="text-muted-foreground mb-6">
                {error?.includes('expired') ? 
                  'This confirmation link has expired. Please enter your email to request a new one.' :
                  error || 'We were unable to confirm your account. Please try again.'
                }
              </p>
            
          {submitSuccess ? (
            <div className="space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <p className="text-primary">
                New confirmation email sent! Check your inbox.
              </p>
              <Button onClick={() => router.push('/')} className="w-full bg-primary hover:bg-primary/90">
                Go Home
              </Button>
            </div>
          ) : isExistingUser ? (
            <div className="space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <p className="text-foreground">
                Your account is already confirmed! Please log in to access your dashboard.
              </p>
              <Button onClick={handleGoToLogin} className="w-full bg-primary hover:bg-primary/90">
                Go to Login
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/')}
                className="w-full"
              >
                Go Home
              </Button>
            </div>
          ) : error?.includes('expired') ? (
            <form onSubmit={handleRequestNewConfirmation} className="space-y-4">
              <input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                  email && !isValidEmail(email) ? 'border-destructive' : ''
                }`}
                autoComplete="email"
                disabled={isSubmitting}
              />
              {email && !isValidEmail(email) && (
                <div className="text-xs text-destructive">Please enter a valid email address</div>
              )}
              
              {submitError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                  {submitError}
                </div>
              )}
              
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!email || !isValidEmail(email) || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send New Confirmation Email'
                )}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/')}
                className="w-full"
                disabled={isSubmitting}
              >
                Go Home
              </Button>
            </form>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.push('/')}
                className="flex-1"
              >
                Go Home
              </Button>
              <Button
                onClick={() => window.location.reload()}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Try Again
              </Button>
            </div>
          )}
            </div>
          </div>
        </BackgroundPaths>
      </main>
    </>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<AuthConfirmLoading />}>
      <AuthConfirmPageContent />
    </Suspense>
  )
}
