"use client"

import BackgroundPaths from "@/components/kokonutui/background-paths"
import { QuickValuationForm } from "@/components/quick-valuation-form"
import { NewNavBar } from "@/components/NewNavBar"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { useEffect, useRef, useState } from "react"

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
      Check Out My<br />
      <span className="bg-gradient-to-r from-blue-500 to-teal-500 bg-clip-text text-transparent">
        {currentText}
        <span className="animate-pulse">|</span>
      </span>
    </span>
  )
}

export default function ValuationPage() {
  const formRef = useRef<HTMLDivElement>(null)

  return (
    <>
      <NewNavBar />
      <main>
        <BackgroundPaths noCenter={true} title="" className="pt-0">
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
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-balance">
                    <TypewriterEffect />
                  </h1>
                  <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0 lg:max-w-none text-pretty">
                    Get an instant valuation estimate based on real market data. Free, quick, and accurate.
                  </p>
                  <div className="flex items-center justify-center lg:justify-start gap-2 sm:gap-4 mt-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Check className="size-4 text-primary" />
                      <span>Instant results</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Check className="size-4 text-primary" />
                      <span>100% free</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Check className="size-4 text-primary" />
                      <span>Real market data</span>
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
                          <img
                            src="/bizalyze-desktop-report.png"
                            alt="Desktop UI"
                            className="w-full h-full object-contain object-center"
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
                          <img
                            src="/bizalyze-mobile-report.png"
                            alt="Mobile UI"
                            className="w-full h-full object-contain object-center"
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

          {/* Quick Valuation Form */}
          <div ref={formRef} className="pt-16 pb-16">
            <QuickValuationForm />
          </div>
        </BackgroundPaths>
      </main>
    </>
  )
}

