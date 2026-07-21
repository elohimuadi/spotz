# Spotz

Find what locals actually recommend — not tourist-trap listings.

Spotz searches the way a local resident would: in their own language, on the
platforms they actually use — instead of just translating an English search.
Every recommendation links back to the real source that mentioned it, so
it's never just an AI's unverified word.

## How it works

1. **Discovery** — GPT-5.6 determines what language locals in the destination
   search in, and what local platforms/site types they actually use for
   recommendations.
2. **Search** — Runs live web searches (via Serper) using locally-phrased
   queries in that language.
3. **Extraction** — GPT-5.6 parses results, extracts real places with a
   translated blurb, and keeps the original source URL for each one.
4. **Geocoding** — Google Places geocodes each result, filtering out
   permanently closed businesses, and returns a direct Google Maps link.

Results are shown as points on an interactive wireframe globe, with
click-to-expand cards and a slide-out panel showing each result's sources.

## Setup

### Prerequisites

- Node.js (v18+)
- API keys for: OpenAI, Serper, Google Maps (Places + Geocoding APIs enabled,
  billing active on the Google Cloud project)

### Install

```bash
git clone https://github.com/elohimuadi/spotz.git
cd spotz
npm install
```

### Environment variables

Copy the example env file and fill in your keys:

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```dotenv
OPENAI_API_KEY=your_key_here
SERPER_API_KEY=your_key_here
GOOGLE_MAPS_API_KEY=your_key_here
CORS_ORIGIN=http://localhost:5173
```

### Run

```bash
npm run dev
```

This starts both the client (Vite, `http://127.0.0.1:5173`) and server
(Express, port 3001) concurrently.

## Sample usage

Try a search like:

- Destination: `Tokyo`
- Category: `quiet cafes with wifi`

Or leave category blank for general local recommendations. Destination and
category both accept free text in any language.

## Tech stack

- **Client:** React (Vite), react-globe.gl (Three.js-based wireframe globe)
- **Server:** Node.js, Express
- **AI:** GPT-5.6 (discovery + extraction steps)
- **Search:** Serper API
- **Maps/Geocoding:** Google Places API, Google Geocoding API

## Built with Codex CLI + GPT-5.6

This project was built end-to-end using Codex CLI, directed prompt-by-prompt
as an agentic coding partner. Codex handled the large majority of
implementation — the full pipeline, the interactive globe UI, security
hardening (CORS, rate limiting), and iterative bug fixes. Key decisions made
independently: the four-step pipeline architecture, the local-language
search mechanism as the core differentiator, scope choices (web over mobile,
free-text over fixed categories), and catching real data-quality issues
(e.g. filtering permanently-closed businesses via Google's business_status
field).

GPT-5.6 powers the two AI reasoning steps in the pipeline: language/platform
discovery, and result extraction with translation and source attribution.

## Security notes

- API keys are server-side only, never exposed to the client
- CORS is locked to explicit allowed origins (no wildcard)
- Rate limiting applied to API-cost-incurring endpoints
