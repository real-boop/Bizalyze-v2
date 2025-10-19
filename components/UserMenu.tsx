import React, { useState, useRef, useEffect } from 'react'
import { LogOut, User, ChevronDown, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface UserMenuProps {
  user: any
}

const UserMenu: React.FC<UserMenuProps> = ({ user }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Get user's first initial for avatar
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U'

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [menuOpen])

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      // Don't redirect - let the auth state change handle UI updates
      // The user will stay on the current page
    }
  }

  const handleDashboard = () => {
    setMenuOpen(false)
    // TODO: Navigate to user dashboard when it's created
    router.push('/user/dashboard')
  }

  const handleSettings = () => {
    setMenuOpen(false)
    router.push('/user/settings')
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="User menu"
      >
        {/* User Avatar */}
        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
          {userInitial}
        </div>
        {/* Dropdown Arrow */}
        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <button
            className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-100 focus:outline-none"
            onClick={handleDashboard}
          >
            <User className="w-5 h-5 mr-3 text-blue-600" />
            My Dashboard
          </button>
          <button
            className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-100 focus:outline-none border-t border-gray-100"
            onClick={handleSettings}
          >
            <Settings className="w-5 h-5 mr-3 text-blue-600" />
            Settings
          </button>
          <button
            className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-100 focus:outline-none border-t border-gray-100"
            onClick={() => {
              setMenuOpen(false)
              handleLogout()
            }}
          >
            <LogOut className="w-5 h-5 mr-3 text-red-600" />
            Logout
          </button>
        </div>
      )}
    </div>
  )
}

export default UserMenu
