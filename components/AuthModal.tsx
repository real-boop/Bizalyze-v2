import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'

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

const AuthModal: React.FC<AuthModalProps> = ({ open, onOpenChange, onSignIn, defaultEmail }) => {
  const [email, setEmail] = useState(defaultEmail || '')
  const [password, setPassword] = useState('')
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
  const isFormValid = emailValid && password.length >= 6

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
    setError(null)
    setSuccessMessage(null)
    setIsSignUp(false)
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
              <input
                type="password"
                placeholder="Password"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                disabled={isLoading}
              />
              {password && password.length < 6 && (
                <div className="text-xs text-red-500 mt-1">Password must be at least 6 characters.</div>
              )}
            </div>

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
