import { DAILY_QUESTIONS, LIMITS, peek, questionBudget } from '../../server/ratelimit.ts';

// Same config as the other API routes so Vercel bundles them into one function and they share limiter memory.
export const maxDuration = 60;

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const { remaining, resetAt } = peek(req, 'question');
  const dailyLeft = Math.max(0, DAILY_QUESTIONS - questionBudget.used());
  return Response.json(
    { limit: LIMITS.question.limit, remaining: dailyLeft === 0 ? 0 : remaining, resetAt, dailyExhausted: dailyLeft === 0 },
    { headers: { 'cache-control': 'no-store' } },
  );
}
