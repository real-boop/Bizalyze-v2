import React from "react"
import { CreditCard, Clock } from "lucide-react"

interface BillingTabProps {
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

const BillingTab: React.FC<BillingTabProps> = ({ user }) => {
  const handleViewOrders = () => {
    window.open('https://sandbox.polar.sh/bizalyze/portal/', '_blank')
  }

  return (
    <div className="space-y-6">
      {/* See Orders Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Billing Setup and History</h3>
              <p className="text-sm text-gray-500">View your order history and billing information</p>
            </div>
          </div>
        </CardHeader>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 font-medium">Order History</p>
              <p className="text-sm text-gray-500">Via Polar.sh. Opens in a new tab.</p>
            </div>
            <button
              onClick={handleViewOrders}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              View Orders
            </button>
          </div>
          
          {/* Additional Info - Below the main action */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600 mb-2">
              Access your complete order history, receipts, and billing information through our secure payment provider, Polar.sh.
            </p>
          </div>
        </div>
      </Card>

      {/* Manage Subscriptions Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Subscriptions</h3>
              <p className="text-sm text-gray-500">Book a nd change plans</p>
            </div>
          </div>
        </CardHeader>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 font-medium">Subscription Management</p>
              <p className="text-sm text-gray-500">Manage your plans</p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
              <Clock className="w-3 h-3" />
              Coming Soon
            </div>
          </div>
          
          {/* Additional Info - Below the main action */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Subscription features will be available soon. For now, we only offer pay per use.
            </p>
          </div>
        </div>
      </Card>

      {/* Billing Information Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Billing Information</h3>
              <p className="text-sm text-gray-500">Your current billing status</p>
            </div>
          </div>
        </CardHeader>
        <div className="px-6 py-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Account Type</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Standard
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Billing Status</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Payment Method</span>
              <span className="text-sm text-gray-500">Configured via Polar.sh</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default BillingTab