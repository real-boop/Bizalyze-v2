import { Suspense } from 'react'
import { ResetPasswordModal } from '@/components/ResetPasswordModal'

// Loading fallback component
function ResetPasswordLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl p-8 max-w-md mx-4 text-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordModal />
    </Suspense>
  )
}
