import React from "react"

export const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden transition-all hover:shadow-lg hover:border-gray-300 ${className}`}>{children}</div>
)

export const CardHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="px-6 py-5 border-b border-gray-100">{children}</div>
) 