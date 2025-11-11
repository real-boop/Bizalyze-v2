import React, { useState } from "react"
import { Shield, Lock, Key, AlertTriangle, CheckCircle, Clock, Mail, ChevronDown } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import ChangePasswordSettingsModal from "@/components/ChangePasswordSettingsModal"
import DeleteAccountModal from "@/components/DeleteAccountModal"

interface SecurityTabProps {
  user: any
}

// Card component for consistent styling
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden transition-all hover:shadow-lg hover:border-gray-300 ${className}`}
    >
      {children}
    </div>
  )
}

// Card header component
const CardHeader = ({ children }: { children: React.ReactNode }) => {
  return <div className="px-6 py-5 border-b border-gray-100">{children}</div>
}

const SecurityTab: React.FC<SecurityTabProps> = ({ user }) => {
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false)
  const [isDeleteAccountExpanded, setIsDeleteAccountExpanded] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }



  const handleForgotPassword = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email, {
        redirectTo: `${window.location.origin}/auth/change-password`
      })
      
      if (error) {
        toast.error("Failed to send reset email")
      } else {
        toast.success("Password reset email sent! Check your inbox.")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    }
  }

  return (
    <div className="space-y-6">
      {/* Password Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Key className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Password</h3>
              <p className="text-sm text-gray-500">Your account password</p>
            </div>
          </div>
        </CardHeader>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 font-medium">Password</p>
              <p className="text-sm text-gray-500">Password is set</p>
            </div>
            <button 
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => setIsChangePasswordModalOpen(true)}
            >
              Change Password
            </button>
          </div>
          
          {/* Reset Password Link - Below the main action */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={handleForgotPassword}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Reset password via email instead
            </button>
            <p className="text-xs text-gray-500 mt-1">
              Link expires in 1 hour
            </p>
          </div>
        </div>
      </Card>

      {/* Security Indicators Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Security Status</h3>
              <p className="text-sm text-gray-500">Your account security information</p>
            </div>
          </div>
        </CardHeader>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Last Login</p>
                <p className="text-sm text-gray-500">{formatDate(user?.last_sign_in_at)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Email Verified</p>
                <div className="flex items-center gap-2">
                  {user?.email_confirmed_at ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-600">Verified</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm text-yellow-600">Not Verified</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </Card>

      {/* Delete Account Card */}
      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900">Delete Account</h3>
                <p className="text-sm text-red-600">Permanently delete your account and all data</p>
              </div>
            </div>
            <button
              onClick={() => setIsDeleteAccountExpanded(!isDeleteAccountExpanded)}
              className="p-2 hover:bg-red-50 rounded-full transition-colors"
              aria-label={isDeleteAccountExpanded ? "Collapse" : "Expand"}
            >
              <ChevronDown className={`w-5 h-5 text-red-600 transition-transform ${isDeleteAccountExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </CardHeader>
        {isDeleteAccountExpanded && (
          <div className="px-6 py-5">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">Warning: This action cannot be undone</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• All saved searches will be deleted</li>
                <li>• All analysis history will be lost</li>
                <li>• Cannot be undone</li>
                <li>• Data will be removed immediately</li>
              </ul>
            </div>
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Delete Account
            </button>
          </div>
        )}
      </Card>

      {/* Change Password Modal */}
      <ChangePasswordSettingsModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        user={user}
      />

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        user={user}
      />
    </div>
  )
}

export default SecurityTab
