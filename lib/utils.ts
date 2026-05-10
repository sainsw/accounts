export function generateId(): string {
  return crypto.randomUUID();
}

export function formatCurrency(amount: number, symbol: string = '$'): string {
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

export function formatDate(dateStr: string, locale: string = 'en-US'): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonth(dateStr: string, locale: string = 'en-US'): string {
  if (!dateStr) return '';
  const [y, m] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1);
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function monthString(): string {
  return todayString().slice(0, 7);
}

export function getMonthRange(monthStr: string): { start: string; end: string } {
  const [y, m] = monthStr.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${monthStr}-01`,
    end: `${monthStr}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function getYearRange(
  year: number,
  taxYear: string
): { start: string; end: string } {
  switch (taxYear) {
    case 'apr-mar':
      return {
        start: `${year}-04-01`,
        end: `${year + 1}-03-31`,
      };
    case 'jul-jun':
      return {
        start: `${year}-07-01`,
        end: `${year + 1}-06-30`,
      };
    case 'oct-sep':
      return {
        start: `${year}-10-01`,
        end: `${year + 1}-09-30`,
      };
    default:
      return {
        start: `${year}-01-01`,
        end: `${year}-12-31`,
      };
  }
}

export function isInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getFinancialYear(date: string, taxYear: string): number {
  const [y, m] = date.split('-').map(Number);
  switch (taxYear) {
    case 'apr-mar':
      return m >= 4 ? y : y - 1;
    case 'jul-jun':
      return m >= 7 ? y : y - 1;
    case 'oct-sep':
      return m >= 10 ? y : y - 1;
    default:
      return y;
  }
}

export function getVatQuarter(date: string, staggerGroup: number = 1): { quarter: number; year: number; label: string; start: string; end: string } {
  const [y, m] = date.split('-').map(Number);
  const offset = ((staggerGroup - 1) % 3);
  const adjustedMonth = ((m - 1 - offset + 12) % 12);
  const quarter = Math.floor(adjustedMonth / 3) + 1;

  const qStartMonth = ((quarter - 1) * 3 + offset) % 12 + 1;
  const qStartYear = qStartMonth > m ? y - 1 : y;
  const qEndMonth = (qStartMonth + 2 - 1) % 12 + 1;
  const qEndYear = qEndMonth < qStartMonth ? qStartYear + 1 : qStartYear;
  const lastDay = new Date(qEndYear, qEndMonth, 0).getDate();

  return {
    quarter,
    year: qStartYear,
    label: `Q${quarter} ${qStartYear}/${String(qStartYear + 1).slice(2)}`,
    start: `${qStartYear}-${String(qStartMonth).padStart(2, '0')}-01`,
    end: `${qEndYear}-${String(qEndMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}
