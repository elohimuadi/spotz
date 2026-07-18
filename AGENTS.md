# Spotz — Agent Context

## What this is
Web app that surfaces non-touristy local recommendations by searching in a 
destination's native language, using AI to discover local platforms/language, 
then Serper search + AI extraction, geocoded onto a Google Map.

## Stack
- /client: React (Vite), plain JS, no TypeScript
- /server: Node/Express
- APIs: OpenAI (GPT-5.6), Serper (search), Google Maps/Places

## Conventions
- Keep functions small and single-purpose
- All API keys server-side only — never expose in client code
- Comment non-obvious logic, especially the AI prompt-construction steps
- Prefer explicit error handling over silent failures (this will be judged/tested)

## Pipeline (in order)
1. User submits destination + category
2. Discovery: GPT call — what language/platforms locals use
3. Search: Serper, using discovery output
4. Extraction: GPT call — parse results into structured places, translate
5. Geocode: Google Places — get lat/lng + maps link
6. Render: pins + list in client
