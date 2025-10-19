import React, { useState } from "react"
import { X, Mail, AlertCircle, Lock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface ChangeEmailModalProps {
  isOpen: boolean
  onClose: () => void
  currentEmail: string
}

const ChangeEmailModal: React.FC<ChangeEmailModalProps> = ({ isOpen, onClose, currentEmail }) => {
  const [newEmail, setNewEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error("Please enter a valid email address")
      return
    }

    if (!password) {
      toast.error("Please enter your current password")
      return
    }

    if (newEmail === currentEmail) {
      toast.error("New email must be different from current email")
      return
    }

    setIsUpdating(true)
    try {
      // First, verify the password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: password
      })

      if (signInError) {
        toast.error("Incorrect password")
        setIsUpdating(false)
        return
      }

      // If password is correct, initiate email change (requires confirmation)
      const { error } = await supabase.auth.updateUser({ 
        email: newEmail
      }, {
        emailRedirectTo: `${window.location.origin}/auth/confirm`
      })
      
      if (error) {
        toast.error("Failed to initiate email change")
      } else {
        toast.success("Verification sent to new email address. Your current email remains active until confirmed.")
        setNewEmail("")
        setPassword("")
        onClose()
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsUpdating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Change Email Address</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Email
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
              {currentEmail}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter new email address"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your current password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className="text-sm text-gray-500">
                  {showPassword ? "Hide" : "Show"}
                </span>
              </button>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Security Notice:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Your password is required to confirm this change</li>
                  <li>• Verification email will be sent to the new address</li>
                  <li>• Old email remains active until verified</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleUpdateEmail}
            disabled={isUpdating || !newEmail || !password}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? "Verifying..." : "Send Verification"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChangeEmailModal
