import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes contribution amounts into an average monthly equivalent based on frequency.
 * - Weekly: (amount * 52) / 12
 * - Fortnightly: (amount * 26) / 12
 * - Monthly: amount
 * - Quarterly: (amount * 4) / 12
 * - Half-Yearly: (amount * 2) / 12
 * - Annual / Yearly: amount / 12
 */
export function calculateMonthlyEquivalent(
  amount: number | string | null | undefined,
  frequency: string | null | undefined
): number {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (!num || isNaN(num) || num <= 0) return 0;
  const freq = (frequency || '').trim().toLowerCase();

  switch (freq) {
    case 'weekly':
      return (num * 52) / 12;
    case 'fortnightly':
    case 'bi-weekly':
    case 'biweekly':
      return (num * 26) / 12;
    case 'monthly':
      return num;
    case 'quarterly':
      return (num * 4) / 12;
    case 'half-yearly':
    case 'semi-annually':
    case 'semi-annual':
    case 'bi-annual':
      return (num * 2) / 12;
    case 'annual':
    case 'annually':
    case 'yearly':
      return num / 12;
    default:
      return num;
  }
}

