/**
 * Keep the previous answer, marked refreshing, while the next check runs (a new party, time,
 * retry or capacity): the card does not blank out at each change. Only the first check loads.
 */
export function availabilityResult(result, key, revision, metadata) {
  if (!result) return { status: 'loading' };
  return {
    ...result,
    ...metadata,
    isRefreshing: result.key !== key || result.revision !== revision,
  };
}
