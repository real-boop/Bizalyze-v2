"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import type { ReactNode } from "react"

function FloatingPaths({ position, opacity = 0.1 }: { position: number; opacity?: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    color: `rgba(15,23,42,${opacity + i * 0.01})`,
    width: 0.5 + i * 0.02,
  }))

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full text-slate-300 dark:text-gray-700" viewBox="0 0 696 316" fill="none">
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={opacity + path.id * 0.01}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  )
}

interface BackgroundPathsProps {
  title?: string
  children?: ReactNode
  subtle?: boolean
  className?: string
  showLogo?: boolean
  noCenter?: boolean // Add this prop
}

export default function BackgroundPaths({
  title = "Background Paths",
  children,
  subtle = false,
  className = "",
  showLogo = false,
  noCenter = false, // Add this prop
}: BackgroundPathsProps) {
  return (
    <div
      className={`relative min-h-screen w-full ${noCenter ? '' : 'flex items-center justify-center'} overflow-hidden bg-white dark:bg-neutral-950 ${className}`}
    >
      <div className="absolute inset-0">
        <FloatingPaths position={1} opacity={subtle ? 0.03 : 0.1} />
        <FloatingPaths position={-1} opacity={subtle ? 0.03 : 0.1} />
      </div>

      <div className={`relative z-10 container mx-auto px-4 md:px-6 ${noCenter ? 'pt-0' : 'py-8 md:py-12'}`}>
        {showLogo && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl mx-auto mb-12"
          >
            <div className="relative w-full aspect-[16/9] overflow-hidden rounded-lg shadow-xl bg-white/5 backdrop-blur-sm">
              <Image
                src="/header-image.png"
                alt="Laundrolyzer Header"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
                className="object-cover hover:scale-105 transition-transform duration-500 opacity-50"
                priority
              />
            </div>
          </motion.div>
        )}

        {title && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto text-center mb-8 md:mb-12"
          >
            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-500 dark:from-blue-400 dark:to-green-400"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {title}
            </motion.h1>
          </motion.div>
        )}

        {children}
      </div>
    </div>
  )
}

