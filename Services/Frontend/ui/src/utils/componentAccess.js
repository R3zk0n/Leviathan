/**
 * Canonical access classification used by list filtering and cards.
 *
 * Contract:
 * - Input: a status-like object containing booleans for exported/accessible/has_intent_filters.
 * - Output: one of 'ACCESSIBLE' | 'PROTECTED' | 'UNKNOWN'.
 *
 * Notes:
 * - We treat exported=true as ACCESSIBLE. This is "externally reachable".
 * - has_intent_filters=true is also treated as ACCESSIBLE (implicit exposure).
 * - accessible=false is treated as PROTECTED *only* when we have a strong signal that it's internal.
 */
export function classifyAccess(status) {
  if (!status || typeof status !== 'object') return 'UNKNOWN';

  const exported = typeof status.exported === 'boolean' ? status.exported : null;
  const hasIntentFilters =
    typeof status.has_intent_filters === 'boolean' ? status.has_intent_filters : null;
  const accessible = typeof status.accessible === 'boolean' ? status.accessible : null;

  // Most important rule: if exported=true it's externally reachable.
  if (exported === true) return 'ACCESSIBLE';

  // If backend already computed accessible, trust it.
  if (accessible === true) return 'ACCESSIBLE';
  if (accessible === false) return 'PROTECTED';

  // Intent filters imply reachability even if exported is unknown/false.
  if (hasIntentFilters === true) return 'ACCESSIBLE';

  // If exported is explicitly false and no other indicators, treat as protected.
  if (exported === false) return 'PROTECTED';

  return 'UNKNOWN';
}

export function isAccessible(status) {
  return classifyAccess(status) === 'ACCESSIBLE';
}

export function isProtected(status) {
  return classifyAccess(status) === 'PROTECTED';
}
