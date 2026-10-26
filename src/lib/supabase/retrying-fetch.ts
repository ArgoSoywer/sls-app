export type Wait = (milliseconds: number) => Promise<void>;

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_WAIT: Wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function isFetchFailure(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  return /fetch|network|load failed/i.test(error.message);
}

export function createRetryingFetch(
  fetchImplementation: typeof fetch,
  wait: Wait = DEFAULT_WAIT,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
): typeof fetch {
  return async (input, init) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await fetchImplementation(input, init);
      } catch (error) {
        if (!isFetchFailure(error) || attempt === maxAttempts) throw error;
        await wait(250 * 2 ** (attempt - 1));
      }
    }
    throw new Error("Supabase request retries were exhausted.");
  };
}
