import React, { useState } from "react"
import { MessageCircle, Send, User, Mail, FileText } from "lucide-react"
import { toast } from "sonner"

interface SupportTabProps {
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

const SupportTab: React.FC<SupportTabProps> = ({ user }) => {
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  // Get display name from user metadata or fallback to email
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User'
  const userEmail = user?.email || ''

  const handleSendMessage = async () => {
    if (!title.trim() || title.length < 5) {
      toast.error("Title must be at least 5 characters long")
      return
    }
    
    if (!message.trim() || message.length < 30) {
      toast.error("Message must be at least 30 characters long")
      return
    }
    
    setIsSending(true)
    try {
      const response = await fetch('/api/support-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: displayName,
          email: userEmail,
          title: title.trim(),
          message: message.trim(),
          userId: user?.id,
          createdAt: user?.created_at
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }

      toast.success("Message sent! We'll respond within 24 hours")
      setTitle("") // Clear the title field
      setMessage("") // Clear the message field
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message. Please try again.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Support Form Card */}
      <Card>
              <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-blue-600" />
        </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Contact Support</h3>
              <p className="text-sm text-gray-500">Send us a message and we'll get back to you</p>
  </div>
</div>
        </CardHeader>
        <div className="px-6 py-5 space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={displayName}
                readOnly
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
              />
                      </div>
            <p className="text-xs text-gray-500 mt-1">Automatically filled</p>
                </div>

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="email"
                value={userEmail}
                readOnly
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Automatically filled</p>
          </div>

          {/* Title Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FileText className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief description of your issue..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSending}
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500">
                Minimum 5 characters required
              </p>
              <p className={`text-xs ${title.length < 5 ? 'text-red-500' : 'text-green-600'}`}>
                {title.length}/5
              </p>
            </div>
          </div>

          {/* Message Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue or question in detail..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical min-h-[120px]"
              rows={5}
              disabled={isSending}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500">
                Minimum 30 characters required
              </p>
              <p className={`text-xs ${message.length < 30 ? 'text-red-500' : 'text-green-600'}`}>
                {message.length}/30
              </p>
        </div>
          </div>

          {/* Send Button */}
          <div className="pt-2">
            <button
              onClick={handleSendMessage}
              disabled={isSending || title.length < 5 || message.length < 30}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Message
                </>
              )}
            </button>
          </div>
        </div>
      </Card>
      
      {/* Support Information Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Support Information</h3>
              <p className="text-sm text-gray-500">What to expect when you contact us</p>
            </div>
          </div>
        </CardHeader>
        <div className="px-6 py-5">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Response Time</p>
                <p className="text-sm text-gray-600">We typically respond within 24 hours</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Customer Support</p>
                <p className="text-sm text-gray-600">All support requests are taken seriously</p>
        </div>
          </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Follow-up</p>
                <p className="text-sm text-gray-600">We will follow up via email, we do not call</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default SupportTab 
