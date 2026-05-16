import type { CategorisationRule, Transaction, TransactionType } from './types';

export type TaxHint = {
  id: string;
  type: 'missing-claim' | 'suggestion' | 'reminder';
  title: string;
  description: string;
  category?: string;
  dismissed?: boolean;
};

export function suggestCategory(
  description: string,
  type: TransactionType,
  rules: CategorisationRule[],
  recentTransactions: Transaction[]
): string | null {
  const lower = description.toLowerCase();

  for (const rule of rules) {
    if (lower.includes(rule.pattern.toLowerCase()) && rule.type === type) {
      return rule.category;
    }
  }

  // Pattern-based heuristics
  const patterns: { regex: RegExp; category: string; type: TransactionType }[] = [
    { regex: /amazon|amzn/i, category: 'Office Supplies', type: 'cost' },
    { regex: /github|gitlab|bitbucket/i, category: 'Software & Tools', type: 'cost' },
    { regex: /aws|google cloud|azure|heroku|vercel|netlify/i, category: 'Software & Tools', type: 'cost' },
    { regex: /uber|lyft|train|rail|bus|taxi/i, category: 'Travel', type: 'cost' },
    { regex: /hotel|airbnb|booking\.com/i, category: 'Travel', type: 'cost' },
    { regex: /vodafone|ee|three|o2|bt|sky|virgin/i, category: 'Telephone & Internet', type: 'cost' },
    { regex: /hmrc|tax/i, category: 'Taxes & Licenses', type: 'cost' },
    { regex: /insurance/i, category: 'Insurance', type: 'cost' },
    { regex: /accountant|bookkeep/i, category: 'Accountancy Fees', type: 'cost' },
    { regex: /google ads|facebook ads|meta ads|linkedin ads/i, category: 'Marketing & Advertising', type: 'cost' },
    { regex: /udemy|coursera|conference|workshop|training/i, category: 'Education & Training', type: 'cost' },
  ];

  for (const p of patterns) {
    if (p.type === type && p.regex.test(description)) {
      return p.category;
    }
  }

  // Match based on previous transactions with same/similar description
  const similar = recentTransactions.find(
    (t) => t.type === type && t.description.toLowerCase().includes(lower.slice(0, 8))
  );
  if (similar) return similar.category;

  return null;
}

export function suggestRuleFromRecategorisation(
  transaction: Transaction,
  newCategory: string,
  allTransactions: Transaction[]
): { pattern: string; count: number } | null {
  const desc = transaction.description.toLowerCase();
  // Find a meaningful substring
  const words = desc.split(/\s+/).filter((w) => w.length > 3);
  if (words.length === 0) return null;

  const pattern = words[0];
  const matchCount = allTransactions.filter(
    (t) => t.type === transaction.type &&
      t.description.toLowerCase().includes(pattern) &&
      t.category !== newCategory
  ).length;

  if (matchCount >= 2) {
    return { pattern, count: matchCount };
  }
  return null;
}

export function generateTaxHints(
  transactions: Transaction[],
  mileageEntries: { miles: number }[],
  wfhEntries: { month: string }[],
  settings: { taxMode: string }
): TaxHint[] {
  if (settings.taxMode !== 'uk-sole-trader') return [];

  const hints: TaxHint[] = [];
  const costs = transactions.filter((t) => t.type === 'cost');

  // Check for missing WFH claims
  const hasWfhCosts = costs.some((t) => t.category === 'Use of Home');
  if (!hasWfhCosts && wfhEntries.length === 0) {
    hints.push({
      id: 'wfh-claim',
      type: 'missing-claim',
      title: 'Working from home?',
      description: 'If you work from home, you can claim a simplified expense allowance of up to £26/month (£312/year).',
      category: 'Use of Home',
    });
  }

  // Check for missing mileage claims
  const hasMileageCosts = costs.some((t) => t.category === 'Vehicle / Mileage');
  if (!hasMileageCosts && mileageEntries.length === 0) {
    hints.push({
      id: 'mileage-claim',
      type: 'missing-claim',
      title: 'Do you drive for business?',
      description: 'You can claim 45p per mile for the first 10,000 miles, and 25p after that. Track your journeys in the Expenses section.',
    });
  }

  // Check for phone/internet
  const hasPhoneCost = costs.some((t) => t.category === 'Telephone & Internet');
  if (!hasPhoneCost) {
    hints.push({
      id: 'phone-claim',
      type: 'suggestion',
      title: 'Phone & Internet',
      description: 'If you use your phone or internet for business, you can claim the business portion as an expense.',
      category: 'Telephone & Internet',
    });
  }

  // Check uncategorised transactions
  const uncategorised = transactions.filter((t) => !t.category || t.category.startsWith('Other'));
  if (uncategorised.length > 5) {
    hints.push({
      id: 'uncategorised',
      type: 'reminder',
      title: `${uncategorised.length} uncategorised transactions`,
      description: 'Categorising your transactions helps with tax reporting and ensures you claim all allowable expenses.',
    });
  }

  return hints;
}
