import { describe, it, expect } from 'vitest';
import { calculateUKTax, calculateFlatTax, getRatesForYear, getTaxYearLabel, getAvailableTaxYears } from '../lib/tax';

describe('getTaxYearLabel', () => {
  it('formats year as YYYY/YY', () => {
    expect(getTaxYearLabel(2024)).toBe('2024/25');
    expect(getTaxYearLabel(2023)).toBe('2023/24');
  });
});

describe('getAvailableTaxYears', () => {
  it('returns at least 2023/24, 2024/25, 2025/26', () => {
    const years = getAvailableTaxYears();
    expect(years).toContain('2023/24');
    expect(years).toContain('2024/25');
    expect(years).toContain('2025/26');
  });
});

describe('getRatesForYear', () => {
  it('returns exact match without fallback', () => {
    const result = getRatesForYear('2024/25');
    expect(result.fallback).toBe(false);
    expect(result.ratesYear).toBe('2024/25');
  });

  it('falls back to latest year for unknown year', () => {
    const result = getRatesForYear('2030/31');
    expect(result.fallback).toBe(true);
    expect(result.ratesYear).toBe('2025/26');
  });
});

describe('calculateUKTax - 2024/25', () => {
  it('returns zero tax for zero profit', () => {
    const result = calculateUKTax(0, { year: 2024 });
    expect(result.totalTax).toBe(0);
    expect(result.afterTax).toBe(0);
    expect(result.ratesFallback).toBe(false);
    expect(result.taxYear).toBe('2024/25');
  });

  it('returns zero tax below personal allowance', () => {
    const result = calculateUKTax(10000, { year: 2024 });
    expect(result.incomeTax).toBe(0);
    expect(result.class4NI).toBe(0);
    expect(result.class2NI).toBe(0);
  });

  it('calculates basic rate correctly', () => {
    const result = calculateUKTax(30000, { year: 2024 });
    const expectedIncomeTax = (30000 - 12570) * 0.20;
    expect(result.incomeTax).toBeCloseTo(expectedIncomeTax, 2);
  });

  it('calculates Class 4 NI at 6% for 2024/25', () => {
    const result = calculateUKTax(30000, { year: 2024 });
    const expectedClass4 = (30000 - 12570) * 0.06;
    expect(result.class4NI).toBeCloseTo(expectedClass4, 2);
  });

  it('does not include Class 2 NI by default for 2024/25 (voluntary)', () => {
    const result = calculateUKTax(30000, { year: 2024 });
    expect(result.class2NI).toBe(0);
    expect(result.class2NIVoluntary).toBe(true);
  });

  it('includes Class 2 NI when voluntarily opted in for 2024/25', () => {
    const result = calculateUKTax(30000, { year: 2024, voluntaryClass2NI: true });
    expect(result.class2NI).toBe(3.45 * 52);
  });

  it('tapers personal allowance above £100,000', () => {
    const result = calculateUKTax(120000, { year: 2024 });
    const adjustedPA = Math.max(0, 12570 - (120000 - 100000) / 2);
    expect(adjustedPA).toBe(2570);
    expect(result.incomeTaxBands[0].to).toBe(adjustedPA);
  });

  it('handles higher rate income', () => {
    const result = calculateUKTax(60000, { year: 2024 });
    const basicTax = (50270 - 12570) * 0.20;
    const higherTax = (60000 - 50270) * 0.40;
    expect(result.incomeTax).toBeCloseTo(basicTax + higherTax, 2);
  });

  it('handles additional rate income', () => {
    const result = calculateUKTax(150000, { year: 2024 });
    expect(result.incomeTaxBands[3].taxableAmount).toBeGreaterThan(0);
    expect(result.incomeTaxBands[3].rate).toBe(0.45);
  });
});

describe('calculateUKTax - 2023/24', () => {
  it('uses 9% Class 4 main rate for 2023/24', () => {
    const result = calculateUKTax(30000, { year: 2023 });
    const expectedClass4 = (30000 - 12570) * 0.09;
    expect(result.class4NI).toBeCloseTo(expectedClass4, 2);
    expect(result.taxYear).toBe('2023/24');
  });

  it('Class 2 is compulsory for 2023/24 above small profits threshold', () => {
    const result = calculateUKTax(10000, { year: 2023 });
    expect(result.class2NI).toBe(3.45 * 52);
    expect(result.class2NIVoluntary).toBe(false);
  });

  it('Class 2 is waived below small profits threshold for 2023/24', () => {
    const result = calculateUKTax(5000, { year: 2023 });
    expect(result.class2NI).toBe(0);
  });
});

describe('calculateUKTax - 2025/26 (or fallback)', () => {
  it('uses 2025/26 rates when available', () => {
    const result = calculateUKTax(30000, { year: 2025 });
    expect(result.ratesFallback).toBe(false);
    expect(result.ratesYear).toBe('2025/26');
  });

  it('shows fallback warning for unavailable year', () => {
    const result = calculateUKTax(30000, { year: 2030 });
    expect(result.ratesFallback).toBe(true);
  });
});

describe('Trading allowance', () => {
  it('zeroes profit when gross income <= £1,000', () => {
    const result = calculateUKTax(600, { year: 2024, grossIncome: 800, allowableCosts: 200 });
    expect(result.grossProfit).toBe(0);
    expect(result.tradingAllowanceUsed).toBe(true);
    expect(result.totalTax).toBe(0);
  });

  it('uses trading allowance when better than expenses (income £5,000, expenses £300)', () => {
    const result = calculateUKTax(4700, { year: 2024, grossIncome: 5000, allowableCosts: 300 });
    expect(result.tradingAllowanceUsed).toBe(true);
    expect(result.grossProfit).toBe(4000);
  });

  it('uses actual expenses when better than trading allowance', () => {
    const result = calculateUKTax(3000, { year: 2024, grossIncome: 5000, allowableCosts: 2000 });
    expect(result.tradingAllowanceUsed).toBe(false);
    expect(result.grossProfit).toBe(3000);
  });
});

describe('Student loan repayment', () => {
  it('Plan 2 with £40,000 profit', () => {
    const result = calculateUKTax(40000, { year: 2024, studentLoanPlan: 'plan2' });
    const expected = (40000 - 27295) * 0.09;
    expect(result.studentLoanRepayment).toBeCloseTo(expected, 2);
    expect(result.studentLoanPlan).toBe('plan2');
  });

  it('no student loan with plan none', () => {
    const result = calculateUKTax(40000, { year: 2024, studentLoanPlan: 'none' });
    expect(result.studentLoanRepayment).toBe(0);
  });

  it('postgraduate loan at 6%', () => {
    const result = calculateUKTax(40000, { year: 2024, studentLoanPlan: 'postgrad' });
    const expected = (40000 - 21000) * 0.06;
    expect(result.studentLoanRepayment).toBeCloseTo(expected, 2);
  });

  it('no repayment below threshold', () => {
    const result = calculateUKTax(20000, { year: 2024, studentLoanPlan: 'plan2' });
    expect(result.studentLoanRepayment).toBe(0);
  });
});

describe('Payments on account', () => {
  it('does not apply when total tax <= £1,000', () => {
    const result = calculateUKTax(15000, { year: 2024 });
    expect(result.paymentsOnAccount.applies).toBe(false);
  });

  it('applies with correct amounts and dates for large tax bill', () => {
    const result = calculateUKTax(60000, { year: 2024 });
    expect(result.paymentsOnAccount.applies).toBe(true);
    const half = Math.round(result.totalTax / 2 * 100) / 100;
    expect(result.paymentsOnAccount.firstPayment).toBe(half);
    expect(result.paymentsOnAccount.secondPayment).toBe(half);
    expect(result.paymentsOnAccount.firstPaymentDate).toBe('2025-01-31');
    expect(result.paymentsOnAccount.secondPaymentDate).toBe('2025-07-31');
  });
});

describe('Non-allowable costs', () => {
  it('tracks allowable and non-allowable cost amounts', () => {
    const result = calculateUKTax(3000, {
      year: 2024,
      grossIncome: 5000,
      allowableCosts: 2000,
      nonAllowableCosts: 500,
    });
    expect(result.allowableCosts).toBe(2000);
    expect(result.nonAllowableCosts).toBe(500);
  });
});

describe('calculateFlatTax', () => {
  it('calculates flat rate correctly', () => {
    const result = calculateFlatTax(50000, 25);
    expect(result.totalTax).toBe(12500);
    expect(result.afterTax).toBe(37500);
  });

  it('returns zero for negative profit', () => {
    const result = calculateFlatTax(-1000, 20);
    expect(result.grossProfit).toBe(0);
    expect(result.totalTax).toBe(0);
  });

  it('does not include NI or student loan', () => {
    const result = calculateFlatTax(50000, 20);
    expect(result.class2NI).toBe(0);
    expect(result.class4NI).toBe(0);
    expect(result.studentLoanRepayment).toBe(0);
    expect(result.totalNI).toBe(0);
  });
});
