import { NextResponse } from "next/server"
import OpenAI from "openai"
import { supabaseAdmin } from "@/lib/supabase"
import logger from '@/lib/logger'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const BUSINESS_SCORE_ASSISTANT_ID = process.env.OPENAI_BUSINESS_SCORE_ASSISTANT_ID
export const RECOMMENDATION_ASSISTANT_ID = process.env.OPENAI_RECOMMENDATION_ASSISTANT_ID

// Lightweight validation for business analysis
function validateBusinessAnalysis(data: any): boolean {
  // Example: check for a few required fields, add more as needed
  return (
    typeof data === "object" &&
    data.businessMetrics &&
    typeof data.businessMetrics.askingPrice !== "undefined" &&
    data.scoringAnalysis &&
    data.scoringAnalysis.totalScore
  )
}

// Lightweight validation for recommendation
function validateRecommendation(data: any): boolean {
  // Example: check for a few required fields, add more as needed
  return (
    typeof data === "object" &&
    (data.verdict || data.idealRangeLow || data.strengths)
  )
}

// Helper: Extract first JSON object from a string
function extractFirstJsonObject(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

async function runAssistant(promptId: string, scrapeData: any) {
  try {
    logger.debug('OpenAI API call started', { promptId });

    const response = await openai.responses.create({
      model: "gpt-4.1",
      prompt: { id: promptId },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(scrapeData, null, 2)
            }
          ]
        }
      ],
      store: false,
    });

    // Extract text from response output items
    let content = "";
    
    if ((response as any).output && Array.isArray((response as any).output)) {
      for (const item of (response as any).output) {
        if (item.type === "message" && item.role === "assistant") {
          if (item.content && Array.isArray(item.content)) {
            for (const contentItem of item.content) {
              if (contentItem.type === "output_text" && contentItem.text) {
                content += contentItem.text;
              }
            }
          }
        }
      }
    } else {
      if ((response as any).output_text) {
        content = (response as any).output_text;
      }
    }

    if (!content) {
      logger.debug('OpenAI API: No content in response');
      throw new Error("No content in OpenAI response");
    }
    
    // Extract JSON from content
    const jsonString = extractFirstJsonObject(content);
    
    if (!jsonString) {
      logger.debug('OpenAI API: No JSON found in response');
      throw new Error('Response does not contain a JSON object');
    }
    
    // Parse as JSON
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
      logger.debug('OpenAI API call completed', { promptId, responseSize: content.length });
    } catch (e: any) {
      logger.debug('OpenAI API: JSON parse failed', { error: e?.message });
      throw new Error(`Response is not valid JSON: ${e?.message}`);
    }
    
    return parsed;
  } catch (error: any) {
    logger.debug('OpenAI API call failed', { 
      promptId, 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}

// --- Perplexity Demographics Integration ---
async function runPerplexityDemographics(businessId: string, location: { state: string, city?: string | null, county?: string | null, zip?: string | null }) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured. Check your environment variables.");
  }
  if (!location.state) {
    throw new Error("State is required for demographics analysis")
  }
  logger.debug('[Perplexity][Demographics] Sending location:', location);
  const demographicsJsonSchema = {
    type: "object",
    properties: {
      location: {
        type: "object",
        properties: {
          state: { type: "string" },
          city: { type: ["string", "null"] },
          zip: { type: ["string", "null"] },
          county: { type: ["string", "null"] }
        },
        required: ["state", "city", "zip", "county"]
      },
      coreMetrics: {
        type: "object",
        properties: {
          medianIncome: { type: "number" },
          medianAge: { type: "number" },
          populationDensity: { type: "number" },
          homeOwnershipRate: { type: "number" }
        },
        required: ["medianIncome", "medianAge", "populationDensity", "homeOwnershipRate"]
      },
      populationComposition: {
        type: "object",
        properties: {
          ethnicityDistribution: {
            type: "object",
            properties: {
              whiteCaucasian: { type: "number" },
              hispanicLatino: { type: "number" },
              blackAfricanAmerican: { type: "number" },
              asian: { type: "number" },
              other: { type: "number" }
            },
            required: ["whiteCaucasian", "hispanicLatino", "blackAfricanAmerican", "asian", "other"]
          },
          householdIncomeDistribution: {
            type: "object",
            properties: {
              under50k: { type: "number" },
              from50kTo100k: { type: "number" },
              from100kTo150k: { type: "number" },
              from150kTo200k: { type: "number" },
              over200k: { type: "number" }
            },
            required: ["under50k", "from50kTo100k", "from100kTo150k", "from150kTo200k", "over200k"]
          }
        },
        required: ["ethnicityDistribution", "householdIncomeDistribution"]
      },
      economicIndicators: {
        type: "object",
        properties: {
          medianHouseValue: { type: "number" },
          medianRent: { type: "number" },
          employmentRate: { type: "number" }
        },
        required: ["medianHouseValue", "medianRent", "employmentRate"]
      }
    },
    required: [
      "location",
      "coreMetrics",
      "populationComposition",
      "economicIndicators"
    ]
  };
  const systemPrompt = `You are a US demographics analyzer providing accurate location profiles for business decision-making.\n\nWhen given a US location (State, City, ZIP, and/or County), perform a live web search for the most recent demographics data.\n\nIf location components are missing, use the closest available alternative (county, metro area, state) to supplement and approximate for missing data and get results. If no finer granularity is available, go for data on state-level, but generally use the most specific location available (ZIP > City > County > State).\n\nUse reputable / official sources (US Census Bureau, BLS, etc.) and the most recent reliable data available. Round all percentages to one decimal place. Format dollar amounts as whole numbers without commas or $ signs.\n\nYou are expected to always find and fill all requested datapoints as they are widely available. You never make data up, it is imperative to always research factual, recent data and analyze it diligently. If data should really be unavailable, use "null".\n\nYou provide your analysis in a structured JSON report. Do not add explanations or commentary, only respond in the exact schema format.\n\nMetric definitions:\nAll metrics should be looked up for the most granular location based on input data.\nMedian income = Median household income (Census)\nMedian age = Age at the midpoint of the population distribution (Census)\nPopulation density = Total population per square mile (Census, UN, World Data)\nHome ownership rate = Owner-occupied housing units / total occupied housing units × 100 (Census)\nEthnicity distribution = Population by declared race/ethnicity categories (Census)\nHousehold income distribution = Percentage of households in defined income brackets (Census, IRS, BEA)\nMedian house value = median sales price of houses (NAR, Realtor.com, Census)\nMedian rent = Median gross rent for rental units (Census) or median asking rent (Realtor.com, Rent.com)\nEmployment rate = Employment-population ratio = employed persons / total civilian population aged × 100 (BLS, Census)`;
  const userPrompt = JSON.stringify(location, null, 2);
  let result;
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 8000,
        temperature: 0.2,
        top_p: 0.9,
        web_search_options: { search_context_size: "high" },
        response_format: {
          type: "json_schema",
          json_schema: { schema: demographicsJsonSchema }
        },
        stream: false
      })
    });
    const text = await response.text();
    let apiResponse;
    try {
      apiResponse = JSON.parse(text);
    } catch (err) {
      logger.error("[Perplexity][Demographics] Non-JSON response:", text);
      throw new Error(`Perplexity returned non-JSON: ${text.slice(0, 200)}`);
    }
    // Extract the schema from choices[0].message.content
    let schemaResult;
    try {
      const content = apiResponse.choices?.[0]?.message?.content;
      schemaResult = typeof content === 'string' ? JSON.parse(content) : null;
    } catch (e) {
      logger.error('[Perplexity][Demographics] Failed to parse schema from content:', e, apiResponse);
      throw new Error('Perplexity response did not contain valid JSON schema');
    }
    logger.debug('[Perplexity][Demographics] Parsed schema result:', schemaResult);
    if (!schemaResult || !schemaResult.location || !schemaResult.location.state) {
      logger.error('[Perplexity][Demographics] Missing location or state in parsed schema:', schemaResult);
      throw new Error('Perplexity response missing location or state');
    }
    result = schemaResult;
  } catch (err: any) {
    await supabaseAdmin.from("demographics").insert({
      business_id: businessId,
      state: location.state,
      city: location.city ?? null,
      county: location.county ?? null,
      zip: location.zip ?? null,
      demographics_status: "failed",
      raw_response: null
    });
    throw err;
  }
  // Map Perplexity response to demographics table
  const demographics = {
    business_id: businessId,
    state: result.location.state,
    city: result.location.city ?? null,
    county: result.location.county ?? null,
    zip: result.location.zip ?? null,
    median_income: result.coreMetrics.medianIncome,
    median_age: result.coreMetrics.medianAge,
    population_density: result.coreMetrics.populationDensity,
    homeownership_rate: result.coreMetrics.homeOwnershipRate,
    ethnicity_distribution: result.populationComposition.ethnicityDistribution,
    household_income_distribution: result.populationComposition.householdIncomeDistribution,
    median_house_value: result.economicIndicators.medianHouseValue,
    median_rent: result.economicIndicators.medianRent,
    employment_rate: result.economicIndicators.employmentRate,
    raw_response: result,
    demographics_status: "complete"
  };
  // Insert into demographics table
  const { error } = await supabaseAdmin.from("demographics").insert(demographics);
  if (error) {
    throw new Error(`Failed to insert demographics: ${error.message}`);
  }
  return demographics;
}

// --- Perplexity Competition Analysis Integration ---
async function runPerplexityCompetition(businessId: string, location: { state: string, city?: string | null, county?: string | null, zip?: string | null }) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured. Check your environment variables.");
  }
  if (!location.state) {
    throw new Error("State is required for competition analysis")
  }
  logger.debug('[Perplexity][Competition] Sending location:', location);
  const JsonSchema = {
    type: "object",
    properties: {
      location: {
        type: "object",
        properties: {
          state: { type: "string" },
          city: { type: ["string", "null"] },
          zip: { type: ["string", "null"] },
          county: { type: ["string", "null"] }
        },
        required: ["state", "city", "zip", "county"]
      },
      demographics: {
        type: "object",
        properties: {
          population: {
            type: "object",
            properties: {
              current: { type: "number" },
              yoy_change: { type: "number" },
              five_year_change: { type: "number" }
            },
            required: ["current", "yoy_change", "five_year_change"]
          },
          crime: {
            type: "object",
            properties: {
              property_crime_rate: {
                type: "object",
                properties: {
                  location: { type: "number" },
                  state: { type: "number" }
                },
                required: ["location", "state"]
              },
              violent_crime_rate: {
                type: "object",
                properties: {
                  location: { type: "number" },
                  state: { type: "number" }
                },
                required: ["location", "state"]
              }
            },
            required: ["property_crime_rate", "violent_crime_rate"]
          },
          economics: {
            type: "object",
            properties: {
              cost_of_living_index: {
                type: "object",
                properties: {
                  location: { type: "number" },
                  state: { type: "number" }
                },
                required: ["location", "state"]
              },
              retail_sales_per_capita: {
                type: "object",
                properties: {
                  location: { type: "number" },
                  state: { type: "number" }
                },
                required: ["location", "state"]
              }
            },
            required: ["cost_of_living_index", "retail_sales_per_capita"]
          }
        },
        required: ["population", "crime", "economics"]
      },
      business_climate: {
        type: "object",
        properties: {
          laundromat_count: { type: "number" },
          sentiment: {
            type: "object",
            properties: {
              average_rating: { type: "number" },
              summary: { type: "string" },
              frequent_terms: {
                type: "array",
                items: { type: "string" }
              },
              negative_summary: { type: "string" },
              negative_terms: {
                type: "array", 
                items: { type: "string" }
              }
            },
            required: ["average_rating", "summary", "frequent_terms", "negative_summary", "negative_terms"]
          }
        },
        required: ["laundromat_count", "sentiment"]
      }
    },
    required: [
      "location",
      "demographics", 
      "business_climate"
    ]
  };
  const systemPrompt = `You are a US demographics and location analyzer providing accurate location profiles for business decision-making. We are analyzing laundromats.\n\nWhen given a US location (State, City, ZIP, and/or County), perform a live web search for the most recent data.\nIf location components are missing, use the closest available alternative (county, metro area, state) to supplement and approximate for missing data and get results. Aim to be as granular as possible. If no finer granularity is available, go for data on state-level. \nUse reputable / official sources and prioritize the most recent reliable data available. Good data sources are e.g. US Census Bureau, Bureau of Labor Statistics, FBI Crime Statistics, state/county government websites or reputable sources like AreaVibes, BestPlaces, City-Data. Round all percentages to one decimal place. Format dollar amounts as whole numbers without commas or $ signs. All numeric values should be numbers, not strings.\n\nREQUIRED METRICS AND CALCULATIONS\n\nLocation Quality Metrics\nPopulation Change (Census)\n  - YoY: Calculate (2024 population - 2023 population) / 2023 population * 100\n  - 5Y: Calculate (2024 population - 2019 population) / 2019 population * 100\n\nEconomics\nProperty Crime Rate: incidents per 100,000 people (USAFacts, FBI, DOJ)\nViolent Crime Rate: incidents per 100,000 people (FBI, DOJ, CCJ)\nPurchasing Power: Cost of Living Index (100 = US average) (MERIC - meric.mo.gov)\nRetail Sales Per Capita: Total annual retail sales / population (Use US Census Bureau Annual Retail Trade Survey data)\n\nInclude both location rate and state rate for crime rates, purchasing power and retail sales per capita.\n\nBusiness Metrics\nBusiness Count: Total number of laundromats in the location\nSentiment Analysis\nAverage Rating: Calculate average ratings across Google Maps and Yelp\nOverall Sentiment: One sentence summary and 3-5 top mentioned terms.\nNegative Feedback: One sentence summary of main complaints. One sentence summary and 3-5 top negative terms\n\nYou are expected to always find and fill all requested datapoints as they are widely available. You never make data up, it is imperative to always research factual, recent data and analyze it diligently. If data should really be unavailable, use "null".\nYou provide your analysis in a structured JSON report. Do not add explanations or commentary, only respond in the exact schema format.`;
  const userPrompt = JSON.stringify(location, null, 2);
  let result;
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 8000,
        temperature: 0.2,
        top_p: 0.9,
        web_search_options: { search_context_size: "high" },
        response_format: {
          type: "json_schema",
          json_schema: { schema: JsonSchema }
        },
        stream: false
      })
    });
    const text = await response.text();
    let apiResponse;
    try {
      apiResponse = JSON.parse(text);
    } catch (err) {
      logger.error("[Perplexity][Competition] Non-JSON response:", text);
      throw new Error(`Perplexity returned non-JSON: ${text.slice(0, 200)}`);
    }
    // Extract the schema from choices[0].message.content
    let schemaResult;
    try {
      const content = apiResponse.choices?.[0]?.message?.content;
      schemaResult = typeof content === 'string' ? JSON.parse(content) : null;
    } catch (e) {
      logger.error('[Perplexity][Competition] Failed to parse schema from content:', e, apiResponse);
      throw new Error('Perplexity response did not contain valid JSON schema');
    }
    logger.debug('[Perplexity][Competition] Parsed schema result:', schemaResult);
    if (!schemaResult || !schemaResult.location || !schemaResult.location.state) {
      logger.error('[Perplexity][Competition] Missing location or state in parsed schema:', schemaResult);
      throw new Error('Perplexity response missing location or state');
    }
    result = schemaResult;
  } catch (err: any) {
    await supabaseAdmin.from("competition_analysis").insert({
      business_id: businessId,
      location_state: location.state,
      location_city: location.city ?? null,
      location_county: location.county ?? null,
      location_zip: location.zip ?? null,
      competition_status: "failed",
      raw_response: null
    });
    throw err;
  }
  // Map Perplexity response to competition_analysis table
  const competition = {
    business_id: businessId,
    location_state: result.location.state,
    location_city: result.location.city ?? null,
    location_county: result.location.county ?? null,
    location_zip: result.location.zip ?? null,
    current_population: result.demographics.population.current,
    yoy_change: result.demographics.population.yoy_change,
    five_year_change: result.demographics.population.five_year_change,
    property_crime_rate_location: result.demographics.crime.property_crime_rate.location,
    property_crime_rate_state: result.demographics.crime.property_crime_rate.state,
    violent_crime_rate_location: result.demographics.crime.violent_crime_rate.location,
    violent_crime_rate_state: result.demographics.crime.violent_crime_rate.state,
    cost_of_living_index_location: result.demographics.economics.cost_of_living_index.location,
    cost_of_living_index_state: result.demographics.economics.cost_of_living_index.state,
    retail_sales_per_capita_location: result.demographics.economics.retail_sales_per_capita.location,
    retail_sales_per_capita_state: result.demographics.economics.retail_sales_per_capita.state,
    laundromat_count: result.business_climate.laundromat_count,
    average_rating: result.business_climate.sentiment.average_rating,
    sentiment_summary: result.business_climate.sentiment.summary,
    frequent_terms: result.business_climate.sentiment.frequent_terms,
    negative_summary: result.business_climate.sentiment.negative_summary,
    negative_terms: result.business_climate.sentiment.negative_terms,
    raw_response: result,
    competition_status: "complete"
  };
  // Insert into competition_analysis table
  const { error } = await supabaseAdmin.from("competition_analysis").insert(competition);
  if (error) {
    throw new Error(`Failed to insert competition analysis: ${error.message}`);
  }
  return competition;
}

// --- Helper: Map OpenAI results to business_analyses table ---
function mapBusinessAnalysisToDb(businessId: string, result: any, rawResponse: any, status: 'complete' | 'failed', errorMsg?: string) {
  return {
    business_id: businessId,
    name: result?.name ?? null,
    asking_price: result?.asking_price ?? null,
    revenue: result?.revenue ?? null,
    ebitda: result?.ebitda ?? null,
    cash_flow: result?.cash_flow ?? null,
    lease_remaining_years: result?.lease_remaining_years ?? null,
    lease_renewal_options: result?.lease_renewal_options ?? null,
    equipment_age: result?.equipment_age ?? null,
    equipment_description: result?.equipment_description ?? null,
    washer_count: result?.washer_count ?? null,
    dryer_count: result?.dryer_count ?? null,
    payment_system_type: result?.payment_system_type ?? null,
    payment_system_description: result?.payment_system_description ?? null,
    years_in_operation: result?.years_in_operation ?? null,
    monthly_rent: result?.monthly_rent ?? null,
    square_footage: result?.square_footage ?? null,
    ff_and_e: result?.ff_and_e ?? null,
    employees: result?.employees ?? null,
    misc_details: result?.misc_details ?? null,
    revenue_per_sqft_result: result?.revenue_per_sqft_result ?? null,
    revenue_per_sqft_score: result?.revenue_per_sqft_score ?? null,
    profit_margin_result: result?.profit_margin_result ?? null,
    profit_margin_score: result?.profit_margin_score ?? null,
    price_per_sqft_result: result?.price_per_sqft_result ?? null,
    price_per_sqft_score: result?.price_per_sqft_score ?? null,
    revenue_multiple_result: result?.revenue_multiple_result ?? null,
    revenue_multiple_score: result?.revenue_multiple_score ?? null,
    sde_multiple_result: result?.sde_multiple_result ?? null,
    sde_multiple_score: result?.sde_multiple_score ?? null,
    equipment_age_result: result?.equipment_age_result ?? null,
    equipment_age_score: result?.equipment_age_score ?? null,
    lease_terms_result: result?.lease_terms_result ?? null,
    lease_terms_score: result?.lease_terms_score ?? null,
    score_achieved: result?.score_achieved ?? null,
    score_maximum: result?.score_maximum ?? null,
    score_percentage: result?.score_percentage ?? null,
    score_classification: result?.score_classification ?? null,
    analysis_status: status,
    raw_response: errorMsg ? { error: errorMsg, raw: rawResponse } : rawResponse
  }
}

// --- Helper: Map OpenAI results to recommendations table ---
function mapRecommendationToDb(businessId: string, result: any, rawResponse: any, status: 'complete' | 'failed', errorMsg?: string) {
  return {
    business_id: businessId,
    ideal_range_low: result?.ideal_range_low ?? null,
    ideal_range_high: result?.ideal_range_high ?? null,
    ideal_range_description: result?.ideal_range_description ?? null,
    great_deal_price: result?.great_deal_price ?? null,
    great_deal_description: result?.great_deal_description ?? null,
    current_price: result?.current_price ?? null,
    current_price_description: result?.current_price_description ?? null,
    strength_1: result?.strength_1 ?? null,
    strength_2: result?.strength_2 ?? null,
    strength_3: result?.strength_3 ?? null,
    weakness_1: result?.weakness_1 ?? null,
    weakness_2: result?.weakness_2 ?? null,
    weakness_3: result?.weakness_3 ?? null,
    question_1: result?.question_1 ?? null,
    question_2: result?.question_2 ?? null,
    question_3: result?.question_3 ?? null,
    question_4: result?.question_4 ?? null,
    question_5: result?.question_5 ?? null,
    verdict: result?.verdict ?? null,
    negotiation_focus: result?.negotiation_focus ?? null,
    growth_opportunities: result?.growth_opportunities ?? null,
    recommendation_status: status,
    raw_response: errorMsg ? { error: errorMsg, raw: rawResponse } : rawResponse
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase admin client is not configured. Check your environment variables." }, { status: 500 })
  }
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: "Business ID is required" }, { status: 400 })
    }
    // Fetch scrape_data and location from Supabase
    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .select("id, scrape_data, state, city, county, zip")
      .eq("id", id)
      .single()
    if (error || !business) {
      return NextResponse.json({ error: "Business not found or scrape_data missing" }, { status: 404 })
    }
    const scrapeData = business.scrape_data
    if (!scrapeData) {
      return NextResponse.json({ error: "No scrape_data found for this business" }, { status: 404 })
    }
    // Prepare location for Perplexity
    const location = {
      state: business.state,
      city: business.city ?? null,
      county: business.county ?? null,
      zip: business.zip ?? null
    }
    // --- OpenAI Business Analysis ---
    let businessAnalysisResult = null;
    let businessAnalysisRaw = null;
    let businessAnalysisError = null;
    let businessAnalysisSuccess = false;
    try {
      businessAnalysisResult = await runAssistant(BUSINESS_SCORE_ASSISTANT_ID!, scrapeData);
      businessAnalysisRaw = businessAnalysisResult;
      await supabaseAdmin.from("business_analyses").insert(
        mapBusinessAnalysisToDb(business.id, businessAnalysisResult, businessAnalysisRaw, "complete")
      );
      businessAnalysisSuccess = true;
    } catch (err: any) {
      businessAnalysisError = err instanceof Error ? err.message : String(err);
      await supabaseAdmin.from("business_analyses").insert(
        mapBusinessAnalysisToDb(business.id, null, businessAnalysisRaw, "failed", businessAnalysisError)
      );
    }
    // --- OpenAI Recommendation ---
    let recommendationResult = null;
    let recommendationRaw = null;
    let recommendationError = null;
    let recommendationSuccess = false;
    try {
      recommendationResult = await runAssistant(RECOMMENDATION_ASSISTANT_ID!, scrapeData);
      recommendationRaw = recommendationResult;
      await supabaseAdmin.from("recommendations").insert(
        mapRecommendationToDb(business.id, recommendationResult, recommendationRaw, "complete")
      );
      recommendationSuccess = true;
    } catch (err: any) {
      recommendationError = err instanceof Error ? err.message : String(err);
      await supabaseAdmin.from("recommendations").insert(
        mapRecommendationToDb(business.id, null, recommendationRaw, "failed", recommendationError)
      );
    }
    // --- Perplexity analyses (unchanged) ---
    const analysisPromises = [
      {
        name: 'demographics',
        promise: runPerplexityDemographics(business.id, location).then(result => ({ type: 'demographics', result })).catch(err => { logger.error('Demographics Error:', err); return { type: 'demographics', error: err instanceof Error ? err.message : String(err) } })
      },
      {
        name: 'competition',
        promise: runPerplexityCompetition(business.id, location).then(result => ({ type: 'competition', result })).catch(err => { logger.error('Competition Error:', err); return { type: 'competition', error: err instanceof Error ? err.message : String(err) } })
      }
    ]
    const settled = await Promise.all(analysisPromises.map(a => a.promise))
    // Collect results and errors for all analyses
    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};
    if (businessAnalysisSuccess) results.businessAnalysis = businessAnalysisResult;
    if (businessAnalysisError) errors.businessAnalysis = businessAnalysisError;
    if (recommendationSuccess) results.recommendation = recommendationResult;
    if (recommendationError) errors.recommendation = recommendationError;
    for (const r of settled) {
      if ('result' in r) results[r.type] = r.result;
      if ('error' in r) errors[r.type] = r.error;
    }
    // If at least one analysis succeeded, return 200 with all results/errors
    if (Object.keys(results).length > 0) {
      logger.debug('At least one analysis succeeded:', results);
      return NextResponse.json({ status: 'success', results, errors });
    } else {
      logger.error('All analyses failed:', errors);
      return NextResponse.json({ error: 'All analyses failed', errors }, { status: 500 });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('POST /api/analyze unexpected error:', errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export { runAssistant, runPerplexityDemographics, runPerplexityCompetition }
