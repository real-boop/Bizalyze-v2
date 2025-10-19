import React, { useState } from "react"
import { X, AlertTriangle, Lock, CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ isOpen, onClose, user }) => {
  const [stage, setStage] = useState(1) // 1: Initial warning, 2: Final confirmation
  const [password, setPassword] = useState("")
  const [confirmText, setConfirmText] = useState("")
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})

  const handleClose = () => {
    setStage(1)
    setPassword("")
    setConfirmText("")
    setIsConfirmed(false)
    setErrors({})
    onClose()
  }

  const handleContinueToDelete = () => {
    setStage(2)
  }

  const validateFinalForm = () => {
    const newErrors: {[key: string]: string} = {}

    if (!password) {
      newErrors.password = "Password is required"
    }

    if (confirmText !== "DELETE MY ACCOUNT") {
      newErrors.confirmText = "Please type exactly: DELETE MY ACCOUNT"
    }

    if (!isConfirmed) {
      newErrors.confirmed = "You must confirm that you understand this action is permanent"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleDeleteAccount = async () => {
    if (!validateFinalForm()) {
      return
    }

    setIsDeleting(true)
    setErrors({})

    try {
      // First verify password
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password
      })

      if (verifyError) {
        setErrors({ password: "Password is incorrect" })
        return
      }

      // If verification successful, call delete account API
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          password: password
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete account')
      }

      toast.success("Account deleted successfully")
      
      // Sign out and redirect to home
      await supabase.auth.signOut()
      window.location.href = '/'
      
    } catch (error) {
      console.error('Delete account error:', error)
      toast.error(error instanceof Error ? error.message : "Failed to delete account")
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-red-900">
            {stage === 1 ? "Delete Account" : "Final Confirmation Required"}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {stage === 1 ? (
            /* Stage 1: Initial Warning */
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-900">Are you sure?</h3>
                  <p className="text-sm text-red-600">This action cannot be undone</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-red-800 mb-2">What will be deleted:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• All saved searches will be deleted</li>
                  <li>• All analysis history will be lost</li>
                  <li>• Cannot be undone</li>
                  <li>• Data will be removed immediately</li>
                </ul>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleContinueToDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Continue to Delete
                </button>
              </div>
            </div>
          ) : (
            /* Stage 2: Final Confirmation */
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-900">Final Confirmation Required</h3>
                  <p className="text-sm text-red-600">This is your last chance to cancel</p>
                </div>
              </div>

              {/* Password Verification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter your password to confirm
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your password"
                />
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                )}
              </div>

              {/* Text Confirmation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="font-mono bg-gray-100 px-1 rounded">DELETE MY ACCOUNT</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                    errors.confirmText ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="DELETE MY ACCOUNT"
                />
                {errors.confirmText && (
                  <p className="text-red-500 text-xs mt-1">{errors.confirmText}</p>
                )}
              </div>

              {/* Checkbox Confirmation */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="confirm-delete"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className={`mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 ${
                    errors.confirmed ? 'border-red-300' : ''
                  }`}
                />
                <label htmlFor="confirm-delete" className="text-sm text-gray-700">
                  I understand that this action is permanent and cannot be undone. All my data will be deleted immediately.
                </label>
              </div>
              {errors.confirmed && (
                <p className="text-red-500 text-xs">{errors.confirmed}</p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => setStage(1)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Back
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || !password || confirmText !== "DELETE MY ACCOUNT" || !isConfirmed}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2 inline-block"></span>
                      Deleting...
                    </>
                  ) : (
                    "Permanently Delete Account"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DeleteAccountModal
