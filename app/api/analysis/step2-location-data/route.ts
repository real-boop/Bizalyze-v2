import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Define a type for agent results
interface AgentResult {
  result?: any;
  status: string;
  error?: string;
}

// Demographics agent schema
const demographicsSchema = {
  type: "object",
  properties: {
    location: {
      type: "object",
      properties: {
        state: { type: "string" },
        city: { type: "string" },
        zip: { type: "string" },
        county: { type: "string" }
      },
      required: ["state"],
      additionalProperties: false
    },
    coreMetrics: {
      type: "object",
      properties: {
        medianIncome: { type: "number" },
        medianAge: { type: "number" },
        homeOwnershipRate: { type: "number" },
        averageHouseholdSize: { type: "number" },
        employmentRate: { type: "number" }
      },
      required: [
        "medianIncome",
        "medianAge",
        "homeOwnershipRate",
        "averageHouseholdSize",
        "employmentRate"
      ],
      additionalProperties: false
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
          required: [
            "whiteCaucasian",
            "hispanicLatino",
            "blackAfricanAmerican",
            "asian",
            "other"
          ],
          additionalProperties: false
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
          required: [
            "under50k",
            "from50kTo100k",
            "from100kTo150k",
            "from150kTo200k",
            "over200k"
          ],
          additionalProperties: false
        },
        ageDistribution: {
          type: "object",
          properties: {
            under25: { type: "number" },
            age25to44: { type: "number" },
            age45to64: { type: "number" },
            age65plus: { type: "number" }
          },
          required: [
            "under25",
            "age25to44",
            "age45to64",
            "age65plus"
          ],
          additionalProperties: false
        }
      },
      required: [
        "ethnicityDistribution",
        "householdIncomeDistribution",
        "ageDistribution"
      ],
      additionalProperties: false
    },
    purchasingPowerAssessment: { type: "string" }
  },
  required: [
    "location",
    "coreMetrics",
    "populationComposition",
    "purchasingPowerAssessment"
  ],
  additionalProperties: false
};

// Economics agent schema
const economicActivitySchema = {
  type: "object",
  properties: {
    location: {
      type: "object",
      properties: {
        state: { type: "string" },
        city: { type: "string" },
        zip: { type: "string" },
        county: { type: "string" }
      },
      required: ["state"],
      additionalProperties: false
    },
    coreMetrics: {
      type: "object",
      properties: {
        averageHomeValues: { type: "number" },
        medianRent: { type: "number" },
        population2024: { type: "number" },
        population2023: { type: "number" },
        populationDensity: { type: "number" }
      },
      required: [
        "averageHomeValues",
        "medianRent", 
        "population2024",
        "population2023",
        "populationDensity"
      ],
      additionalProperties: false
    },
    operatingCostsAssessment: { type: "string" },
    economicGrowthAssessment: { type: "string" }
  },
  required: [
    "location",
    "coreMetrics", 
    "operatingCostsAssessment",
    "economicGrowthAssessment"
  ],
  additionalProperties: false
};

// Competition agent schema
const competitionSchema = {
  type: "object",
  properties: {
    location: {
      type: "object",
      properties: {
        state: { type: "string" },
        city: { type: "string" },
        zip: { type: "string" },
        county: { type: "string" }
      },
      required: ["state"],
      additionalProperties: false
    },
    coreMetrics: {
      type: "object",
      properties: {
        businessCount: { type: "number" },
        averageRating: { type: "number" },
        violentCrimeRate: { type: "number" },
        propertyCrimeRate: { type: "number" },
        schoolRating: { type: "number" },
        airQualityIndex: { type: "number" },
        tourismEmploymentPercentage: { type: "number" }
      },
      required: [
        "businessCount",
        "averageRating",
        "violentCrimeRate",
        "propertyCrimeRate",
        "schoolRating",
        "airQualityIndex",
        "tourismEmploymentPercentage"
      ],
      additionalProperties: false
    },
    accessibilityAssessment: { type: "string" },
    tourismAssessment: { type: "string" }
  },
  required: [
    "location",
    "coreMetrics", 
    "accessibilityAssessment",
    "tourismAssessment"
  ],
  additionalProperties: false
};

// Helper function to call Perplexity API
async function callPerplexityAPI(
  systemPrompt: string,
  userPrompt: string,
  schema: any,
  agentName: string
): Promise<AgentResult> {
  try {
    logger.debug(`[Perplexity][${agentName}] Starting API call`);
    logger.debug(`[Perplexity][${agentName}] System prompt length:`, systemPrompt.length);
    logger.debug(`[Perplexity][${agentName}] User prompt:`, userPrompt);
    logger.debug(`[Perplexity][${agentName}] Schema keys:`, Object.keys(schema));
    
    const requestBody = {
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 8000,
      temperature: 0.2,
      top_p: 0.9,
      web_search_options: { search_context_size: 'high' },
      response_format: {
        type: 'json_schema',
        json_schema: { schema }
      },
      stream: false
    };
    
    logger.debug(`[Perplexity][${agentName}] Full request body:`, JSON.stringify(requestBody, null, 2));
    logger.debug(`[Perplexity][${agentName}] About to make API call to Perplexity`);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    logger.debug(`[Perplexity][${agentName}] HTTP response status:`, response.status);
    logger.debug(`[Perplexity][${agentName}] HTTP response headers:`, Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    logger.debug(`[Perplexity][${agentName}] Raw response text:`, text);
    logger.debug(`[Perplexity][${agentName}] Raw response length:`, text.length);

    let apiResponse;
    try {
      apiResponse = JSON.parse(text);
      logger.debug(`[Perplexity][${agentName}] Successfully parsed JSON response`);
      logger.debug(`[Perplexity][${agentName}] Parsed response keys:`, Object.keys(apiResponse));
      logger.debug(`[Perplexity][${agentName}] Full parsed response:`, JSON.stringify(apiResponse, null, 2));
    } catch (err) {
      logger.error(`[Perplexity][${agentName}] Failed to parse JSON response:`, err);
      logger.error(`[Perplexity][${agentName}] Raw text that failed to parse:`, text);
      return { error: `Perplexity returned non-JSON: ${text.slice(0, 200)}`, status: 'failed' };
    }

    // Check for API errors
    if (apiResponse.error) {
      logger.error(`[Perplexity][${agentName}] Perplexity API returned error:`, apiResponse.error);
      return { error: `Perplexity API error: ${apiResponse.error.message || 'Unknown error'}`, status: 'failed' };
    }

    if (!apiResponse.choices || !Array.isArray(apiResponse.choices)) {
      logger.error(`[Perplexity][${agentName}] No 'choices' array in response:`, apiResponse);
      return { error: 'Perplexity response missing choices array', status: 'failed' };
    }

    // Check if first choice exists
    if (!apiResponse.choices[0]) {
      logger.error(`[Perplexity][${agentName}] No first choice in choices array:`, apiResponse.choices);
      return { error: 'Perplexity response missing first choice', status: 'failed' };
    }

    // Check if message exists in first choice
    if (!apiResponse.choices[0].message) {
      logger.error(`[Perplexity][${agentName}] No 'message' in first choice:`, apiResponse.choices[0]);
      return { error: 'Perplexity response missing message in first choice', status: 'failed' };
    }

    // Extract the content from choices
    const content = apiResponse.choices[0].message.content;
    if (!content) {
      logger.error(`[Perplexity][${agentName}] No 'content' in message:`, apiResponse.choices[0].message);
      return { error: 'Perplexity response missing content', status: 'failed' };
    }

    logger.debug(`[Perplexity][${agentName}] Content type:`, typeof content);
    logger.debug(`[Perplexity][${agentName}] Content length:`, content.length);
    logger.debug(`[Perplexity][${agentName}] Content preview (first 500 chars):`, content.substring(0, 500));
    logger.debug(`[Perplexity][${agentName}] Full content:`, content);

    // Parse the JSON content
    let schemaResult;
    try {
      schemaResult = typeof content === 'string' ? JSON.parse(content) : content;
      logger.debug(`[Perplexity][${agentName}] Successfully parsed content JSON`);
      logger.debug(`[Perplexity][${agentName}] Parsed content keys:`, Object.keys(schemaResult));
      logger.debug(`[Perplexity][${agentName}] Full parsed content:`, JSON.stringify(schemaResult, null, 2));
    } catch (e) {
      logger.error(`[Perplexity][${agentName}] Failed to parse content as JSON:`, e);
      logger.error(`[Perplexity][${agentName}] Content that failed to parse:`, content);
      return { error: `Failed to parse Perplexity response content as JSON: ${content.slice(0, 200)}`, status: 'failed' };
    }

    // Validate the response has required location data
    if (!schemaResult) {
      logger.error(`[Perplexity][${agentName}] Parsed content is null or undefined:`, schemaResult);
      return { error: 'Perplexity response content is null', status: 'failed' };
    }

    if (!schemaResult.location) {
      logger.error(`[Perplexity][${agentName}] No 'location' property in parsed content:`, schemaResult);
      logger.error(`[Perplexity][${agentName}] Available properties:`, Object.keys(schemaResult));
      return { error: 'Perplexity response missing location property', status: 'failed' };
    }

    logger.debug(`[Perplexity][${agentName}] Location object:`, JSON.stringify(schemaResult.location, null, 2));

    if (!schemaResult.location.state) {
      logger.error(`[Perplexity][${agentName}] No 'state' property in location:`, schemaResult.location);
      logger.error(`[Perplexity][${agentName}] Location properties:`, Object.keys(schemaResult.location));
      return { error: 'Perplexity response missing state in location', status: 'failed' };
    }

    logger.debug(`[Perplexity][${agentName}] State value:`, schemaResult.location.state);
    logger.debug(`[Perplexity][${agentName}] Validation successful - returning result`);

    return { result: schemaResult, status: 'completed' };

  } catch (err: any) {
    logger.error(`[Perplexity][${agentName}] Unexpected error in API call:`, err);
    logger.error(`[Perplexity][${agentName}] Error stack:`, err.stack);
    return { error: err.message || String(err), status: 'failed' };
  }
}

// Demographics Agent
async function runPerplexityDemographicsAgent(location: Record<string, any>): Promise<AgentResult> {
  const systemPrompt = `Find demographics data and assess purchasing power for small business decision-making for the provided location.
Location details might be incomplete, supplement as necessary to find data. Use the most specific geographic data available for the provided location: ZIP > City > County > Metro area > State. For any metric, if granular information is missing (e.g. when city or ZIP data cannot be found), supplement with the next broader geography: Use County or MSA sources, or even State-level instead of not providing data.
Provide your analysis in a structured JSON report without additional explanations or commentary. Format dollar amounts as whole numbers without commas or $ signs.
 
Core demographics metrics are mandatory. For each required metric, retrieve the most specific available value from authoritative sources.

Use the latest available data for these core demographics:
Median age: Age at the midpoint of the population distribution
Median household income: Median household income
Average household size: Average number of persons per household
Home ownership rate: Owner-occupied housing units / total occupied housing units × 100
Employment rate: Employment-population ratio = employed persons / total civilian population aged 16+ × 100
Age distribution: Percentage of Population by age groups in defined age brackets
Ethnicity distribution: Percentage of Population by declared race/ethnicity categories
Household income distribution: Percentage of households in defined income brackets

Sources: US Census Bureau, Bureau of Labor Statistics, American Community Survey. Add other official/authoritative sources where needed.

After collecting core demographics, assess the following:
Customer spending potential (3-5 concise sentences): Evaluate the purchasing power and buying habits of customers in this area. Are they likely and able to spend much at local businesses?
Aim to include quantified indicators that impact strength and quality of local customer demand (e.g., retail sales per capita, cost of living index, consumer spending, business/consumer confidence sentiment, or disposable income) . If local figures on city level are unavailable, fall back to county, metro area, or state data. If no additional indicators can be found, provide a contextual assessment based on your knowledge of the area.
 
Example Output:
{
  "location": {
    "state": "California",
    "city": "Campbell",
    "zip": "95008",
    "county": "Santa Clara County"
  },
  "coreMetrics": {
    "medianIncome": 147128,
    "medianAge": 39.3,
    "homeOwnershipRate": 52.4,
    "averageHouseholdSize": 2.6,
    "employmentRate": 69.8
  },
  "populationComposition": {
    "ethnicityDistribution": {
      "whiteCaucasian": 50.5,
      "hispanicLatino": 20.5,
      "blackAfricanAmerican": 2.2,
      "asian": 20.8,
      "other": 6.0
    },
    "householdIncomeDistribution": {
      "under50k": 14.3,
      "from50kTo100k": 18.7,
      "from100kTo150k": 17.9,
      "from150kTo200k": 14.8,
      "over200k": 34.3
    },
    "ageDistribution": {
      "under25": 27.1,
      "age25to44": 31.8,
      "age45to64": 26.2,
      "age65plus": 14.9
    }
  },
  "purchasingPowerAssessment": "With a median household income of $147k, Campbell ranks among the nation's most affluent communities. Its cost of living index of 235—135% above the national average—signals high purchasing power despite elevated expenses. Retail sales are strong, with downtown vacancy at just 7%, and the broader San Jose metro saw 3.7% consumer spending growth over the past year. Low poverty (5.3%) and robust disposable income underscore residents' strong ability and willingness to spend, creating a favorable environment for small businesses."
}`;

  const userPrompt = JSON.stringify(location, null, 2);
  return callPerplexityAPI(systemPrompt, userPrompt, demographicsSchema, 'Demographics');
}

// Economics Agent
async function runPerplexityEconomicsAgent(location: Record<string, any>, businessCategory?: { name: string, display_name: string }): Promise<AgentResult> {
  
  const systemPrompt = `Find economic activity data and assess business environment viability for small business decision-making for the provided location and business category. 
Location details might be incomplete, supplement as necessary to find data. Use the most specific geographic data available for the provided location: ZIP > City > County > Metro area > State. For any metric, if granular information is missing (e.g. when city or ZIP data cannot be found), supplement with the next broader geography: Use County or MSA sources, or even State-level instead of not providing data.
Provide your analysis in a structured JSON report without additional explanations or commentary. Format dollar amounts as whole numbers without commas or $ signs.
Core economic metrics are mandatory. For each required metric, retrieve the most specific available value from authoritative sources.

Use the latest available data for these core economic indicators:
Median home values: Median home sale prices in the area
Median rent: Median monthly rental costs for residential properties
Population: Total population in 2024 and 2023
Population density: Population per square mile

Sources: US Census Bureau, American Community Survey, Census QuickFacts, Zillow, Redfin, RentCafe, Apartments.com, county assessor records, local MLS data, Bureau of Labor Statistics. Add other official/authoritative sources where needed.

After collecting core economic data, assess the following:
Operating Costs Assessment (3-5 concise sentences): Analyze the cost of operating a small business in this location. Is it expensive to run a business in this location? Is it hard to survive with a business?
Aim to include quantified indicators that impact business expenses (e.g. commercial lease or rental rates (office/retail/industrial), utilities, wages, insurances, business survival rates) using the most locally specific data available. If local figures on city level are unavailable, fall back to county, metro area, or state data. If no additional indicators can be found, provide a contextual assessment based on your knowledge of the area.
Economic Growth Assessment (3-5 concise sentences): Evaluate the area's future business climate for small businesses. Are new firms and residents coming in, are major developments underway? Is local demand likely to improve, stagnate, or shrink?
Aim to include quantified indicators of economic momentum (e.g. housing unit growth, building permits, business openings/closings, employment growth, or commercial development). If local figures on city level are unavailable, fall back to broader geography or provide a contextual assessment.

Example Output:
{
  "location": {
    "state": "California",
    "city": "Campbell",
    "zip": "95008",
    "county": "Santa Clara County"
  },
  "coreMetrics": {
    "averageHomeValues": 1854337,
    "medianRent": 3529,
    "population2024": 41154,
    "population2023": 41700,
    "populationDensity": 7228.48
  },
  "operatingCostsAssessment": "Operating a laundromat in Campbell, CA is expensive due to the area's high commercial and residential property costs. Median residential home values and rents far above national norms. Retail/commercial lease rates typically reach $61/sqft downtown, with about 7% vacancy, indicating strong demand. Utilities in Silicon Valley, including water and energy, both vital for laundromats, have higher rates than in most cities. The local minimum wage is $16.50/hour, and insurance and compliance costs reflect the Bay Area's strict standards. Survival rates for new businesses are challenged by high fixed expenses, so only well-capitalized operators tend to persist.",
  "economicGrowthAssessment": "Campbell shows stable if not rapid economic growth. Home values increased 9.8% year-over-year and steady housing demand signals ongoing affluence. The 2024 city economic plan focuses on downtown revitalization and multi-modal transit, supporting a mix of retail and service sector growth. Thousands of new housing units are planned for completion by 2031, suggesting more future residents. Business openings outnumber closures in the broader metro. Despite some challenges, commercial development and customer demand remain favorable for small businesses like laundromats."
}`;

  const userPrompt = JSON.stringify({ location, businessCategory }, null, 2);
  return callPerplexityAPI(systemPrompt, userPrompt, economicActivitySchema, 'Economics');
}

// Competition Agent
async function runPerplexityCompetitionAgent(location: Record<string, any>, businessCategory?: { name: string, display_name: string }): Promise<AgentResult> {
  const systemPrompt = `Find location quality data and assess area desirability for small business decision-making for the provided location and business category.
Location details might be incomplete, supplement as necessary to find data. Use the most specific geographic data available for the provided location: ZIP > City > County > Metro area > State. For any metric, if granular information is missing (e.g. when city or ZIP data cannot be found), supplement with the next broader geography: Use County or MSA sources, or even State-level instead of not providing data.
Provide your analysis in a structured JSON report without additional explanations or commentary. Format dollar amounts as whole numbers without commas or $ signs.
Core location quality metrics are mandatory. For each required metric, retrieve the most specific available value from authoritative sources.
 
Use the latest available data for these core location quality indicators:
Crime rates: Violent crime rate and property crime rate per 100,000 residents
School ratings: Average school rating in the area (0-10 score)
Air quality index: Average Air Quality Index (AQI) for the city/county/region (with the AQI scale from 0-500 with 0 being best)
Tourism employment percentage: Percentage of total workforce in accommodation and food services
Business count: Total number of the provided business category in the location
Average Rating: Average ratings for business category listings across Google Maps and Yelp
 
Sources: FBI Uniform Crime Reporting, local police departments, GreatSchools, state education departments, EPA Air Quality Index, AccuWeather, Bureau of Labor Statistics (BLS), Walk Score, Census commute data, BEA Travel & Tourism Accounts. For traffic: FHWA, state DOTs, StreetLight, UrbanSDK, Placer.ai, Unacast, AlphaMap, SafeGraph, CubitPlanning. Add other official/authoritative sources where needed.
 
After collecting core location quality data, assess the following:
 
Accessibility Assessment (3-5 concise sentences): Analyze the area's suitability for attracting in‑person customers for small businesses. Is it rural or urban? Is there measurable customer flow? Is it easy to access?
Aim to include quantified indicators that impact potential customer visits (e.g. Annual Average Daily Traffic (AADT), Pedestrian foot traffic, walkability score, traffic volume data, parking, public transit availability, etc.). If local figures on city level are unavailable, fall back to county, metro area, or state data. If no indicators can be found, provide a contextual assessment based on your knowledge of the area.
 
Tourism Assessment (3-5 concise sentences): Evaluate the role tourism plays in the local economy and how it could influence small business sales. Is there strong seasonality? Are tourists an important part of the customer base?
Aim to include quantified indicators for touristic impact (e.g. hotel density, Airbnb listings, seasonal price fluctuations for hotels/AirBnB, tourist spending, attraction proximity, or hospitality employment trends). If local figures on city level are unavailable, fall back to broader geography or provide a contextual assessment.

Example Output:
{
  "location": {
    "state": "California",
    "city": "Campbell",
    "zip": "95008",
    "county": "Santa Clara County"
  },
  "coreMetrics": {
    "violentCrimeRate": 353,
    "propertyCrimeRate": 3069,
    "schoolRating": 4.2,
    "airQualityIndex": 20,
    "tourismEmploymentPercentage": 3.0,
    "businessCount": 3,
    "averageRating": 3.6
  },
  "accessibilityAssessment": " Campbell, CA is an urban/suburban Silicon Valley community with moderate customer traffic. The average Annual Average Daily Traffic (AADT) on key Campbell roadways is about 2,490 vehicles per day, supporting consistent drive-by visibility for laundromats and retail businesses. The city's walkability score is 56, some errands can be done on foot, especially in central neighborhoods. Public transit options include multiple bus routes and a light rail station less than a mile from downtown, enhancing  accessibility. Although traffic congestion can be moderate—typical for Silicon Valley suburbs—it does not seriously restrict customer access or footfall.",
  "tourismAssessment": "Tourism in Campbell has limited local economic impact and is not a major source of demand for laundromats. Hospitality employment makes up about 3% of the local workforce, while hotel and Airbnb density are moderate for a suburban city. Seasonal effects are minor, with small increases during festivals and local events. Most customers for laundromats are local residents rather than tourists."
}`;

  const userPrompt = JSON.stringify({ location, businessCategory }, null, 2);
  return callPerplexityAPI(systemPrompt, userPrompt, competitionSchema, 'Competition');
}

export async function POST(request: Request) {
  let businessId: string | undefined;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 });
  }
  try {
    const body = await request.json();
    businessId = body.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
    }
    // Set processing status immediately
    await supabaseAdmin
      .from('businesses')
      .update({ step2_status: 'processing' })
      .eq('id', businessId);
    // Fetch business data
    const { data: business, error: fetchError } = await supabaseAdmin
      .from('businesses')
      .select(`
        id, 
        city, 
        state, 
        county, 
        zip,
        business_category_id,
        business_categories!inner(
          name,
          display_name
        )
      `)
      .eq('id', businessId)
      .single();
    if (fetchError || !business) {
      logger.error('[step2-location-data] Business not found:', fetchError);
      await supabaseAdmin
        .from('businesses')
        .update({ step2_status: 'failed' })
        .eq('id', businessId);
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    }

    logger.debug('[step2-location-data] Fetched business data:', business);

    const location = {
      city: business.city ?? null,
      state: business.state ?? null,
      county: business.county ?? null,
      zip: business.zip ?? null,
    };

    logger.debug('[step2-location-data] Constructed location object:', location);

    // Extract business category as single object (following CompetitionTab.tsx pattern)
    const businessCategory = business.business_categories ? {
      name: (business.business_categories as any).name,
      display_name: (business.business_categories as any).display_name
    } : undefined;

    // Run 3 agents in parallel
    const [demographics, economics, competition]: AgentResult[] = await Promise.all([
      runPerplexityDemographicsAgent(location).catch(e => ({ error: e.message, status: 'failed' })),
      runPerplexityEconomicsAgent(location, businessCategory).catch(e => ({ error: e.message, status: 'failed' })),
      runPerplexityCompetitionAgent(location, businessCategory).catch(e => ({ error: e.message, status: 'failed' })),
    ]);

    // Prepare insert object for location_data_collection table
    const now = new Date().toISOString();
    const insertObj = {
      business_id: businessId,
      city: location.city,
      state: location.state,
      demographics_raw_data: demographics.result ?? null,
      demographics_status: demographics.status ?? 'failed',
      demographics_collected_at: demographics.status === 'completed' ? now : null,
      location_economics_raw_data: economics.result ?? null,
      location_economics_status: economics.status ?? 'failed',
      location_economics_collected_at: economics.status === 'completed' ? now : null,
      competition_raw_data: competition.result ?? null,
      competition_status: competition.status ?? 'failed',
      competition_collected_at: competition.status === 'completed' ? now : null,
      // New extracted fields
      area_median_income: demographics.result?.coreMetrics?.medianIncome ?? null,
      area_median_age: demographics.result?.coreMetrics?.medianAge ?? null,
      area_average_household_size: demographics.result?.coreMetrics?.averageHouseholdSize ?? null,
      area_cost_of_living_index: economics.result?.locationQuality?.economics?.cost_of_living_index ?? null,
    };

    // Insert into location_data_collection
    const { error: insertError } = await supabaseAdmin
      .from('location_data_collection')
      .insert(insertObj);

    if (insertError) {
      logger.error('[step2-location-data] Failed to insert location data:', insertError);
      return NextResponse.json({ error: 'Failed to insert location data.' }, { status: 500 });
    }

    // Determine overall step2_status
    let step2_status = 'completed';
    if ([demographics, economics, competition].every(a => a.status === 'failed')) {
      step2_status = 'failed';
    } else if ([demographics, economics, competition].some(a => a.status === 'failed')) {
      step2_status = 'error'; // partial failure
    }
    // Update businesses.step2_status
    await supabaseAdmin
      .from('businesses')
      .update({ step2_status: step2_status === 'completed' ? 'completed' : 'failed' })
      .eq('id', businessId);

    // After successful step2 completion, trigger step3-4 parallel analysis
    if (step2_status === 'completed') {
      fetch(`${baseUrl}/api/analysis/step3-4-location-business-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId })
      }).catch((err) => {
        logger.error("Failed to trigger step3-4-location-business-analysis:", err);
      });
    }

    // Log results
    logger.info('[step2-location-data] Results:', { demographics, economics, competition });

    // Return status of each agent
    return NextResponse.json({
      demographics_status: demographics.status,
      economics_status: economics.status,
      competition_status: competition.status,
      step2_status,
      errors: {
        demographics: demographics.error,
        economics: economics.error,
        competition: competition.error,
      },
    });
  } catch (error) {
    logger.error('[step2-location-data] Unexpected error:', error);
    if (businessId) {
      await supabaseAdmin
        .from('businesses')
        .update({ step2_status: 'failed' })
        .eq('id', businessId);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
