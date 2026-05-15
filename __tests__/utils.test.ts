import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatMonth,
  getYearRange,
  isInRange,
  cn,
  getFinancialYear,
  generateId,
  todayString,
  monthString,
  getMonthRange,
  getVatQuarter,
} from '../lib/utils';

describe('formatCurrency', () => {
  it('formats positive amount', () => {
    expect(formatCurrency(1234.56, '£')).toBe('£1,234.56');
  });

  it('formats negative amount', () => {
    expect(formatCurrency(-500, '$')).toBe('-$500.00');
  });

  it('formats zero', () => {
    expect(formatCurrency(0, '€')).toBe('€0.00');
  });
});

describe('formatDate', () => {
  it('formats with en-US locale by default', () => {
    const result = formatDate('2025-03-05');
    expect(result).toContain('Mar');
    expect(result).toContain('2025');
  });

  it('formats with en-GB locale', () => {
    const result = formatDate('2025-03-05', 'en-GB');
    expect(result).toContain('Mar');
    expect(result).toContain('2025');
  });

  it('returns empty for empty string', () => {
    expect(formatDate('')).toBe('');
  });
});

describe('formatMonth', () => {
  it('formats month string', () => {
    const result = formatMonth('2025-03-01');
    expect(result).toContain('March');
    expect(result).toContain('2025');
  });

  it('supports locale parameter', () => {
    const result = formatMonth('2025-03-01', 'en-GB');
    expect(result).toContain('March');
    expect(result).toContain('2025');
  });
});

describe('getYearRange', () => {
  it('returns calendar year range', () => {
    const range = getYearRange(2024, 'calendar');
    expect(range.start).toBe('2024-01-01');
    expect(range.end).toBe('2024-12-31');
  });

  it('returns apr-mar range', () => {
    const range = getYearRange(2024, 'apr-mar');
    expect(range.start).toBe('2024-04-01');
    expect(range.end).toBe('2025-03-31');
  });

  it('returns jul-jun range', () => {
    const range = getYearRange(2024, 'jul-jun');
    expect(range.start).toBe('2024-07-01');
    expect(range.end).toBe('2025-06-30');
  });

  it('returns oct-sep range', () => {
    const range = getYearRange(2024, 'oct-sep');
    expect(range.start).toBe('2024-10-01');
    expect(range.end).toBe('2025-09-30');
  });
});

describe('isInRange', () => {
  it('returns true for date in range', () => {
    expect(isInRange('2024-06-15', '2024-01-01', '2024-12-31')).toBe(true);
  });

  it('returns true for boundary dates', () => {
    expect(isInRange('2024-01-01', '2024-01-01', '2024-12-31')).toBe(true);
    expect(isInRange('2024-12-31', '2024-01-01', '2024-12-31')).toBe(true);
  });

  it('returns false for date outside range', () => {
    expect(isInRange('2025-01-01', '2024-01-01', '2024-12-31')).toBe(false);
  });
});

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});

describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('returns unique values on consecutive calls', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });
});

describe('todayString', () => {
  it('returns YYYY-MM-DD format matching today', () => {
    const result = todayString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const today = new Date().toISOString().split('T')[0];
    expect(result).toBe(today);
  });
});

describe('monthString', () => {
  it('returns YYYY-MM format matching current month', () => {
    const result = monthString();
    expect(result).toMatch(/^\d{4}-\d{2}$/);
    const today = new Date().toISOString().split('T')[0].slice(0, 7);
    expect(result).toBe(today);
  });
});

describe('getMonthRange', () => {
  it('returns correct start and end for a 31-day month', () => {
    const range = getMonthRange('2024-01');
    expect(range.start).toBe('2024-01-01');
    expect(range.end).toBe('2024-01-31');
  });

  it('returns correct end for a 30-day month', () => {
    const range = getMonthRange('2024-04');
    expect(range.start).toBe('2024-04-01');
    expect(range.end).toBe('2024-04-30');
  });

  it('returns correct end for February in a non-leap year', () => {
    const range = getMonthRange('2025-02');
    expect(range.start).toBe('2025-02-01');
    expect(range.end).toBe('2025-02-28');
  });

  it('returns correct end for February in a leap year', () => {
    const range = getMonthRange('2024-02');
    expect(range.start).toBe('2024-02-01');
    expect(range.end).toBe('2024-02-29');
  });
});

describe('getVatQuarter', () => {
  it('returns correct quarter for stagger group 1 (Apr–Jun is Q2)', () => {
    const result = getVatQuarter('2024-05-15', 1);
    expect(result.quarter).toBe(2);
    expect(result.year).toBe(2024);
    expect(result.start).toBe('2024-04-01');
    expect(result.end).toBe('2024-06-30');
    expect(result.label).toBe('Q2 2024/25');
  });

  it('returns correct quarter for stagger group 2 (Feb–Apr is Q1)', () => {
    const result = getVatQuarter('2024-03-15', 2);
    expect(result.quarter).toBe(1);
    expect(result.start).toBe('2024-02-01');
    expect(result.end).toBe('2024-04-30');
  });

  it('returns correct quarter for stagger group 3 (Mar–May is Q1)', () => {
    const result = getVatQuarter('2024-04-10', 3);
    expect(result.quarter).toBe(1);
    expect(result.start).toBe('2024-03-01');
    expect(result.end).toBe('2024-05-31');
  });

  it('handles Q4 crossing year boundary (Dec–Feb in stagger group 3)', () => {
    const result = getVatQuarter('2025-01-15', 3);
    expect(result.quarter).toBe(4);
    expect(result.year).toBe(2024);
    expect(result.start).toBe('2024-12-01');
    expect(result.end).toBe('2025-02-28');
  });
});

describe('formatCurrency additional', () => {
  it('handles very large numbers', () => {
    const result = formatCurrency(1234567.89, '£');
    expect(result).toBe('£1,234,567.89');
  });
});

describe('formatDate additional', () => {
  it('returns empty string for empty input', () => {
    expect(formatDate('')).toBe('');
  });
});

describe('formatMonth additional', () => {
  it('returns correct output for en-GB locale', () => {
    const result = formatMonth('2025-03', 'en-GB');
    expect(result).toContain('March');
    expect(result).toContain('2025');
  });
});

describe('getFinancialYear', () => {
  it('returns year for calendar year', () => {
    expect(getFinancialYear('2024-06-15', 'calendar')).toBe(2024);
  });

  it('returns correct year for apr-mar (before April)', () => {
    expect(getFinancialYear('2025-02-15', 'apr-mar')).toBe(2024);
  });

  it('returns correct year for apr-mar (after April)', () => {
    expect(getFinancialYear('2024-06-15', 'apr-mar')).toBe(2024);
  });

  it('returns correct year for apr-mar (exactly April)', () => {
    expect(getFinancialYear('2024-04-01', 'apr-mar')).toBe(2024);
  });

  it('returns correct year for apr-mar (March)', () => {
    expect(getFinancialYear('2024-03-31', 'apr-mar')).toBe(2023);
  });
});
