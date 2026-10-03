/** Search calls allowed in one model run (1 to 4). */
export const MAX_SEARCHES = Math.min(4, Math.max(1, Number(process.env.MAX_SEARCHES) || 2));

/** Search calls allowed for one question across the first run and its single retry. */
export const QUESTION_SEARCH_CAP = MAX_SEARCHES * 2;

/** Search calls the retry may make after the first run used `used`; 0 means no retry. */
export function retrySearchBudget(used: number, perRun = MAX_SEARCHES, cap = perRun * 2) {
  return Math.max(0, Math.min(perRun, cap - used));
}
