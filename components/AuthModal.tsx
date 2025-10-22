import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSignIn: () => void
  defaultEmail?: string
}

function isValidEmail(email: string) {
  // Simple check: at least one char before and after @, and at least one dot after @
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

// Password strength checker (same as other components)
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

const AuthModal: React.FC<AuthModalProps> = ({ open, onOpenChange, onSignIn, defaultEmail }) => {
  const [email, setEmail] = useState(defaultEmail || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  const router = useRouter()
  
  // Update email when defaultEmail changes
  useEffect(() => {
    if (defaultEmail) {
      setEmail(defaultEmail)
    }
  }, [defaultEmail])
  
  const emailValid = isValidEmail(email)
  const passwordStrength = getPasswordStrength(password)
  const passwordValid = passwordStrength.score >= 4
  const passwordsMatch = password === confirmPassword
  
  // Update form validation logic
  const isFormValid = isSignUp 
    ? emailValid && passwordValid && passwordsMatch && password.length > 0
    : emailValid && password.length >= 6

  const handleSignIn = async () => {
    if (!isFormValid) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        setError(error.message)
      } else {
        // Successfully signed in
        onOpenChange(false)
        onSignIn()
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async () => {
    if (!isFormValid) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`
        }
      })
      
      if (error) {
        setError(error.message)
      } else {
        // Successfully signed up
        setSuccessMessage('Check your email for a confirmation link to complete your registration.')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setIsSignUp(false)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSignUp) {
      handleSignUp()
    } else {
      handleSignIn()
    }
  }

  const resetForm = () => {
    setEmail(defaultEmail || '')
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setSuccessMessage(null)
    setIsSignUp(false)
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        resetForm()
      }
      onOpenChange(newOpen)
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isSignUp ? 'Create Account' : 'Sign In'}</DialogTitle>
          <DialogDescription>
            {isSignUp 
              ? 'Create your account to access your dashboard and reports.'
              : 'Sign in to access your dashboard and reports.'
            }
          </DialogDescription>
        </DialogHeader>
        
        {successMessage ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-green-700 mb-4">{successMessage}</p>
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <input
                type="email"
                placeholder="Email"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  email && !emailValid ? 'border-red-500' : ''
                }`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isLoading}
              />
              {email && !emailValid && (
                <div className="text-xs text-red-500 mt-1">Please enter a valid email address.</div>
              )}
            </div>
            
            <div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isSignUp && password && !passwordValid ? 'border-red-500' : ''
                  }`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              
              {password && isSignUp && !passwordValid && (
                <div className="text-xs text-red-500 mt-1">Password does not meet requirements</div>
              )}
              {password && !isSignUp && password.length < 6 && (
                <div className="text-xs text-red-500 mt-1">Password must be at least 6 characters.</div>
              )}
            </div>

            {/* Confirm password field (only for signup) */}
            {isSignUp && (
              <div>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      confirmPassword && !passwordsMatch ? 'border-red-500' : ''
                    }`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {confirmPassword && !passwordsMatch && (
                  <div className="text-xs text-red-500 mt-1">Passwords do not match</div>
                )}
              </div>
            )}

            {/* Password requirements (only for signup) */}
            {isSignUp && password && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Password Requirements</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${passwordStrength.checks.length ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className={passwordStrength.checks.length ? 'text-green-700' : 'text-gray-500'}>
                      8+ characters
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${passwordStrength.checks.uppercase ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className={passwordStrength.checks.uppercase ? 'text-green-700' : 'text-gray-500'}>
                      Uppercase letter
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${passwordStrength.checks.number ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className={passwordStrength.checks.number ? 'text-green-700' : 'text-gray-500'}>
                      Number
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${passwordStrength.checks.symbol ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className={passwordStrength.checks.symbol ? 'text-green-700' : 'text-gray-500'}>
                      Symbol
                    </span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={!isFormValid || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isSignUp ? 'Creating Account...' : 'Signing In...'}
                  </>
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </Button>
            </div>

            <div className="text-center space-y-2">
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800"
                onClick={() => setIsSignUp(!isSignUp)}
                disabled={isLoading}
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
              
              {!isSignUp && (
                <div>
                  <button
                    type="button"
                    className="text-sm text-gray-600 hover:text-gray-800"
                    onClick={() => {
                      // Close modal and redirect to password reset page
                      onOpenChange(false)
                      window.location.href = '/auth/reset-password'
                    }}
                    disabled={isLoading}
                  >
                    Forgot your password?
                  </button>
                </div>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AuthModal
