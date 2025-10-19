# Bizalyze

A professional business valuation and analysis platform that provides comprehensive reports for small business buyers and sellers.

## What It Does

Bizalyze is the "Car Fax for Businesses" - offering professional business valuations in minutes using the same methodology as $2,000+ appraisals. The platform serves both buyers (to avoid overpaying) and sellers (to avoid underselling) with AI-powered analysis including:

- **Business Scoring**: Revenue multiples, cash flow analysis, profit margins
- **Competition Analysis**: Market positioning and competitive landscape
- **Demographics**: Location-based market insights
- **Recommendations**: Negotiation strategies and due diligence checklists
- **Professional Reports**: PDF exports with custom insights

## Features

- **Professional Analysis**: Full business analysis at $49/report
- **User Dashboard**: Track and manage all your business analyses
- **Account Management**: Secure authentication and settings
- **PDF Export**: Professional reports for presentations and negotiations

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes, Supabase
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth & Resend
- **Payments**: Polar
- **AI Analysis**: OpenAI GPT models, Perplexity
- **Web Scraping**: Apify
- **UI/UX**: Framer Motion, Lucide React icons

## Quick Start

1. **Analyze Business**: Enter any business listing URL
2. **Get Full Report**: Pay $49 for complete professional analysis
3. **Create Account**: Access your dashboard to manage all reports
4. **Export & Use**: Download PDF reports for negotiations

## Development Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your API keys: SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY, etc.

# Run development server
npm run dev
```

## Environment Variables

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key for analysis
- `APIFY_API_KEY` - Apify API key for web scraping
- `POLAR_ACCESS_TOKEN` - Polar payment integration
- `RESEND_API_KEY` - Resend for email services
- `PERPLEXITY_API_KEY` - Perplexity for enhanced analysis
- `GOOGLE_WORKSPACE_API_KEY` - Google Workspace integration

## Deployment

The app is designed to deploy on Vercel with Supabase as the backend. All environment variables should be configured in your deployment platform.
