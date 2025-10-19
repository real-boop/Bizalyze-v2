import { NextResponse } from "next/server"
import { runAssistant } from "../analyze/analyze-api-assistant"

export async function POST(request: Request) {
  try {
    const { query } = await request.json()
    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }
    const assistantId = process.env.OPENAI_SEARCH_ASSISTANT_ID
    if (!assistantId) {
      return NextResponse.json({ error: "Assistant ID not configured" }, { status: 500 })
    }
    // Call the assistant with the user query
    const result = await runAssistant(assistantId, { query })
    // Expecting result to be { search: "..." }
    if (!result || !result.search) {
      return NextResponse.json({ error: "No cleaned search string returned" }, { status: 500 })
    }
    return NextResponse.json({ search: result.search })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 })
  }
} 