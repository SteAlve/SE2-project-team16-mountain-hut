/** Keep the previous answer during background refreshes of the same party and time only. */
export function availabilityResult(result, key, revision, metadata) {
  if (!result || result.key !== key) return { status: 'loading' };
  return {
    ...result,
    ...metadata,
    isRefreshing: result.revision !== revision,
  };
}
