"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const testimonials = [
  {
    quote:
      "My broker wanted over $1,000 to give me a price analysis. I now got the same results for $49.",
    author: "Laura",
    role: "Copy Shop, Seller",
    image: "/laura.png",
  },
  {
    quote:
      "I have worked for over a decade in Commercial Real Estate. Bizfax delivers professional results, at a fraction of the costs.",
    author: "Jonny",
    role: "Real Estate Broker",
    image: "/jonny.png",
  },
  {
    quote:
      "I've been looking for a Laundromat for months. Bizfax saved me $50,000 when I finally found the right one.",
    author: "Sebastian",
    role: "Laundromat, Buyer",
    image: "/sebastian.png",
  },
  {
    quote:
      "Over the last 10 years, I acquired multiple dry cleaning and laundromat businesses. Using Bizfax saves me hours in research.",
    author: "Matt",
    role: "Small Business Investor",
    image: "/matt.png",
  },
  {
    quote:
      "Buying or selling a small business is a painful process. I was negotation-ready in 10 minutes with Bizfax.",
    author: "Connie",
    role: "Restaurant Owner, Seller",
    image: "/connie.png",
  },
  {
    quote:
      "I wish my broker was as fast and reliable as Bizfax is.",
    author: "Craig",
    role: "E-Commerce Shop, Seller",
    image: "/craig.png",
  },
]

export function TestimonialCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // Auto-rotation functionality
  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }, 5000) // 5 seconds per testimonial

    return () => clearInterval(interval)
  }, [isAutoPlaying])

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  const currentTestimonial = testimonials[currentIndex]

  return (
    <div
      className="grid grid-cols-2 gap-6 lg:gap-2 items-center"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Quote Section - Left on desktop, top on mobile */}
      <motion.div
        key={`quote-section-${currentIndex}`}
        className="space-y-4 lg:space-y-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Quote text - Updated font classes to match site typography */}
        <AnimatePresence mode="wait">
          <motion.blockquote
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="text-lg sm:text-xl lg:text-3xl font-bold tracking-tight leading-relaxed"
          >
            {currentTestimonial.quote}
          </motion.blockquote>
        </AnimatePresence>

        {/* Author info - Compact layout */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`author-${currentIndex}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex flex-col gap-1"
          >
            <p className="font-bold text-base lg:text-lg">{currentTestimonial.author}</p>
            <p className="text-sm lg:text-base text-muted-foreground">{currentTestimonial.role}</p>
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={prevTestimonial}
            className="rounded-full size-12 hover:bg-primary hover:text-primary-foreground transition-colors bg-transparent"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextTestimonial}
            className="rounded-full size-12 hover:bg-primary hover:text-primary-foreground transition-colors bg-transparent"
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </motion.div>

      {/* Image Stack - Simplified card rendering and fixed visibility issues */}
      <div className="relative h-[250px] sm:h-[300px] lg:h-[400px] flex items-center justify-center">
        <div className="relative w-full max-w-[200px] sm:max-w-sm lg:max-w-[280px] h-full">
          {testimonials.map((testimonial, index) => {
            const isActive = index === currentIndex
            const offset = index - currentIndex
            const absOffset = Math.abs(offset)

            if (absOffset > 2) return null // Only show nearby cards

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: isActive ? 1 : Math.max(0.2, 0.6 - absOffset * 0.2),
                  scale: isActive ? 1 : 0.9 - absOffset * 0.05,
                  rotateY: offset * 8,
                  rotateZ: offset * 4,
                  x: offset * 15,
                  y: absOffset * 8,
                  zIndex: isActive ? 10 : 10 - absOffset,
                }}
                transition={{
                  duration: 0.5,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-2xl overflow-hidden shadow-xl bg-card border border-border"
                style={{
                  transformStyle: "preserve-3d",
                }}
              >
                <img
                  src={testimonial.image || "/placeholder.svg"}
                  alt={testimonial.author}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="font-bold text-sm">{testimonial.author}</p>
                  <p className="text-xs opacity-90">{testimonial.role}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
