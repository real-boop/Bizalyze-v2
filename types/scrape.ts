export interface ScrapeData {
  url: string
  data: {
    success: boolean
    json: any
  }
  timestamp: string
}

export interface FrontendScrapeResponse {
  url: string
  json: any
  timestamp: string
}

export interface FrontendAnalysisResponse {
  url: string
  json: any
  timestamp: string
} 
