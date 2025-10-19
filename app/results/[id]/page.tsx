"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import BackgroundPaths from "@/components/kokonutui/background-paths"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { JsonDisplay } from "@/components/json-display"
import TopNavBar from '@/components/TopNavBar'

interface ScrapeResponse {
  url: string;
  json: any;
  timestamp: string;
}

export default function ResultsPage() {
  const { id } = useParams() as { id: string }
  const [scrapeData, setScrapeData] = useState<ScrapeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch data from API
        const response = await fetch(`/api/get-scrape?id=${id}`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch scraped data")
        }
        
        const data = await response.json()
        setScrapeData(data)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError(err instanceof Error ? err.message : "Failed to load scraped content")
        toast.error("Failed to load scraped content")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [id])

  if (isLoading) {
    return (
      <BackgroundPaths title="Loading" subtle={true}>
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-lg">Loading scraped content...</p>
          </div>
        </div>
      </BackgroundPaths>
    )
  }

  if (error || !scrapeData) {
    return (
      <BackgroundPaths title="Not Found" subtle={true}>
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-2">Error</h2>
            <p className="text-red-600 dark:text-red-300">{error || "The requested scraped content could not be found."}</p>
            <div className="mt-4">
              <Link href="/">
                <Button>Back to Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </BackgroundPaths>
    )
  }

  // Extract the JSON content from the scrape result
  const jsonContent = scrapeData.json || {}

  return (
    <>
      <TopNavBar />
      <BackgroundPaths title="Scraping Results" subtle={true}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-4xl mx-auto"
        >
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">
              Business Listing
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/">
                <Button variant="outline" size="sm">
                  Back to Home
                </Button>
              </Link>
              <Button
                size="sm"
                onClick={async () => {
                  setAnalyzing(true);
                  try {
                    const res = await fetch('/api/analyze', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      toast.success('Analysis started and stored!');
                      // Redirect to dashboard after successful analysis
                      window.location.href = `/dashboard/${id}`;
                    } else {
                      toast.error(data.error || 'Failed to start analysis');
                      setAnalyzing(false);
                    }
                  } catch (err) {
                    toast.error('Network error');
                    setAnalyzing(false);
                  }
                }}
              >
                Analyze
              </Button>
            </div>
          </div>

          <div className="bg-blue-50/70 dark:bg-blue-900/20 backdrop-blur-md border border-blue-100/50 dark:border-blue-700/30 rounded-xl shadow-lg p-4 md:p-6">
            <JsonDisplay content={jsonContent} initialMaxHeight={400} />
          </div>
          {analyzing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-lg p-8 flex flex-col items-center shadow-lg">
                <svg className="animate-spin h-8 w-8 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                <span className="text-gray-700 font-medium">Analysis in progress…</span>
              </div>
            </div>
          )}
        </motion.div>
      </BackgroundPaths>
    </>
  )
}
