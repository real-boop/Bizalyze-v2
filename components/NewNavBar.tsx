"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Menu, X, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import AuthModal from "@/components/AuthModal"
import UserMenu from "@/components/UserMenu"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export function NewNavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  
  // Add authentication state (same as landing page)
  const [user, setUser] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  // Check authentication on page load (same as landing page)
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setIsAuthenticated(true)
        setUser(session.user)
      }
    }
    checkAuth()

    // Listen for auth changes (same as landing page)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true)
        setUser(session.user)
      } else {
        setIsAuthenticated(false)
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <header className="px-2 lg:px-6 h-16 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold hover:opacity-80 transition-opacity">
          <img src="/logo-v3.png" alt="Bizalyze" className="h-8 w-auto" />
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex gap-4 items-center">
          {!isAuthenticated ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setAuthModalOpen(true)}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Log in
            </Button>
          ) : (
            <UserMenu user={user} />
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {mounted && theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              setMobileMenuOpen(!mobileMenuOpen);
              if (mobileMenuOpen) {
                (document.activeElement as HTMLElement)?.blur();
              }
            }}
            className="rounded-full p-3 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>

        {/* Mobile Navigation */}
        <div className="flex items-center gap-4 md:hidden">
          {!isAuthenticated ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setAuthModalOpen(true)}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Log in
            </Button>
          ) : (
            <UserMenu user={user} />
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {mounted && theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              setMobileMenuOpen(!mobileMenuOpen);
              if (mobileMenuOpen) {
                (document.activeElement as HTMLElement)?.blur();
              }
            }}
            className="rounded-full p-3 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>
      
      {/* Menu dropdown - cleaned up */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-16 inset-x-0 bg-background/95 backdrop-blur-lg border-b"
          style={{}}
        >
          <div className="w-full py-6 px-4 md:px-6 lg:px-8 flex flex-col gap-1">
            <Link href="/" className="py-2 px-4 text-base text-center font-medium rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setMobileMenuOpen(false)}>
              Back to Home
            </Link>
            <button className="py-2 px-4 text-base text-center font-medium rounded-lg hover:bg-gray-100 transition-colors text-left">
              Settings
            </button>
          </div>
        </motion.div>
      )}

      {/* Auth Modal */}
      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen} 
        onSignIn={() => {
          setAuthModalOpen(false);
        }} 
      />
    </header>
  )
}
