import type { TaxBreakdown, TaxBandResult, StudentLoanPlan } from './types';

type TaxYearRates = {
  personalAllowance: number;
  personalAllowanceTaperThreshold: number;
  incomeTaxBands: { name: string; from: number; to: number; rate: number }[];
  class2: {
    weeklyRate: number;
    smallProfitsThreshold: number;
    weeksInYear: number;
    voluntary: boolean;
  };
  class4: {
    lowerProfitsLimit: number;
    upperProfitsLimit: number;
    mainRate: number;
    additionalRate: number;
  };
};

const UK_TAX_RATES: Record<string, TaxYearRates> = {
  '2023/24': {
    personalAllowance: 12_570,
    personalAllowanceTaperThreshold: 100_000,
    incomeTaxBands: [
      { name: 'Personal Allowance', from: 0, to: 12_570, rate: 0 },
      { name: 'Basic rate', from: 12_570, to: 50_270, rate: 0.20 },
      { name: 'Higher rate', from: 50_270, to: 125_140, rate: 0.40 },
      { name: 'Additional rate', from: 125_140, to: Infinity, rate: 0.45 },
    ],
    class2: {
      weeklyRate: 3.45,
      smallProfitsThreshold: 6_725,
      weeksInYear: 52,
      voluntary: false,
    },
    class4: {
      lowerProfitsLimit: 12_570,
      upperProfitsLimit: 50_270,
      mainRate: 0.09,
      additionalRate: 0.02,
    },
  },
  '2024/25': {
    personalAllowance: 12_570,
    personalAllowanceTaperThreshold: 100_000,
    incomeTaxBands: [
      { name: 'Personal Allowance', from: 0, to: 12_570, rate: 0 },
      { name: 'Basic rate', from: 12_570, to: 50_270, rate: 0.20 },
      { name: 'Higher rate', from: 50_270, to: 125_140, rate: 0.40 },
      { name: 'Additional rate', from: 125_140, to: Infinity, rate: 0.45 },
    ],
    class2: {
      weeklyRate: 3.45,
      smallProfitsThreshold: 6_725,
      weeksInYear: 52,
      voluntary: true,
    },
    class4: {
      lowerProfitsLimit: 12_570,
      upperProfitsLimit: 50_270,
      mainRate: 0.06,
      additionalRate: 0.02,
    },
  },
  '2025/26': {
    personalAllowance: 12_570,
    personalAllowanceTaperThreshold: 100_000,
    incomeTaxBands: [
      { name: 'Personal Allowance', from: 0, to: 12_570, rate: 0 },
      { name: 'Basic rate', from: 12_570, to: 50_270, rate: 0.20 },
      { name: 'Higher rate', from: 50_270, to: 125_140, rate: 0.40 },
      { name: 'Additional rate', from: 125_140, to: Infinity, rate: 0.45 },
    ],
    class2: {
      weeklyRate: 3.45,
      smallProfitsThreshold: 6_725,
      weeksInYear: 52,
      voluntary: true,
    },
    class4: {
      lowerProfitsLimit: 12_570,
      upperProfitsLimit: 50_270,
      mainRate: 0.06,
      additionalRate: 0.02,
    },
  },
};

const STUDENT_LOAN_RATES: Record<Exclude<StudentLoanPlan, 'none'>, { threshold: number; rate: number }> = {
  plan1: { threshold: 22_015, rate: 0.09 },
  plan2: { threshold: 27_295, rate: 0.09 },
  plan4: { threshold: 27_660, rate: 0.09 },
  plan5: { threshold: 25_000, rate: 0.09 },
  postgrad: { threshold: 21_000, rate: 0.06 },
};

const TRADING_ALLOWANCE = 1_000;

export function getAvailableTaxYears(): string[] {
  return Object.keys(UK_TAX_RATES);
}

export function getTaxYearLabel(year: number): string {
  return `${year}/${String(year + 1).slice(2)}`;
}

export function getRatesForYear(taxYearLabel: string): { rates: TaxYearRates; ratesYear: string; fallback: boolean } {
  if (UK_TAX_RATES[taxYearLabel]) {
    return { rates: UK_TAX_RATES[taxYearLabel], ratesYear: taxYearLabel, fallback: false };
  }
  const available = Object.keys(UK_TAX_RATES);
  const fallbackYear = available[available.length - 1];
  return { rates: UK_TAX_RATES[fallbackYear], ratesYear: fallbackYear, fallback: true };
}

function calcIncomeTax(taxableProfit: number, rates: TaxYearRates): TaxBandResult[] {
  const adjustedPA =
    taxableProfit <= rates.personalAllowanceTaperThreshold
      ? rates.personalAllowance
      : Math.max(
          0,
          rates.personalAllowance -
            (taxableProfit - rates.personalAllowanceTaperThreshold) / 2
        );

  const bands = rates.incomeTaxBands.map((band) => ({ ...band }));
  bands[0] = { ...bands[0], to: adjustedPA };
  bands[1] = { ...bands[1], from: adjustedPA };

  return bands.map((band) => {
    const taxableInBand = Math.max(0, Math.min(taxableProfit, band.to) - band.from);
    return {
      name: band.name,
      from: band.from,
      to: band.to === Infinity ? null : band.to,
      rate: band.rate,
      taxableAmount: taxableInBand,
      tax: taxableInBand * band.rate,
    };
  });
}

function calcClass2NI(taxableProfit: number, rates: TaxYearRates, voluntaryOptIn: boolean): { amount: number; voluntary: boolean } {
  if (rates.class2.voluntary) {
    if (!voluntaryOptIn) return { amount: 0, voluntary: true };
    return { amount: rates.class2.weeklyRate * rates.class2.weeksInYear, voluntary: true };
  }
  if (taxableProfit < rates.class2.smallProfitsThreshold) return { amount: 0, voluntary: false };
  return { amount: rates.class2.weeklyRate * rates.class2.weeksInYear, voluntary: false };
}

function calcClass4NI(taxableProfit: number, rates: TaxYearRates): TaxBandResult[] {
  const c4 = rates.class4;
  const mainBand = Math.max(0, Math.min(taxableProfit, c4.upperProfitsLimit) - c4.lowerProfitsLimit);
  const additionalBand = Math.max(0, taxableProfit - c4.upperProfitsLimit);
  return [
    {
      name: 'Main rate',
      from: c4.lowerProfitsLimit,
      to: c4.upperProfitsLimit,
      rate: c4.mainRate,
      taxableAmount: mainBand,
      tax: mainBand * c4.mainRate,
    },
    {
      name: 'Additional rate',
      from: c4.upperProfitsLimit,
      to: null,
      rate: c4.additionalRate,
      taxableAmount: additionalBand,
      tax: additionalBand * c4.additionalRate,
    },
  ];
}

function calcStudentLoan(taxableProfit: number, plan: StudentLoanPlan): number {
  if (plan === 'none') return 0;
  const { threshold, rate } = STUDENT_LOAN_RATES[plan];
  return Math.max(0, (taxableProfit - threshold) * rate);
}

function calcTradingAllowance(grossIncome: number, expenses: number): { taxableProfit: number; used: boolean } {
  if (grossIncome <= TRADING_ALLOWANCE) {
    return { taxableProfit: 0, used: true };
  }
  const withExpenses = grossIncome - expenses;
  const withAllowance = grossIncome - TRADING_ALLOWANCE;
  if (withAllowance < withExpenses) {
    return { taxableProfit: withAllowance, used: true };
  }
  return { taxableProfit: withExpenses, used: false };
}

function calcPaymentsOnAccount(totalTax: number, year: number): TaxBreakdown['paymentsOnAccount'] {
  if (totalTax <= 1000) {
    return {
      applies: false,
      firstPayment: 0,
      secondPayment: 0,
      firstPaymentDate: '',
      secondPaymentDate: '',
    };
  }
  const half = Math.round(totalTax / 2 * 100) / 100;
  return {
    applies: true,
    firstPayment: half,
    secondPayment: half,
    firstPaymentDate: `${year + 1}-01-31`,
    secondPaymentDate: `${year + 1}-07-31`,
  };
}

export type CalculateUKTaxOptions = {
  year?: number;
  grossIncome?: number;
  allowableCosts?: number;
  nonAllowableCosts?: number;
  voluntaryClass2NI?: boolean;
  studentLoanPlan?: StudentLoanPlan;
};

export function calculateUKTax(grossProfit: number, options: CalculateUKTaxOptions = {}): TaxBreakdown {
  const year = options.year ?? 2024;
  const taxYearLabel = getTaxYearLabel(year);
  const { rates, ratesYear, fallback } = getRatesForYear(taxYearLabel);

  const allowableCosts = options.allowableCosts ?? 0;
  const nonAllowableCosts = options.nonAllowableCosts ?? 0;
  const voluntaryClass2NI = options.voluntaryClass2NI ?? false;
  const studentLoanPlan = options.studentLoanPlan ?? 'none';
  const grossIncomeProvided = options.grossIncome !== undefined;
  const grossIncome = options.grossIncome ?? Math.max(0, grossProfit);

  let taxableProfit: number;
  let tradingAllowanceUsed = false;

  if (grossIncomeProvided && grossIncome > 0) {
    const ta = calcTradingAllowance(grossIncome, allowableCosts);
    taxableProfit = ta.taxableProfit;
    tradingAllowanceUsed = ta.used;
  } else {
    taxableProfit = Math.max(0, grossProfit);
  }

  const incomeTaxBands = calcIncomeTax(taxableProfit, rates);
  const incomeTax = incomeTaxBands.reduce((s, b) => s + b.tax, 0);
  const class2Result = calcClass2NI(taxableProfit, rates, voluntaryClass2NI);
  const class4NIBands = calcClass4NI(taxableProfit, rates);
  const class4NI = class4NIBands.reduce((s, b) => s + b.tax, 0);
  const studentLoanRepayment = calcStudentLoan(taxableProfit, studentLoanPlan);
  const totalTax = incomeTax + class2Result.amount + class4NI + studentLoanRepayment;

  return {
    grossProfit: taxableProfit,
    grossIncome,
    allowableCosts,
    nonAllowableCosts,
    tradingAllowanceUsed,
    incomeTaxBands,
    incomeTax,
    class2NI: class2Result.amount,
    class2NIVoluntary: class2Result.voluntary,
    class4NIBands,
    class4NI,
    totalNI: class2Result.amount + class4NI,
    studentLoanRepayment,
    studentLoanPlan,
    totalTax,
    afterTax: taxableProfit - totalTax,
    taxYear: taxYearLabel,
    ratesYear,
    ratesFallback: fallback,
    paymentsOnAccount: calcPaymentsOnAccount(totalTax, year),
  };
}

export function calculateFlatTax(grossProfit: number, rate: number): TaxBreakdown {
  const taxableProfit = Math.max(0, grossProfit);
  const tax = taxableProfit * (rate / 100);
  return {
    grossProfit: taxableProfit,
    grossIncome: taxableProfit,
    allowableCosts: 0,
    nonAllowableCosts: 0,
    tradingAllowanceUsed: false,
    incomeTaxBands: [
      {
        name: 'Flat rate',
        from: 0,
        to: null,
        rate: rate / 100,
        taxableAmount: taxableProfit,
        tax,
      },
    ],
    incomeTax: tax,
    class2NI: 0,
    class2NIVoluntary: false,
    class4NIBands: [],
    class4NI: 0,
    totalNI: 0,
    studentLoanRepayment: 0,
    studentLoanPlan: 'none',
    totalTax: tax,
    afterTax: taxableProfit - tax,
    taxYear: '',
    ratesYear: '',
    ratesFallback: false,
    paymentsOnAccount: { applies: false, firstPayment: 0, secondPayment: 0, firstPaymentDate: '', secondPaymentDate: '' },
  };
}
