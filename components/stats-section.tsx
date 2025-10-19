"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"

interface StatItemProps {
  value: string
  label: string
  delay?: number
}

function StatItem({ value, label, delay = 0 }: StatItemProps) {
  const [count, setCount] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Extract numeric value and suffix
  const numericValue = Number.parseInt(value.replace(/[^\d]/g, ""))
  const suffix = value.replace(/[\d,]/g, "")

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)

          // Animate counter
          const duration = 2000 // 2 seconds
          const steps = 60
          const increment = numericValue / steps
          let current = 0

          const timer = setInterval(() => {
            current += increment
            if (current >= numericValue) {
              setCount(numericValue)
              clearInterval(timer)
            } else {
              setCount(Math.floor(current))
            }
          }, duration / steps)

          return () => clearInterval(timer)
        }
      },
      { threshold: 0.5 },
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [numericValue, hasAnimated])

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="text-center"
    >
      <div className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-500 to-teal-500 bg-clip-text text-transparent mb-2">
        {formatNumber(count)}
        {suffix}
      </div>
      <div className="text-sm md:text-base text-muted-foreground font-medium">{label}</div>
    </motion.div>
  )
}

export default function StatsSection() {
  const stats = [
    { value: "2,800+", label: "Businesses analyzed" },
    { value: "50+", label: "Factors considered" },
    { value: "25+", label: "Business types" },
    { value: "400+", label: "Avg. deal value ($K)" },
  ]

  return (
    <section className="w-full py-8 md:py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((stat, index) => (
            <StatItem key={stat.label} value={stat.value} label={stat.label} delay={index * 0.1} />
          ))}
        </div>
      </div>
    </section>
  )
}
