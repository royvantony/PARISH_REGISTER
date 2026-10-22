/**
 * Australian State standardizer.
 * Ensures state abbreviations are canonical uppercase (e.g. QLD, NSW, VIC).
 * Defaults to 'QLD' for Queensland parish records.
 */
export function normalizeAustralianState(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'QUEENSLAND' || upper === 'QLD') return 'QLD';
  if (upper === 'NEW SOUTH WALES' || upper === 'NSW') return 'NSW';
  if (upper === 'VICTORIA' || upper === 'VIC') return 'VIC';
  if (upper === 'AUSTRALIAN CAPITAL TERRITORY' || upper === 'ACT') return 'ACT';
  if (upper === 'SOUTH AUSTRALIA' || upper === 'SA') return 'SA';
  if (upper === 'WESTERN AUSTRALIA' || upper === 'WA') return 'WA';
  if (upper === 'TASMANIA' || upper === 'TAS') return 'TAS';
  if (upper === 'NORTHERN TERRITORY' || upper === 'NT') return 'NT';
  return upper.length <= 3 ? upper : null;
}
