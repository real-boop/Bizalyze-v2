"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { Check, ChevronRight, Menu, X, Moon, Sun, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTheme } from "next-themes"
import { TestimonialCarousel } from "@/components/testimonial-carousel"
import { PricingCarousel } from "@/components/pricing-carousel"
import StatsSection from "@/components/stats-section"
import AuthModal from "@/components/AuthModal"
import UserMenu from "@/components/UserMenu"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [activeMode, setActiveMode] = useState<"buyer" | "seller">("buyer")
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  
  // Add authentication state
  const [user, setUser] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  // Check authentication on page load
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setIsAuthenticated(true)
        setUser(session.user)
        setIsSignedIn(true)
      }
    }
    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true)
        setUser(session.user)
        setIsSignedIn(true)
      } else {
        setIsAuthenticated(false)
        setUser(null)
        setIsSignedIn(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Add this useEffect to force light mode on page load
  useEffect(() => {
    // Force light mode when landing page loads
    setTheme("light")
  }, [setTheme])

  const buyerSteps = [
    {
      step: "01",
      title: "Find Your Target Business",
      description: "Browse listings on any platform or get a direct link from a broker.",
    },
    {
      step: "02",
      title: "Paste the Listing Data",
      description: "Simply paste the business listing information into our analysis tool.",
    },
    {
      step: "03",
      title: "Get Instant Analysis",
      description: "Receive comprehensive valuation and risk assessment in under 5 minutes.",
    },
    {
      step: "04",
      title: "Make Informed Offers",
      description: "Get a custom negotiation checklist. Negotiate confidently and avoid overpaying.",
    },
  ]

  const sellerSteps = [
    {
      step: "01",
      title: "Enter Business Details",
      description: "Provide basic information about your business and financials.",
    },
    {
      step: "02",
      title: "Get Professional Valuation",
      description: "Receive an accurate valuation using industry-standard methodologies.",
    },
    {
      step: "03",
      title: "Optimize Your Price",
      description: "Get recommendations on pricing strategy and market positioning.",
    },
    {
      step: "04",
      title: "List with Confidence",
      description: "Don't waste months waiting. Create compelling listings that attract serious buyers.",
    },
  ]

  const retailPlans = [
    {
      id: "free",
      title: "Free",
      description: "Get started now",
      price: "$0",
      priceUnit: "/analysis",
      buttonText: "Get Started",
      buttonVariant: "outline" as const,
      features: [
        "1 analysis with preview report",
        "Full report provided with account",
        "No Credit Card required",
        "Test with no strings attached"
      ]
    },
    {
      id: "single",
      title: "Single Report",
      description: "Complete Professional Report",
      price: "$49",
      priceUnit: "/analysis",
      badge: "Most Popular",
      buttonText: "Get Started",
      buttonVariant: "default" as const,
      features: [
        "Full analysis + negotiation strategy",
        "Professional PDF export",
        "Custom Due Diligence checklist",
        "No sign-up required"
      ],
      isPopular: true
    },
    {
      id: "bundle",
      title: "5-Reports Bundle",
      description: "Get 5 Reports, Pay only 4",
      price: "$196",
      priceUnit: "/bundle",
      buttonText: "Get Started",
      buttonVariant: "outline" as const,
      features: [
        "20% Off",
        "Set up account in 1 minute",
        "Coming Soon",
        "Access and compare all reports"
      ]
    }
  ]

  const enterprisePlans = [
    {
      id: "small",
      title: "Small",
      description: "Subscription for brokers and professionals",
      price: "$tbd",
      priceUnit: "/month",
      buttonText: "Contact Us",
      buttonVariant: "outline" as const,
      features: ["Monthly subscription model"]
    },
    {
      id: "medium",
      title: "Medium",
      description: "Subscription for brokers and professionals",
      price: "$tbd",
      priceUnit: "/month",
      buttonText: "Contact Us",
      buttonVariant: "outline" as const,
      features: ["Monthly subscription model"]
    },
    {
      id: "large",
      title: "Large",
      description: "Subscription for brokers and professionals",
      price: "$tbd",
      priceUnit: "/month",
      buttonText: "Contact Us",
      buttonVariant: "outline" as const,
      features: ["Monthly subscription model"]
    }
  ]

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  }

  const features = [
    {
      title: "All insights. No Wait.",
      description:
        "Skip the 2-3 week wait and hefty price tag for traditional appraisals. We get you all facts for smart decisions.",
      image: "/quick-deal-handshake.png",
    },
    {
      title: "Good Business, Bad Spot?",
      description:
        "The only tool that gives business + location analysis. Other calculators rely only on basic business data. We put them in context.",
      image: "/location-analysis-mobile.png",
    },
    {
      title: "Red Flags. Green Lights.",
      description:
        "We catch hidden issues and make sure you don't overpay for your dream business or undersell your life's work.",
      image: "/financial-risk-tablet.png",
    },
  ]

  const TypewriterEffect = () => {
    const businessTypes = ["Restaurant", "Laundromat", "Car Wash", "Gas Station", "Retail Store"]
    const [currentIndex, setCurrentIndex] = useState(0)
    const [currentText, setCurrentText] = useState("")
    const [isTyping, setIsTyping] = useState(true)

    useEffect(() => {
      const currentWord = businessTypes[currentIndex]

      if (isTyping) {
        if (currentText.length < currentWord.length) {
          const timeout = setTimeout(() => {
            setCurrentText(currentWord.slice(0, currentText.length + 1))
          }, 100)
          return () => clearTimeout(timeout)
        } else {
          const timeout = setTimeout(() => {
            setIsTyping(false)
          }, 2000)
          return () => clearTimeout(timeout)
        }
      } else {
        if (currentText.length > 0) {
          const timeout = setTimeout(() => {
            setCurrentText(currentText.slice(0, -1))
          }, 50)
          return () => clearTimeout(timeout)
        } else {
          const timeout = setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % businessTypes.length)
            setIsTyping(true)
          }, 500)
          return () => clearTimeout(timeout)
        }
      }
    }, [currentText, isTyping, currentIndex, businessTypes])

    return (
      <span>
        Find Your Perfect{" "}
        <span className="bg-gradient-to-r from-blue-500 to-teal-500 bg-clip-text text-transparent">
          {currentText}
          <span className="animate-pulse">|</span>
        </span>
      </span>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-2 lg:px-6 h-16 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2 font-bold hover:opacity-80 transition-opacity"
          >
            <img src="/logo-v3.png" alt="Bizalyze" className="h-8 w-auto" />
          </button>
          <nav className="hidden md:flex gap-8">
            <Link
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              How it Works
            </Link>
            <Link
              href="#testimonials"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Testimonials
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="#faq"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              FAQ
            </Link>
          </nav>
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
            </Button>
            <Link href="/start">
              <Button size="lg" className="rounded-full h-12 px-8 text-base">
                {isAuthenticated ? 'Analyze New Business' : 'Get Started'}
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </Link>
          </div>
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
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-16 inset-x-0 bg-background/95 backdrop-blur-lg border-b"
            style={{}} // Add empty style to fix TypeScript issue
          >
            <div className="container py-6 px-4 flex flex-col gap-1">
              <Link href="#features" className="py-2 px-4 text-base text-center font-medium rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Features
              </Link>
              <Link href="#how-it-works" className="py-2 px-4 text-base text-center font-medium rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                How it Works
              </Link>
              <Link href="#testimonials" className="py-2 px-4 text-base text-center font-medium rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Testimonials
              </Link>
              <Link href="#pricing" className="py-2 px-4 text-base text-center font-medium rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Pricing
              </Link>
              <Link href="#faq" className="py-2 px-4 text-base text-center font-medium rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                FAQ
              </Link>
              <div className="pt-4 border-t">
                <Link href="/start">
                  <Button size="lg" className="rounded-full h-12 px-8 text-base w-full">
                    {isAuthenticated ? 'Analyze New Business' : 'Get Started'}
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </header>
      <main className="flex-1">
                  {/* Hero Section */}
          <section className="w-full py-14 md:py-24 lg:py-24 overflow-hidden">
            <div className="container mx-auto px-4 md:px-6 relative">
            <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-black bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              {/* Left Column - Text Content */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center lg:text-left order-1 lg:order-1"
              >
                <Badge className="mb-4 rounded-full px-4 py-1.5 text-sm font-medium" variant="secondary">
                  Buying or Selling Small Businesses?
                </Badge>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 text-balance">
                  The Car Fax for Businesses
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0 lg:max-w-none text-pretty">
                  Buyers shouldn't overpay, sellers shouldn't undersell. Professional business valuations in minutes using the same
                  methodology as $2,000+ appraisals.
                  Independent. Smart. Fast.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <Link href="/start">
                    <Button size="lg" className="rounded-full h-12 px-8 text-base">
                      Try It Now
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </Link>
                  <Link href="/bizalyze-sample-report.pdf" target="_blank">
                    <Button size="lg" variant="outline" className="rounded-full h-12 px-8 text-base bg-transparent">
                      Get Sample Report
                    </Button>
                  </Link>
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-2 sm:gap-4 mt-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Check className="size-4 text-primary" />
                    <span>No hooks</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Check className="size-4 text-primary" />
                    <span>Free sample</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Check className="size-4 text-primary" />
                    <span>Pay per use option</span>
                  </div>
                </div>
              </motion.div>

              {/* Right Column - Device Mockups */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="relative flex justify-center lg:justify-end order-2 lg:order-2"
              >
                <div className="relative w-full max-w-[500px] mx-auto lg:mx-0">
                  {/* Laptop Mockup */}
                  <div className="relative w-full">
                    <div className="w-full aspect-[5/3] max-w-[500px] bg-gray-800 rounded-t-xl p-1 sm:p-2 shadow-2xl">
                      <div className="w-full h-full bg-white rounded-lg overflow-hidden">
                        <Image
                          src="/bizalyze-desktop-report.png"
                          width={496}
                          height={296}
                          alt="Desktop UI"
                          className="w-full h-full object-contain object-center"
                          priority
                        />
                      </div>
                    </div>
                    <div className="w-full h-3 sm:h-4 bg-gray-800 rounded-b-xl"></div>
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 sm:w-16 h-1 bg-gray-600 rounded-full"></div>

                    <div className="absolute -bottom-6 sm:-bottom-8 left-0 w-full h-6 sm:h-8 bg-gradient-to-b from-gray-800/20 to-transparent rounded-b-xl transform scale-y-[-1] blur-sm opacity-30"></div>
                  </div>

                  {/* Mobile Phone Mockup */}
                  <div className="absolute -bottom-12 sm:-bottom-8 -left-2 sm:-left-16 z-10 scale-75 sm:scale-100">
                    <div className="w-[140px] sm:w-[140px] h-[240px] sm:h-[280px] bg-gray-800 rounded-[20px] sm:rounded-[24px] p-1.5 sm:p-2 shadow-xl">
                      <div className="w-full h-full bg-black rounded-[16px] sm:rounded-[20px] overflow-hidden relative">
                        {/* Phone notch */}
                        <div className="absolute top-1.5 sm:top-2 left-1/2 transform -translate-x-1/2 w-12 sm:w-16 h-3 sm:h-4 bg-gray-800 rounded-full z-10"></div>
                        <Image
                          src="/bizalyze-mobile-report.png"
                          width={136}
                          height={276}
                          alt="Mobile UI"
                          className="w-full h-full object-contain object-contain"
                        />
                      </div>
                    </div>

                    <div className="absolute -bottom-3 sm:-bottom-4 left-0 w-full h-3 sm:h-4 bg-gradient-to-b from-gray-800/20 to-transparent rounded-b-[20px] sm:rounded-b-[24px] transform scale-y-[-1] blur-sm opacity-30"></div>
                  </div>

                  {/* Background gradient blurs */}
                  <div className="absolute -bottom-6 -right-6 -z-10 h-[200px] sm:h-[300px] w-[200px] sm:w-[300px] rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 blur-3xl opacity-70"></div>
                  <div className="absolute -top-6 -left-6 -z-10 h-[200px] sm:h-[300px] w-[200px] sm:w-[300px] rounded-full bg-gradient-to-br from-secondary/30 to-primary/30 blur-3xl opacity-70"></div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

                  {/* Social Proof Section */}
          <section className="w-full py-10 bg-gray-50/50 overflow-hidden border-t border-b border-gray-200/70 overflow-hidden">
            <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <p className="text-base font-medium text-gray-500">Works with:</p>

              <div className="relative w-full max-w-4xl h-10 flex items-center">
                <div
                  className="absolute inset-0"
                  style={{
                    maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
                    WebkitMaskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
                  }}
                >
                  <motion.div
                    className="flex items-center space-x-12 whitespace-nowrap"
                    animate={{
                      x: [0, -1200], // Move from 0 to -1200px (adjust based on content width)
                    }}
                    transition={{
                      duration: 20,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "linear",
                    }}
                  >
                    {/* First set of platform names */}
                    {[
                      "BizBuySell",
                      "LoopNet",
                      "BizQuest",
                      "BusinessBroker.net",
                      "Sunbelt Business",
                      "Murphy Business",
                      "BizBen",
                      "Crexi",
                      "MergerNetwork",
                      "BizTrader",
                      "BusinessesForSale",
                      "Facebook",
                    ].map((platform, index) => (
                      <span
                        key={`first-${index}`}
                        className="text-lg md:text-xl font-bold bg-gradient-to-r from-blue-500 to-teal-500 bg-clip-text text-transparent min-w-[140px] text-center flex-shrink-0"
                      >
                        {platform}
                      </span>
                    ))}

                    {/* Second set for seamless looping */}
                    {[
                      "BizBuySell",
                      "LoopNet",
                      "BizQuest",
                      "BusinessBroker.net",
                      "Sunbelt Business",
                      "Murphy Business",
                      "BizBen",
                      "Crexi",
                      "MergerNetwork",
                      "BizTrader",
                      "BusinessesForSale",
                      "Facebook",
                    ].map((platform, index) => (
                      <span
                        key={`second-${index}`}
                        className="text-lg md:text-xl font-bold bg-gradient-to-r from-blue-500 to-teal-500 bg-clip-text text-transparent min-w-[140px] text-center flex-shrink-0"
                      >
                        {platform}
                      </span>
                    ))}
                  </motion.div>
                </div>
              </div>

              <p className="text-sm text-gray-400 mt-2">... and any other platform or broker listing.</p>
            </div>
          </div>
        </section>

        <StatsSection />

                  {/* Features Section */}
          <section id="features" className="w-full py-20 md:py-32">
            <div className="container mx-auto px-4 md:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center space-y-4 text-center mb-12"
            >
              <Badge className="rounded-full px-4 py-1.5 text-sm font-medium" variant="secondary">
                Features
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Know Your Fair Value in Minutes</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                Over 60% of buyers overpay. More than 50% of sellers wait over 3 months to sell. Get professional
                insights instantly to make better decisions. Independent analysis without broker conflict that reveals
                true value before you negotiate. Price right, sell fast.
              </p>
            </motion.div>

            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-8 sm:grid-cols-1 lg:grid-cols-3"
            >
              {features.map((feature, index) => (
                <motion.div key={index} className="group h-full">
                  <div className="relative overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.02] h-full flex flex-col">
                    <div className="aspect-[4/3] bg-white dark:bg-gray-900 overflow-hidden">
                      <img
                        src={feature.image || "/placeholder.svg"}
                        alt={feature.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                      <p className="text-muted-foreground leading-relaxed flex-1">{feature.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12"
            >
              <Link href="/start">
                <Button size="lg" className="rounded-full h-12 px-8 text-base">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="rounded-full h-12 px-8 text-base bg-transparent">
                Get Sample Report
              </Button>
            </motion.div>
          </div>
        </section>

                  {/* How It Works Section */}
          <section id="how-it-works" className="w-full py-20 md:py-32 bg-muted/30 relative overflow-hidden">
            <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-black bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_40%,transparent_100%)]"></div>

            <div className="container mx-auto px-4 md:px-6 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center space-y-4 text-center mb-16"
            >
              <Badge className="rounded-full px-4 py-1.5 text-sm font-medium" variant="secondary">
                How It Works
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                <TypewriterEffect />
              </h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                Setup in seconds, results in minutes. While others wait, you negotiate.
              </p>

              <div className="mt-8">
                <Tabs value={activeMode} onValueChange={(value) => setActiveMode(value as "buyer" | "seller")}>
                  <TabsList className="rounded-full p-1">
                    <TabsTrigger value="buyer" className="rounded-full px-6">
                      I'm looking to buy
                    </TabsTrigger>
                    <TabsTrigger value="seller" className="rounded-full px-6">
                      I'm looking to sell
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </motion.div>

            <div
              className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-start ${
                activeMode === "seller" ? "lg:grid-flow-col-dense" : ""
              }`}
            >
              {/* Steps Column */}
              <motion.div
                key={activeMode}
                initial={{ opacity: 0, x: activeMode === "buyer" ? -40 : 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className={`space-y-8 ${activeMode === "seller" ? "lg:col-start-2" : ""}`}
              >
                {(activeMode === "buyer" ? buyerSteps : sellerSteps).map((step, i) => (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, x: activeMode === "buyer" ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="flex items-start space-x-4 group cursor-pointer"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm font-bold shadow-lg flex-shrink-0 transition-all duration-200 group-hover:scale-110 group-hover:bg-blue-600">
                      {step.step}
                    </div>
                    <div className="space-y-2 transition-all duration-200 group-hover:translate-x-1">
                      <h3 className="text-xl font-bold transition-colors duration-200 group-hover:text-gray-900">
                        {step.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed transition-colors duration-200 group-hover:text-gray-700">
                        {step.description}
                      </p>
                    </div>
                  </motion.div>
                ))}

                <div className="pt-4">
                  <Link href="/start">
                    <Button size="lg" className="rounded-full h-12 px-8 text-base bg-gradient-to-r from-blue-500 to-teal-500 text-white hover:from-blue-600 hover:to-teal-600">
                      {activeMode === "buyer" ? "Start Analysis" : "Get Valuation"}
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </Link>
                </div>
              </motion.div>

              {/* Image Column */}
              <motion.div
                key={`${activeMode}-image`}
                initial={{ opacity: 0, x: activeMode === "buyer" ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className={`relative ${activeMode === "seller" ? "lg:col-start-1" : ""}`}
              >
                <div className="relative bg-gradient-to-br from-gray-900/50 to-gray-900/90 rounded-2xl p-2 shadow-2xl group cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
                  <div className="aspect-[4/3] bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden">
                    <img
                      src={activeMode === "buyer" ? "/bizalyze-buyer-analysis.png" : "/bizalyze-seller-analysis.png"}
                      alt={`${activeMode} dashboard`}
                      className="w-full h-full object-contain object-top transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  {/* Background gradient blurs */}
                  <div className="absolute -bottom-6 -right-6 -z-10 h-[200px] w-[200px] rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-3xl opacity-70"></div>
                  <div className="absolute -top-6 -left-6 -z-10 h-[200px] w-[200px] rounded-full bg-gradient-to-br from-secondary/20 to-primary/20 blur-3xl opacity-70"></div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

                  {/* Testimonials Section */}
          <section id="testimonials" className="w-full py-20 md:py-32">
            <div className="container mx-auto px-4 md:px-6 max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center space-y-4 text-center mb-12"
            >
              <Badge className="rounded-full px-4 py-1.5 text-sm font-medium" variant="secondary">
                Testimonials
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Loved by Buyers and Sellers</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                Don't just take our word for it. See what our customers have to say about their experience.
              </p>
            </motion.div>

            <TestimonialCarousel />
          </div>
        </section>

                  {/* Pricing Section */}
          <section id="pricing" className="w-full py-20 md:py-32 bg-muted/30 relative overflow-hidden">
            <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-black bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_40%,transparent_100%)]"></div>
            <div className="container mx-auto px-4 md:px-6 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center space-y-4 text-center mb-12"
            >
              <Badge className="rounded-full px-4 py-1.5 text-sm font-medium" variant="secondary">
                Pricing
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Simple, Transparent Pricing</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg mb-8">
                Whether you are testing the waters, or analyze multiple businesses daily, we got you covered:
              </p>
            </motion.div>

            <div className="mx-auto max-w-5xl">
              <div className="flex justify-center mb-8">
                <Tabs defaultValue="retail" className="w-full">
                  <div className="flex justify-center">
                    <TabsList className="rounded-full p-1">
                      <TabsTrigger value="retail" className="rounded-full px-6">
                        Retail
                      </TabsTrigger>
                      <TabsTrigger value="enterprise" className="rounded-full px-6">
                        Enterprise
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="retail" className="mt-12">
                    <PricingCarousel 
                      plans={retailPlans}
                      selectedPlan={selectedPlan}
                      onPlanSelect={setSelectedPlan}
                    />
                  </TabsContent>

                  <TabsContent value="enterprise" className="mt-12">
                    <PricingCarousel 
                      plans={enterprisePlans}
                      selectedPlan={selectedPlan}
                      onPlanSelect={setSelectedPlan}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </section>

                  {/* FAQ Section */}
          <section id="faq" className="w-full py-20 md:py-32">
            <div className="container mx-auto px-4 md:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center space-y-4 text-center mb-12"
            >
              <Badge className="rounded-full px-4 py-1.5 text-sm font-medium" variant="secondary">
                FAQ
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Frequently Asked Questions</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                Have questions about our business valuation service? Check out our FAQ section for answers.
              </p>
            </motion.div>

            <Accordion type="single" defaultValue="item-1" className="w-full max-w-4xl mx-auto">
              <AccordionItem value="item-1">
                <AccordionTrigger>How accurate are business valuations from your tool?</AccordionTrigger>
                <AccordionContent>
                  Our AI uses the same methodologies as certified business valuators, factoring in comparables, business
                  metrics and location. We examine 50+ valuation factors including financial performance, location
                  demographics, and industry trends. We are not seeking to replace Due Diligence processes entirely, but
                  give buyers and sellers all information they need to negotiate confidently within 5 minutes.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>How fast can I get my business valuation report?</AccordionTrigger>
                <AccordionContent>
                  Complete business valuations are delivered in under 5 minutes. Simply paste a business listing
                  information or enter basic financials and location, and our system instantly analyzes comparable
                  sales, market conditions, and location factors to generate your professional valuation report with
                  fair price ranges and investment recommendations.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>
                  What makes this different from other business valuation calculators?
                </AccordionTrigger>
                <AccordionContent>
                  Most business valuation tools only calculate simple revenue multiples. We analyze 50+ factors
                  including location demographics, competition density, lease terms, equipment age, market trends, and
                  economic conditions. It's like having a certified business appraiser and market analyst review every
                  deal.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>Can I analyze any business for sale listing?</AccordionTrigger>
                <AccordionContent>
                  Yes! Our tool works with major business listing platforms including BizBuySell, LoopNet, BizQuest, and
                  BusinessBroker.net. Simply enter information of any business for sale, and we'll extract all relevant
                  data to perform a comprehensive valuation analysis including market comparables and location
                  assessment.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger>What information does your business valuation include?</AccordionTrigger>
                <AccordionContent>
                  Each valuation report includes: investment score (1-10 rating), fair value price range, revenue and
                  cash flow multiples, location demographic analysis, strengths and weaknesses assessment, negotiation
                  strategy recommendations, and a professional PDF report you can share with advisors or lenders.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-6">
                <AccordionTrigger>Do you analyze location and demographics for business valuations?</AccordionTrigger>
                <AccordionContent>
                  Absolutely. We include comprehensive location analysis. We examine demographics, location
                  attractiveness, and economic trends to determine how location factors affect business value - critical
                  data most buyers and sellers overlook.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-7">
                <AccordionTrigger>Can I use this for businesses I'm thinking of buying?</AccordionTrigger>
                <AccordionContent>
                  Perfect for due diligence! Most users analyze businesses they're considering purchasing. Our
                  independent valuation analysis helps identify overpriced listings, spot red flags, and determine fair
                  market value before making offers. Essential for avoiding the costly mistakes 67% of first-time
                  business buyers make.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-8">
                <AccordionTrigger>What types of businesses can you analyze and value?</AccordionTrigger>
                <AccordionContent>
                  We specialize in small to mid-market businesses, such as restaurants, retail stores, service
                  businesses, franchises, laundromats, automotive services, and professional practices. Our analysis
                  covers businesses from $100K to $10M asking price. We collected specific data of 100+ industry
                  categories to provide tailor-made assessments. New business categories roll out over time.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-9">
                <AccordionTrigger>How does your pricing compare to traditional business appraisals?</AccordionTrigger>
                <AccordionContent>
                  Traditional certified business appraisals cost $2,000-5,000 and take 2-3 weeks. Our professional-grade
                  analysis delivers the same insights instantly for free (one analysis), $29 as pay-per-use or as a
                  monthly subscription for heavy users (soon to come). Save thousands while getting faster, more
                  comprehensive analysis than expensive appraisers.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-10">
                <AccordionTrigger>Can I export and share my business valuation report?</AccordionTrigger>
                <AccordionContent>
                  Yes! Every valuation includes a professional PDF report you can download and share with business
                  partners, lenders, attorneys, or advisors. The report includes executive summary, detailed analysis,
                  comparable sales data, location insights, and negotiation recommendations - everything needed for
                  informed business decisions.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-11">
                <AccordionTrigger>Who developed this business valuation tool and methodology?</AccordionTrigger>
                <AccordionContent>
                  Our valuation platform was developed using industry-standard methodologies by a team with over a
                  decade of experience in small businesses, startup valuations and financial analysis. The system was
                  built in collaboration with industry experts to ensure our AI applies the same rigorous standards used
                  by certified business appraisers. The idea was born as we were acquiring small businesses ourselves
                  and got annoyed with the information quality on the market.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-12">
                <AccordionTrigger>Why should I trust your business valuations over other tools?</AccordionTrigger>
                <AccordionContent>
                  Unlike generic calculators, we assess businesses by looking at all factors that matter. Brokers and
                  marketplaces have their own agenda - higher prices mean higher commissions. We focus on delivering
                  independent, unbiased reports for smart investment decisions. Built by professionals with extensive
                  experience in running and acquiring small businesses, we've incorporated feedback from CPAs and
                  industry experts to create a tool that matches institutional-grade analysis standards. Our methodology
                  is transparent and analyzes the same 50+ factors that certified appraisers examine - without the
                  conflicts of interest.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>
      </main>

      {/* Auth Modal */}
      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen} 
        onSignIn={() => {
          setIsSignedIn(true);
          setAuthModalOpen(false);
        }} 
      />
    </div>
  )
}
