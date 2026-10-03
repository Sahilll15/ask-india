# Ask India

An independent Q&A front door to Indian government information. Ask how to get a PAN, update your Aadhaar address, renew a passport, file ITR, register for GST or Udyam, block a lost phone, or apply for OCI, and get a short answer with steps, documents and fees (only when the official page states them), with numbered links to the exact official pages. Works in English, Hindi and Hinglish, typed or spoken.

It is for people who know what they need to do but not where on which portal. It is not a government website, cannot submit applications or check records, and is not legal, tax or financial advice.

## How it works

- **Responses API with `web_search`, limited to official domains.** The tool's `filters.allowed_domains` is set to `gov.in` and `nic.in` (subdomains included), `max_tool_calls` caps searches at 2, and `store: false` keeps responses off OpenAI's stored history.
- **Citations are checked again in code.** Every `url_citation` host must be `gov.in`, `nic.in` or a real subdomain of an allow-listed host. Lookalikes like `gov.in.evil.com`, `evilgov.in` and `gov.in@evil.com` are dropped. Official citations are numbered by first use and mapped to source cards; tracking params are stripped.
- **No unsourced answers.** The server streams NDJSON to the browser but holds back text until the first official citation arrives. If the finished answer has no official citation, the user sees "I could not find this on an official site" plus directory links picked from the question, never the model's text.
- **Prompt rules.** Use only what the sources say, say so when they do not cover it, never invent fees, dates or eligibility. Party, candidate and campaign questions (and off-topic requests) are declined with a sentinel tag the server detects; elections are limited to official ECI procedures. A fixed "check the official page before you act" line is appended by the server in the answer's language.
- **Redaction twice.** The same pure function runs in the browser before sending and on the server. It covers Aadhaar (12 digits, spaced or not, Devanagari digits too; Verhoeff decides the label but any 12-digit run is removed), PAN, voter ID (EPIC), passport, mobile numbers (+91 and local formats), email, IFSC, bank account runs and card numbers (Luhn). Years, fees like Rs 1,500, PIN codes and dates are left alone. The UI says what was removed.
- **Language.** A small detector picks English, Hindi (Devanagari share) or Hinglish (romanised Hindi word list), and the prompt asks for the answer in that language.
- **Voice.** `gpt-4o-mini-transcribe`, recording capped at 30 seconds in the browser and 1 MB on the server, rate limited, and redacted before the text reaches the composer.
- **Follow-ups.** The browser sends the last 3 answered turns (redacted, trimmed); nothing is kept server side.
- **Cost controls.** Per-IP hourly question budget (default 8) and a per-instance daily cap (default 300), using the hardened limiter (x-real-ip first, then the last x-forwarded-for hop, IPv6 grouped by /64, bounded memory). Input is validated before it counts. `GET /api/ask` drives the "N questions left this hour" line and the countdown banner, and the composer is disabled when spent, so no request is sent. A 429 never leaves a partial answer. Identical first questions (after redaction) are served from a 12 hour in-memory cache that does not use quota. Bodies are read as capped streams (16 KB for questions, 413 above).
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
| `DAILY_QUESTION_BUDGET` | `300` | Questions per instance per UTC day |

Built by [Sahil Chalke](https://sahilchalke.com). Not affiliated with the Government of India.
