import React, { useState } from "react"
import { User, Mail, Calendar, Shield, Clock, Send } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import ChangeEmailModal from "@/components/ChangeEmailModal"
import ChangeNameModal from "@/components/ChangeNameModal"

interface ProfileTabProps {
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

const ProfileTab: React.FC<ProfileTabProps> = ({ user }) => {
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || "")
  const [inviteEmail, setInviteEmail] = useState("")
  const [isInviting, setIsInviting] = useState(false)
  const [isChangeEmailModalOpen, setIsChangeEmailModalOpen] = useState(false)
  const [isChangeNameModalOpen, setIsChangeNameModalOpen] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleNameUpdated = (newName: string) => {
    setDisplayName(newName)
  }

  const checkInviteEligibility = async (email: string) => {
    try {
      const response = await fetch('/api/check-invite-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const result = await response.json()
      return result
    } catch (error) {
      return { eligible: false, reason: 'Network error' }
    }
  }

  const handleSendInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsInviting(true)
    try {
      // First check if email is eligible for invite
      const eligibilityCheck = await checkInviteEligibility(inviteEmail)
      
      if (!eligibilityCheck.eligible) {
        toast.error(eligibilityCheck.reason)
        return
      }

      // If eligible, send the invite via API
      const response = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          inviterId: user.id
        })
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error)
      } else {
        toast.success("Invite sent successfully")
        setInviteEmail("")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsInviting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Display Name Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Display Name (Optional)</h3>
              <p className="text-sm text-gray-500">How your name appears in the app</p>
            </div>
          </div>
        </CardHeader>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 font-medium">
                {displayName || "No display name set"}
              </p>
            </div>
            <button 
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => setIsChangeNameModalOpen(true)}
            >
              Change Name
            </button>
          </div>
        </div>
      </Card>

      {/* Email Address Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Email Address</h3>
              <p className="text-sm text-gray-500">Your account email address</p>
            </div>
          </div>
        </CardHeader>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 font-medium">{user?.email}</p>
            </div>
            <button 
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => setIsChangeEmailModalOpen(true)}
            >
              Change Email
            </button>
          </div>
        </div>
      </Card>

      {/* Account Information Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>
              <p className="text-sm text-gray-500">Your account details</p>
            </div>
          </div>
        </CardHeader>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Account Created</p>
                <p className="text-sm text-gray-500">{formatDate(user?.created_at)}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Account Type</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Standard
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Last Active</p>
                <p className="text-sm text-gray-500">{formatDate(user?.last_sign_in_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Invite Others Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <Send className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Invite Others</h3>
              <p className="text-sm text-gray-500">Send an invitation to join the platform</p>
            </div>
          </div>
        </CardHeader>
        <div className="px-6 py-5">
          <div className="flex items-center gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter email address"
            />
            <button
              onClick={handleSendInvite}
              disabled={isInviting}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
            >
              {isInviting ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </div>
      </Card>

      {/* Change Email Modal */}
      <ChangeEmailModal
        isOpen={isChangeEmailModalOpen}
        onClose={() => setIsChangeEmailModalOpen(false)}
        currentEmail={user?.email || ""}
      />

      {/* Change Name Modal */}
      <ChangeNameModal
        isOpen={isChangeNameModalOpen}
        onClose={() => setIsChangeNameModalOpen(false)}
        currentName={displayName}
        onNameUpdated={handleNameUpdated}
      />
    </div>
  )
}

export default ProfileTab