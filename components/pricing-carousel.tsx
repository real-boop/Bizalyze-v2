"use client"

import { useState } from "react"
import { motion, useMotionValue, useTransform } from "framer-motion"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface PricingPlan {
  id: string
  title: string
  description: string
  price: string
  priceUnit: string
  badge?: string
  buttonText: string
  buttonVariant: "default" | "outline"
  features: string[]
  isPopular?: boolean
}

interface PricingCarouselProps {
  plans: PricingPlan[]
  selectedPlan: string | null
  onPlanSelect: (planId: string) => void
}

interface SwipeablePricingCardProps {
  plan: PricingPlan
  isFront: boolean
  isSelected: boolean
  onPlanSelect: (planId: string) => void
  onNavigate: (direction: "left" | "right") => void
  cardPosition: number // -1, 0, 1 for previous, current, next
}

const SwipeablePricingCard = ({ 
  plan, 
  isFront, 
  isSelected, 
  onPlanSelect, 
  onNavigate,
  cardPosition
}: SwipeablePricingCardProps) => {
  const x = useMotionValue(0)
  const rotateRaw = useTransform(x, [-150, 150], [-18, 18])
  const opacity = useTransform(x, [-150, 0, 150], [0, 1, 0])

  // Restore the original dynamic angle logic for front card
  const rotate = useTransform(() => {
    if (isFront) {
      // Give front card a slight base rotation that changes per plan (deterministic but dynamic-looking)
      const baseRotation = ((plan.id.charCodeAt(0) + plan.id.charCodeAt(plan.id.length - 1)) % 7) - 3 // -3 to 3 degrees
      return `${rotateRaw.get() + baseRotation}deg`
    } else {
      // Background cards have fixed rotation based on their position
      const offset = cardPosition === -1 ? -6 : 6 // Previous card tilts left, next tilts right
      return `${offset}deg`
    }
  })

  const handleDragEnd = () => {
    if (Math.abs(x.get()) > 100) {
      if (x.get() > 0) {
        onNavigate("left")
      } else {
        onNavigate("right")
      }
    }
  }

  return (
    <motion.div
      className="absolute w-[280px] h-[450px] origin-bottom cursor-grab active:cursor-grabbing rounded-lg"
      style={{
        x,
        opacity: isFront ? opacity : 0.6, // Background cards are more visible now
        rotate,
        transition: "0.125s transform",
        boxShadow: isFront
          ? "0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)"
          : "0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -2px rgb(0 0 0 / 0.2)",
        zIndex: isFront ? 3 : (cardPosition === 1 ? 2 : 1), // Proper stacking order
      }}
      animate={{
        scale: isFront ? 1 : 0.95, // More visible background cards
      }}
      drag={isFront ? "x" : false}
      dragConstraints={{
        left: 0,
        right: 0,
      }}
      onDragEnd={handleDragEnd}
      onClick={() => {
        if (isFront) {
          onPlanSelect(isSelected ? "" : plan.id)
        }
      }}
    >
      <div className={`relative overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:ring-2 hover:ring-blue-200 ${
        isSelected ? "ring-2 ring-blue-500 bg-blue-50/50" : ""
      } ${plan.isPopular ? "ring-2 ring-primary" : ""} w-full h-full`}>
        {plan.badge && (
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
            <Badge className="rounded-b-md px-3 py-1">{plan.badge}</Badge>
          </div>
        )}
        <div className={`p-6 ${plan.badge ? "pt-8" : ""} h-full flex flex-col`}>
          <h3 className="text-2xl font-bold">{plan.title}</h3>
          <p className="text-muted-foreground mt-2">{plan.description}</p>
          <div className="mt-4">
            <span className="text-4xl font-bold">{plan.price}</span>
            <span className="text-muted-foreground">{plan.priceUnit}</span>
          </div>
          {plan.buttonText === "Get Started" ? (
            <Link href="/start">
              <Button
                size="lg"
                variant={plan.buttonVariant}
                className="w-full mt-6 rounded-full h-12 px-8 text-base"
              >
                {plan.buttonText}
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              variant={plan.buttonVariant}
              className="w-full mt-6 rounded-full h-12 px-8 text-base"
            >
              {plan.buttonText}
            </Button>
          )}
          <ul className="mt-6 space-y-3 flex-1">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-center">
                <Check className="size-4 text-primary mr-3 flex-shrink-0" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        {isSelected && (
          <div className="absolute top-2 right-2">
            <Check className="w-6 h-6 text-green-500" />
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function PricingCarousel({ plans, selectedPlan, onPlanSelect }: PricingCarouselProps) {
  // Find the popular plan index to start there, fallback to 0 if no popular plan
  const popularIndex = plans.findIndex(plan => plan.isPopular)
  const [currentIndex, setCurrentIndex] = useState(popularIndex !== -1 ? popularIndex : 0)

  const navigateToPlan = (direction: "left" | "right") => {
    if (direction === "left") {
      setCurrentIndex((prev) => (prev - 1 + plans.length) % plans.length)
    } else {
      setCurrentIndex((prev) => (prev + 1) % plans.length)
    }
  }

  const renderPricingCard = (plan: PricingPlan, isCenter: boolean = true) => {
    const isSelected = selectedPlan === plan.id

    return (
      <motion.div
        key={plan.id}
        className={`relative overflow-hidden rounded-lg border bg-card shadow-sm cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:ring-2 hover:ring-blue-200 ${
          isSelected ? "ring-2 ring-blue-500 bg-blue-50/50" : ""
        } ${plan.isPopular ? "ring-2 ring-primary" : ""}`}
        onClick={() => onPlanSelect(isSelected ? "" : plan.id)}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        {plan.badge && (
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
            <Badge className="rounded-b-md px-3 py-1">{plan.badge}</Badge>
          </div>
        )}
        <div className={`p-6 ${plan.badge ? "pt-8" : ""}`}>
          <h3 className="text-2xl font-bold">{plan.title}</h3>
          <p className="text-muted-foreground mt-2">{plan.description}</p>
          <div className="mt-4">
            <span className="text-4xl font-bold">{plan.price}</span>
            <span className="text-muted-foreground">{plan.priceUnit}</span>
          </div>
          {plan.buttonText === "Get Started" ? (
            <Link href="/start">
              <Button
                size="lg"
                variant={plan.buttonVariant}
                className="w-full mt-6 rounded-full h-12 px-8 text-base"
              >
                {plan.buttonText}
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              variant={plan.buttonVariant}
              className="w-full mt-6 rounded-full h-12 px-8 text-base"
            >
              {plan.buttonText}
            </Button>
          )}
          <ul className="mt-6 space-y-3">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-center">
                <Check className="size-4 text-primary mr-3 flex-shrink-0" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        {isSelected && (
          <div className="absolute top-2 right-2">
            <Check className="w-6 h-6 text-green-500" />
          </div>
        )}
      </motion.div>
    )
  }

  // Helper function to get plan at specific offset from current
  const getPlanAt = (offset: number) => {
    const index = (currentIndex + offset + plans.length) % plans.length
    return plans[index]
  }

  return (
    <div className="w-full">
      {/* Desktop Grid Layout */}
      <div className="hidden lg:grid gap-6 lg:grid-cols-3 lg:gap-8">
        {plans.map((plan) => renderPricingCard(plan, true))}
      </div>

      {/* Mobile Carousel Layout */}
      <div className="lg:hidden">
        {/* Swipeable Cards Container */}
        <div className="relative h-[550px] w-full flex items-center justify-center">
          {/* Previous card (background, tilted left) */}
          <SwipeablePricingCard
            plan={getPlanAt(-1)}
            isFront={false}
            isSelected={selectedPlan === getPlanAt(-1).id}
            onPlanSelect={onPlanSelect}
            onNavigate={navigateToPlan}
            cardPosition={-1}
          />
          
          {/* Next card (background, tilted right) */}
          <SwipeablePricingCard
            plan={getPlanAt(1)}
            isFront={false}
            isSelected={selectedPlan === getPlanAt(1).id}
            onPlanSelect={onPlanSelect}
            onNavigate={navigateToPlan}
            cardPosition={1}
          />
          
          {/* Current card (front, can rotate with drag) */}
          <SwipeablePricingCard
            plan={getPlanAt(0)}
            isFront={true}
            isSelected={selectedPlan === getPlanAt(0).id}
            onPlanSelect={onPlanSelect}
            onNavigate={navigateToPlan}
            cardPosition={0}
          />
        </div>

        {/* Navigation Arrows */}
        <div className="flex gap-2 justify-center mt-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateToPlan("left")}
            className="rounded-full size-12 hover:bg-primary hover:text-primary-foreground transition-colors bg-transparent"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateToPlan("right")}
            className="rounded-full size-12 hover:bg-primary hover:text-primary-foreground transition-colors bg-transparent"
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center mt-6 space-x-2">
          {plans.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? "bg-primary" : "bg-muted"
              }`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}