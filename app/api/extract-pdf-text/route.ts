import { NextResponse } from "next/server";
import OpenAI from "openai";
import logger from '@/lib/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Extraction prompt - validates and extracts business listing text
const EXTRACTION_PROMPT = `You are a data extraction specialist for business listings and valuations. You receive PDFs in base64 format and need to parse all information from the input.

Your task:

1. Verify this PDF contains information about a business for sale or valuation (laundromat, retail store, restaurant, etc.). Valid inputs contain financial data (e.g. asking price, revenue) and/or location, business description, or operations details. Missing data is okay if the overall topic is clearly about a business that could be for sale.

2. If valid: Extract ALL text content from all pages. Return ONLY the raw extracted text, preserving line breaks and structure where possible. No additional commentary, analysis, or explanations.

3. If NOT a business listing (e.g., invoice, personal contract, random document): Return exactly "INVALID_BUSINESS_LISTING"

Aim to capture all information from the PDF, including all text from tables and structured data. Extract text from chart labels or diagram annotations where present. Preserve formatting and structure where possible.`;

export async function POST(request: Request) {
  try {
    const { pdfBase64, filename } = await request.json();

    if (!pdfBase64) {
      return NextResponse.json(
        { error: "PDF data is required" },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const base64Size = (pdfBase64.length * 3) / 4; // Approximate size in bytes
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (base64Size > maxSize) {
      return NextResponse.json(
        { error: "PDF file is too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    logger.debug('Starting PDF text extraction', {
      filename: filename || 'unknown',
      base64Length: pdfBase64.length,
      estimatedSizeMB: (base64Size / 1024 / 1024).toFixed(2)
    });

    // Prepare base64 data with data URL prefix
    const fileData = pdfBase64.startsWith('data:application/pdf;base64,')
      ? pdfBase64
      : `data:application/pdf;base64,${pdfBase64}`;

    // Call OpenAI Responses API with PDF input
    const response = await openai.responses.create({
      model: "gpt-4o", // Supports PDF inputs
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: filename || "business-listing.pdf",
              file_data: fileData,
            },
            {
              type: "input_text",
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
      store: false,
    });

    // Extract text from response
    let extractedText = "";
    
    // Try output_text property first
    if ((response as any).output_text) {
      extractedText = (response as any).output_text;
    } 
    // Otherwise parse output array
    else if ((response as any).output && Array.isArray((response as any).output)) {
      for (const item of (response as any).output) {
        if (item.type === "message" && item.role === "assistant") {
          if (item.content && Array.isArray(item.content)) {
            for (const contentItem of item.content) {
              if (contentItem.type === "output_text" && contentItem.text) {
                extractedText += contentItem.text;
              }
            }
          }
        }
      }
    }

    if (!extractedText) {
      logger.error('No text extracted from PDF', {
        response: JSON.stringify(response, null, 2)
      });
      return NextResponse.json(
        { error: "We are having issues processing this PDF" },
        { status: 500 }
      );
    }

    // AI-based validation: Check if extraction indicates invalid business listing
    if (extractedText.trim() === "INVALID_BUSINESS_LISTING") {
      logger.debug('PDF validation failed - AI determined not a business listing');
      return NextResponse.json(
        { error: "This doesn't seem to be a business listing. Please check your file." },
        { status: 400 }
      );
    }

    // Truncate to 7500 characters if needed
    const finalText = extractedText.length > 7500 
      ? extractedText.substring(0, 7500) 
      : extractedText;

    logger.debug('PDF extraction successful', {
      extractedLength: finalText.length,
      wasTruncated: extractedText.length > 7500
    });

    return NextResponse.json({
      extractedText: finalText,
      wasTruncated: extractedText.length > 7500
    });

  } catch (error: any) {
    logger.error('PDF extraction error', {
      errorMessage: error?.message,
      errorStack: error?.stack,
      errorStatus: error?.status
    });

    // Handle specific OpenAI errors
    if (error?.status === 400 || error?.message?.includes('file')) {
      return NextResponse.json(
        { error: "We are having issues processing this PDF" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "We are having issues processing this PDF" },
      { status: 500 }
    );
  }
}

