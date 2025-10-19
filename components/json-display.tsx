"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface JsonDisplayProps {
  content: any
  initialMaxHeight?: number
}

export function JsonDisplay({ content, initialMaxHeight = 300 }: JsonDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const formattedJson = JSON.stringify(content, null, 2)

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="relative">
      <pre
        className={`bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-auto text-sm ${
          !isExpanded ? "max-h-[300px]" : ""
        }`}
        style={{ maxHeight: isExpanded ? "none" : `${initialMaxHeight}px` }}
      >
        <code className="text-gray-800 dark:text-gray-200">{formattedJson}</code>
      </pre>
      
      {formattedJson.length > 500 && (
        <div className="mt-2 text-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleExpand}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            {isExpanded ? "Show Less" : "Show More"}
          </Button>
        </div>
      )}
    </div>
  )
} 