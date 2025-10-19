import OpenAI from "openai";

export type TranslatedSearchObject = {
  bizben: {
    state: string;
    subcategory: string;
    maxItems: number;
  };
  bizbuysell: {
    state: string;
    businessType: string;
    maxItems: number;
  };
  businessesforsale: {
    state: string;
    businessType: string;
    maxPages: number;
  };
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SEARCH_TRANSLATOR_ASSISTANT_ID = process.env.OPENAI_SEARCH_TRANSLATOR_ASSISTANT_ID;

// Helper: Extract first JSON object from a string
function extractFirstJsonObject(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

/**
 * Calls the OpenAI Assistant to translate a cleaned query into the required schema for all scrapers.
 * Logs the raw response, extracted JSON, and parsed object for debugging.
 */
export async function translateSearchQuery(cleanedQuery: string): Promise<TranslatedSearchObject> {
  if (!SEARCH_TRANSLATOR_ASSISTANT_ID) {
    throw new Error("OPENAI_SEARCH_TRANSLATOR_ASSISTANT_ID is not set in environment variables.");
  }
  // Create a thread
  const thread = await openai.beta.threads.create();
  // Add the cleaned query as the user message
  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: cleanedQuery,
  });
  // Run the assistant
  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: SEARCH_TRANSLATOR_ASSISTANT_ID,
  });
  // Poll for completion
  let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
  let attempts = 0;
  const maxAttempts = 30;
  while (runStatus.status !== "completed" && attempts < maxAttempts) {
    if (["failed", "cancelled", "expired"].includes(runStatus.status)) {
      throw new Error(`Run ${runStatus.status}: ${runStatus.last_error?.message || "Unknown error"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    attempts++;
  }
  if (attempts >= maxAttempts) {
    throw new Error("Search translation timed out");
  }
  // Get the last assistant message
  const messages = await openai.beta.threads.messages.list(thread.id);
  const assistantMessages = messages.data.filter((msg) => msg.role === "assistant");
  if (assistantMessages.length === 0) {
    throw new Error("No assistant messages found");
  }
  const lastMessage = assistantMessages[0];
  let content = "";
  if (lastMessage.content && lastMessage.content.length > 0) {
    const textContent = lastMessage.content.find((item) => item.type === "text");
    if (textContent && "text" in textContent) {
      content = textContent.text.value;
    }
  }
  if (!content) {
    throw new Error("No text content found in assistant message");
  }
  // Extract JSON from content
  const jsonString = extractFirstJsonObject(content);
  if (!jsonString) {
    console.error('[SearchTranslator] Could not extract JSON from assistant response:', content);
    throw new Error('Assistant response does not contain a JSON object');
  }
  // Parse as JSON
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    console.error('[SearchTranslator] Failed to parse extracted JSON:', jsonString);
    throw new Error("Assistant response is not valid JSON");
  }
  return parsed;
} 