import type { TaxBreakdown, TaxBandResult } from './types';

const UK_2024_25 = {
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
  },
  class4: {
    lowerProfitsLimit: 12_570,
    upperProfitsLimit: 50_270,
    mainRate: 0.06,
    additionalRate: 0.02,
  },
};

function calcIncomeTax(taxableProfit: number): TaxBandResult[] {
  const adjustedPA =
    taxableProfit <= UK_2024_25.personalAllowanceTaperThreshold
      ? UK_2024_25.personalAllowance
      : Math.max(
          0,
          UK_2024_25.personalAllowance -
            (taxableProfit - UK_2024_25.personalAllowanceTaperThreshold) / 2
        );

  const bands = UK_2024_25.incomeTaxBands.map((band) => ({ ...band }));
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

function calcClass2NI(taxableProfit: number): number {
  if (taxableProfit < UK_2024_25.class2.smallProfitsThreshold) return 0;
  return UK_2024_25.class2.weeklyRate * UK_2024_25.class2.weeksInYear;
}

function calcClass4NI(taxableProfit: number): TaxBandResult[] {
  const c4 = UK_2024_25.class4;
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

export function calculateUKTax(grossProfit: number): TaxBreakdown {
  const taxableProfit = Math.max(0, grossProfit);
  const incomeTaxBands = calcIncomeTax(taxableProfit);
  const incomeTax = incomeTaxBands.reduce((s, b) => s + b.tax, 0);
  const class2NI = calcClass2NI(taxableProfit);
  const class4NIBands = calcClass4NI(taxableProfit);
  const class4NI = class4NIBands.reduce((s, b) => s + b.tax, 0);
  const totalTax = incomeTax + class2NI + class4NI;

  return {
    grossProfit: taxableProfit,
    incomeTaxBands,
    incomeTax,
    class2NI,
    class4NIBands,
    class4NI,
    totalNI: class2NI + class4NI,
    totalTax,
    afterTax: taxableProfit - totalTax,
  };
}

export function calculateFlatTax(grossProfit: number, rate: number): TaxBreakdown {
  const taxableProfit = Math.max(0, grossProfit);
  const tax = taxableProfit * (rate / 100);
  return {
    grossProfit: taxableProfit,
    incomeTaxBands: [
      {
        name: `Flat rate`,
        from: 0,
        to: null,
        rate: rate / 100,
        taxableAmount: taxableProfit,
        tax,
      },
    ],
    incomeTax: tax,
    class2NI: 0,
    class4NIBands: [],
    class4NI: 0,
    totalNI: 0,
    totalTax: tax,
    afterTax: taxableProfit - tax,
  };
}
