import { ApifyClient } from "apify-client";
import { supabaseAdmin } from "@/lib/supabase";
import logger from "@/lib/logger";

export async function scrapeBizBuySell(url: string): Promise<{ id: string }> {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured. Check your environment variables.");
  }
  
  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) {
    throw new Error("Apify API token not set");
  }
  const apifyClient = new ApifyClient({ token: apifyToken });
  const actorId = "bongobongo~bizbuysell-listing-crawler-v1";
  const actorInput = {
    breakpointLocation: "NONE",
    browserLog: false,
    closeCookieModals: false,
    debugLog: false,
    downloadCss: true,
    downloadMedia: false,
    excludes: [
      { glob: "/**/*.{png,jpg,jpeg,pdf}" }
    ],
    globs: [
      { glob: "https://crawlee.dev/js/*/*" }
    ],
    headless: true,
    ignoreCorsAndCsp: true,
    ignoreSslErrors: false,
    injectJQuery: true,
    keepUrlFragments: false,
    linkSelector: "a[href]",
    maxConcurrency: 1,
    maxRequestRetries: 5,
    useStealth: true,
    pageFunction: "async function pageFunction(context) {\n    const $ = context.jQuery;\n    const url = context.request.url;\n    \n    // Helper function to clean text\n    function cleanText(text) {\n        return text ? text.trim().replace(/\\s+/g, ' ') : '';\n    }\n    \n    // Helper function to extract currency values\n    function extractCurrency(text) {\n        if (!text) return null;\n        const match = text.match(/\\$?([\\d,]+)/);\n        return match ? match[1].replace(/,/g, '') : null;\n    }\n    \n    // Helper function to extract numbers\n    function extractNumber(text) {\n        if (!text) return null;\n        const match = text.match(/(\\d+)/);\n        return match ? parseInt(match[1], 10) : null;\n    }\n    \n    // Wait for content to load and remove blocking elements\n    await context.waitFor(() => {\n        return document.body.innerText.length > 100;\n    }, { timeoutMillis: 10000 });\n\n    // Clean DOM - remove blocking elements\n    $('script, style, nav, footer, .nav, .footer, .header, .menu').remove();\n\n    try {\n        // BASIC FIELDS\n        const name = cleanText($('h1.bfsTitle.remove-margin').text());\n        \n        // Extract location from main location span\n        const locationText = cleanText($('.col-12.col-md-8.relative .f-l.cs-800.flex-center.g8.opacity-70').text());\n        let city = null, state = null, county = null, zip = null;\n        \n        // Parse location text: \"Tulare, CA (Tulare County)\"\n        if (locationText) {\n            const match = locationText.match(/^([^,]+),\\s*([A-Z]{2})\\s*(?:\\(([^)]+)\\s*County\\))?/);\n            if (match) {\n                city = match[1].trim();\n                state = match[2].trim();\n                county = match[3] ? match[3].trim() : null;\n            }\n        }\n        \n        // Extract additional location data from Google Maps iframe if available\n        let street_address = null;\n        const mapIframe = $('.bizMap iframe');\n        if (mapIframe.length) {\n            const mapSrc = mapIframe.attr('src');\n            if (mapSrc) {\n                // Extract from Google Maps query: \"246+E+Cross+Ave%2c+Tulare%2c+Tulare+County%2c+California%2c+United+States\"\n                const urlMatch = mapSrc.match(/q=([^&]+)/);\n                if (urlMatch) {\n                    const decodedAddress = decodeURIComponent(urlMatch[1]).replace(/\\+/g, ' ');\n                    \n                    // Extract zip code\n                    const zipMatch = decodedAddress.match(/\\b(\\d{5}(?:-\\d{4})?)\\b/);\n                    if (zipMatch && !zip) {\n                        zip = zipMatch[1];\n                    }\n                    \n                    // Extract street address (everything before first comma)\n                    const addressParts = decodedAddress.split(',');\n                    if (addressParts.length > 0) {\n                        street_address = addressParts[0].trim();\n                    }\n                    \n                    // Use more precise city/county from Maps if header parsing failed\n                    if (!city && addressParts.length > 1) {\n                        city = addressParts[1].trim();\n                    }\n                    if (!county && addressParts.length > 2) {\n                        const countyText = addressParts[2].trim();\n                        if (countyText.includes('County')) {\n                            county = countyText.replace(/\\s*County\\s*/i, '').trim();\n                        }\n                    }\n                }\n            }\n        }\n        const description = cleanText($('.businessDescription.f-m.word-break').text());\n        \n        // ADDITIONAL INFO - Extract from detail list\n        const detailList = $('#ctl00_ctl00_Content_ContentPlaceHolder1_wideProfile_listingDetails_dlDetailedInformation');\n        \n        // Extract employees from additional info section\n        const employees = extractNumber(detailList.find('dt:contains(\\\"Employees:\\\") + dd').text());\n        \n        // BUSINESS METRICS - Extract from financials section\n        const financialsSection = $('.row.b-margin.financials.clearfix');\n        \n        const asking_price = extractCurrency(financialsSection.find('.title:contains(\\\"Asking Price:\\\") + span').text());\n        const gross_revenue = extractCurrency(financialsSection.find('.title:contains(\\\"Gross Revenue:\\\") + span').text());\n        const cash_flow = extractCurrency(financialsSection.find('.title:contains(\\\"Cash Flow\\\") + span').text());\n        const ebitda = extractCurrency(financialsSection.find('.title:contains(\\\"EBITDA:\\\") + span').text());\n        const rent = extractCurrency(financialsSection.find('.title:contains(\\\"Rent:\\\") + span').text());\n        const real_estate = extractCurrency(financialsSection.find('.title:contains(\\\"Real Estate:\\\") + span').text());\n        const established = extractNumber(financialsSection.find('.title:contains(\\\"Established:\\\") + span').text());\n        \n        // FF&E from detail list (includes amount like \"$175,000\")\n        const ffe = extractCurrency(detailList.find('dt:contains(\\\"Furniture, Fixtures, & Equipment\\\") + dd').text());\n        \n        const seller_financing = cleanText(detailList.find('dt:contains(\\\"Seller Financing:\\\") + dd').text()) || \"Not specified\";\n        const support_training = cleanText(detailList.find('dt:contains(\\\"Support & Training:\\\") + dd').text()) || \"Not specified\";\n        const reason_for_selling = cleanText(detailList.find('dt:contains(\\\"Reason for Selling:\\\") + dd').text()) || \"Not specified\";\n        \n        // Extract additional raw data that doesn't have dedicated columns\n        const raw_data = {};\n        detailList.find('dt').each(function() {\n            const key = cleanText($(this).text().replace(':', ''));\n            const value = cleanText($(this).next('dd').text());\n            if (key && value) {\n                raw_data[key.toLowerCase().replace(/\\s+/g, '_')] = value;\n            }\n        });\n        \n        // Add street address to raw data if found\n        if (street_address) {\n            raw_data.street_address = street_address;\n        }\n        \n        // Build the output object matching your schema\n        const result = {\n            url: url,\n            name: name,\n            city: city,\n            state: state,\n            county: county,\n            zip: zip,\n            scrape_data: {\n                zip: zip,\n                city: city,\n                name: name,\n                state: state,\n                county: county,\n                description: description,\n                additional_info: {\n                    seller_financing: seller_financing || \"Not specified\",\n                    support_training: support_training || \"Not specified\",\n                    reason_for_selling: reason_for_selling || \"Not specified\"\n                },\n                business_metrics: {\n                    asking_price: asking_price,\n                    gross_revenue: gross_revenue,\n                    cash_flow: cash_flow,\n                    ebitda: ebitda,\n                    \"ff&e\": ffe,\n                    real_estate: real_estate,\n                    employees: employees,\n                    established: established ? established.toString() : null\n                },\n                raw_data: raw_data,\n                scraped_at: new Date().toISOString()\n            },\n            scrape_status: 'complete'\n        };\n        \n        // Validate required fields\n        if (!name || name.length < 3) {\n            context.log.warning(`Missing or invalid business name for ${url}`);\n            return {\n                url: url,\n                name: null,\n                city: null,\n                state: null,\n                county: null,\n                zip: null,\n                scrape_data: null,\n                scrape_status: 'error'\n            };\n        }\n        \n        context.log.info(`Successfully scraped: ${name} in ${city}, ${state}`);\n        return result;\n        \n    } catch (error) {\n        context.log.error(`Error scraping ${url}: ${error.message}`);\n        return {\n            url: url,\n            name: null,\n            city: null,\n            state: null,\n            county: null,\n            zip: null,\n            scrape_data: null,\n            scrape_status: 'error'\n        };\n    }\n}",
    pageFunctionTimeoutSecs: 20,
    pageLoadTimeoutSecs: 20,
    postNavigationHooks: "[]",
    preNavigationHooks: "[]",
    proxyConfiguration: {
      useApifyProxy: true
    },
    proxyRotation: "PER_REQUEST",
    respectRobotsTxtFile: false,
    runMode: "PRODUCTION",
    sessionPoolName: "bbs-sessions",
    startUrls: [
      {
        url: url,
        method: "GET"
      }
    ],
    useChrome: true,
    waitUntil: ["load"]
  };
  
  logger.debug('[Apify][BizBuySell] Calling actor with input:', actorInput);
  
  try {
    const run = await apifyClient.actor(actorId).call(actorInput);
    logger.debug('[Apify][BizBuySell] Actor run started:', run.id);
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    logger.debug('[Apify][BizBuySell] Results fetched:', items.length, 'items');
    
    if (!items || items.length === 0) {
      throw new Error('No data returned from Apify BizBuySell actor');
    }
    
    // Get the first item (this is your scraped data)
    const scrapedData = items[0];
    
    // Log the complete scraped data for debugging
    logger.debug('[Apify][BizBuySell] Complete scraped data received:', JSON.stringify(scrapedData, null, 2));
    
    // Validate scraped data
    if (!scrapedData || scrapedData.scrape_status === 'error' || !scrapedData.name) {
      logger.error('[Apify][BizBuySell] Invalid scraped data:', scrapedData);
      throw new Error('Invalid or error data returned from Apify actor');
    }
    
    // Log what we're about to insert
    const insertData = {
      url: scrapedData.url,
      name: scrapedData.name,
      city: scrapedData.city,
      state: scrapedData.state,
      county: scrapedData.county,
      zip: scrapedData.zip,
      scrape_data: scrapedData.scrape_data,
      scrape_status: "complete"
    };
    logger.debug('[Apify][BizBuySell] About to insert into Supabase:', JSON.stringify(insertData, null, 2));
    
    const { data: business, error: supabaseError } = await supabaseAdmin
      .from("businesses")
      .insert(insertData)
      .select()
      .single();
    
    logger.debug('[Apify][BizBuySell] Supabase insert result:', {
      business: business,
      error: supabaseError
    });
    
    if (supabaseError) {
      logger.error("[Apify][BizBuySell] Supabase insert error:", {
        error: supabaseError,
        scrapedData: scrapedData
      });
      throw new Error(`Failed to store data in Supabase: ${supabaseError.message}`);
    }
    
    if (!business?.id) {
      logger.error("[Apify][BizBuySell] No business ID returned from insert:", business);
      throw new Error("No business ID returned from Supabase insert");
    }
    
    logger.info(`[Apify][BizBuySell] Successfully created business with ID: ${business.id}`);
    
    // Return the format that route.ts expects
    return { id: business.id };
    
  } catch (err) {
    logger.error('[Apify][BizBuySell] API error:', err);
    throw err;
  }
}