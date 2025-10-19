'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { Menu, Home, Settings, LogOut } from 'lucide-react'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu'
import AuthModal from './AuthModal'

// Mock auth state for now
const useMockAuth = () => {
  const [isSignedIn, setIsSignedIn] = useState(false)
  return { isSignedIn, setIsSignedIn }
}

const TopNavBar: React.FC = () => {
  const { isSignedIn, setIsSignedIn } = useMockAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)

  return (
    <header className="sticky top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md shadow-md h-14 flex items-center px-4">
      {/* Logo */}
      <Link href="/" className="flex items-center h-full mr-auto" aria-label="Home">
        {/* Placeholder logo: replace with your SVG or image */}
        <span className="font-bold text-lg text-blue-600 tracking-tight">LOGO</span>
      </Link>
      <div className="flex items-center gap-2 ml-auto">
        {/* Sign In button (if not signed in) */}
        {!isSignedIn && (
          <Button variant="outline" size="sm" onClick={() => setAuthModalOpen(true)}>
            Sign In
          </Button>
        )}
        {/* Hamburger menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Open menu"
              type="button"
            >
              <Menu className="w-7 h-7 text-gray-700" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-2 p-0">
            <DropdownMenuItem asChild className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-100 focus:outline-none">
              <Link href="/" className="flex items-center w-full">
                <Home className="w-5 h-5 mr-3 text-blue-600" />
                Back to Main Menu
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-100 focus:outline-none">
              <Settings className="w-5 h-5 mr-3 text-blue-600" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            {isSignedIn && (
              <DropdownMenuItem onClick={() => setIsSignedIn(false)} className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-100 focus:outline-none">
                <LogOut className="w-5 h-5 mr-3 text-blue-600" />
                Logout
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Auth Modal */}
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} onSignIn={() => setIsSignedIn(true)} />
    </header>
  )
}

export default TopNavBar 