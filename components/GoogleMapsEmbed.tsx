"use client"

interface LocationData {
  state: string
  city?: string | null
  zip?: string | null
  county?: string | null
}

interface BusinessCategory {
  name: string
  display_name: string
}

interface GoogleMapsEmbedProps {
  locationData: LocationData
  businessCategory?: BusinessCategory | null
  className?: string
}

export function GoogleMapsEmbed({ locationData, businessCategory, className = "" }: GoogleMapsEmbedProps) {
  // Build location string from available data
  const buildLocationString = (data: LocationData): string => {
    const parts = []
    if (data.city) parts.push(data.city)
    if (data.county && !data.city) parts.push(data.county)
    if (data.state) parts.push(data.state)
    if (data.zip) parts.push(data.zip)
    return parts.join(", ")
  }

  const location = buildLocationString(locationData)
  
  // Use display_name with fallback to name, or default to "businesses"
  const categorySearchTerm = businessCategory 
    ? (businessCategory.display_name || businessCategory.name)
    : "businesses"
  
  const searchQuery = `${categorySearchTerm} in 25 mile radius near ${location}`
  
  // You'll need to add your Google Maps API key to environment variables
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  
  if (!apiKey) {
    return (
      <div className={`p-4 bg-red-50 dark:bg-red-900/20 rounded-lg ${className}`}>
        <p className="text-red-600 dark:text-red-400">
          Google Maps API key not configured
        </p>
      </div>
    )
  }

  const embedUrl = `https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=${encodeURIComponent(searchQuery)}&zoom=10`

  return (
    <div className={`w-full h-full ${className}`} style={{ minHeight: 300 }}>
      <iframe
        src={embedUrl}
        width="100%"
        height="100%"
        style={{ border: 0, minHeight: 300 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={`${categorySearchTerm} Map`}
        className="rounded-lg shadow-lg w-full h-full"
      />
    </div>
  )
} 