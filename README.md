# Ask India

An independent Q&A front door to Indian government information. Ask how to get a PAN, update your Aadhaar address, renew a passport, file ITR, register for GST or Udyam, block a lost phone, or apply for OCI, and get a short answer with steps, documents and fees (only when the official page states them), with numbered links to the exact official pages. Works in English, Hindi and Hinglish, typed or spoken.

It is for people who know what they need to do but not where on which portal. It is not a government website, cannot submit applications or check records, and is not legal, tax or financial advice.

## How it works

- **Responses API with `web_search`, limited to official domains.** The tool's `filters.allowed_domains` is set to `gov.in` and `nic.in` (subdomains included), `max_tool_calls` caps searches at 2, and `store: false` keeps responses off OpenAI's stored history.
- **Citations are checked again in code.** Every `url_citation` host must be `gov.in`, `nic.in` or a real subdomain of an allow-listed host. Lookalikes like `gov.in.evil.com`, `evilgov.in` and `gov.in@evil.com` are dropped. Official citations are numbered by first use and mapped to source cards; tracking params are stripped.
- **Every link is opened before it is shown.** Each cited URL is fetched on the server like a browser would (redirects followed up to 5 hops, 6 second timeout, only the first 16 KB read). A link is kept only if it ends on a 2xx page on an allow-listed host and the page is not a "page not found" page served with a 200. Staging, test, UAT, dev, demo and beta hosts are rejected outright. Checks start while the answer streams, run 4 at a time, and each verdict is cached for 24 hours in Redis (`linkcheck:<sha1>`, 1 hour for timeouts). Dropped sources lose their [n] markers and the rest are renumbered; the cards and final numbering arrive with the finished answer. Every answer also gets an "Official portal" card picked by topic from the hand-checked directory.
- **No unsourced answers.** The server streams NDJSON to the browser but holds back text until the first official citation arrives. If the model's citations are missing or all fail the link check, the official pages its own web search returned are checked and used as a plain "Sources" list. If none of those pass either, the question is retried once with the search forced on and plain search terms for the topic (for example "GST registration gst.gov.in"); the retry is not counted as a second question. Only when nothing official is verified does the user see "I couldn't confirm the exact steps on an official page just now" with 1 to 3 portals that match the question's topics and a Try again button. Questions about two services are answered part by part, each with its own sources.
- **Search queries avoid `site:`.** With the domain filter on, `site:` queries came back with zero results, which was the main cause of the fallback card. The prompt names each topic's national portal as words instead.
- **Prompt rules.** Use only what the sources say, say so when they do not cover it, never invent fees, dates or eligibility. Party, candidate and campaign questions (and off-topic requests) are declined with a sentinel tag the server detects; elections are limited to official ECI procedures. A fixed "check the official page before you act" line is appended by the server in the answer's language.
- **Redaction twice.** The same pure function runs in the browser before sending and on the server. It covers Aadhaar (12 digits, spaced or not, Devanagari digits too; Verhoeff decides the label but any 12-digit run is removed), PAN, voter ID (EPIC), passport, mobile numbers (+91 and local formats), email, IFSC, bank account runs and card numbers (Luhn). Years, fees like Rs 1,500, PIN codes and dates are left alone. The UI says what was removed.
- **Language.** A small detector picks English, Hindi (Devanagari share) or Hinglish (romanised Hindi word list), and the prompt asks for the answer in that language.
- **Voice.** `gpt-4o-mini-transcribe`, recording capped at 30 seconds in the browser and 1 MB on the server, rate limited, and redacted before the text reaches the composer.
- **Follow-ups.** The browser sends the last 3 answered turns (redacted, trimmed); nothing is kept server side.
- **Cost controls.** Per-IP hourly question budget (default 8), a voice clip limit (default 6) and a global daily cap (default 300). Counts are global across instances: they live in Upstash Redis, where the first counted request starts the hour and a refused request is not counted. The client key is x-real-ip first, then the last x-forwarded-for hop, with IPv6 grouped by /64. Without the Redis env vars (local dev, tests) the limiter falls back to per-process memory. If Redis is configured but unreachable, question and voice requests get a 503 "The service is busy" instead of running unmetered. Input is validated before it counts. `GET /api/ask` drives the "N questions left this hour" line and the countdown banner, and the composer is disabled when spent, so no request is sent. A 429 never leaves a partial answer. Identical first questions (after redaction) are served from a 12 hour in-memory cache that does not use quota. Bodies are read as capped streams (16 KB for questions, 413 above).
- **Feedback.** Thumbs up or down increments an anonymous in-memory counter. No text is stored.

Measured locally with `gpt-5.4-mini`: about 6 to 9 seconds per answer, first text after 4 to 8 seconds (search time), and about $0.015 to $0.037 per question, mostly the $0.01 per search call. Declines cost about $0.001. Cached answers are free.

## Run it

```bash
npm install
cp .env.example .env.local   # add OPENAI_API_KEY
npm run dev                  # http://localhost:3206
npm test                     # redaction, citation filter, limiter, cache, language
npm run verify:links         # curls every directory URL, fails on non-200 or non-official redirect
```

Functions run in Mumbai (`bom1`, set in `vercel.json`) because several gov.in sites are slow or refuse requests from US regions, and the Redis database is in the same region.

## Config

| Variable | Default | What it does |
| --- | --- | --- |
| `OPENAI_API_KEY` | | Server-only key |
| `OPENAI_MODEL` | `gpt-5.4-mini` | Answer model |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe` | Voice model |
| `MAX_SEARCHES` | `2` | Search calls per answer (1 to 4) |
| `RATE_LIMIT_QUESTIONS` | `8` | Questions per IP per window |
| `RATE_LIMIT_TRANSCRIBES` | `6` | Voice clips per IP per window |
| `RATE_LIMIT_FEEDBACK` | `30` | Votes per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `3600000` | Limiter window |
| `DAILY_QUESTION_BUDGET` | `300` | Questions across all instances per UTC day |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | | Upstash Redis for shared limits (set by the Vercel integration; `vercel env pull .env.local` for local use) |

Built by [Sahil Chalke](https://sahilchalke.com). Not affiliated with the Government of India.
