import { describe, it, expect } from 'vitest';
import { calculateVatAmount, getNetAmount, calculateVatReturn } from '../lib/vat';
import type { Transaction, Settings } from '../lib/types';
import { defaultSettings } from '../lib/defaults';

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: '1',
    date: '2024-06-15',
    type: 'income',
    amount: 1000,
    description: 'Test',
    category: 'Consulting',
    clientId: null,
    invoiceId: null,
    notes: '',
    vatRate: 20,
    vatAmount: 200,
    taxDeductible: true,
    attachments: [],
    ...overrides,
  };
}

describe('calculateVatAmount', () => {
  it('calculates VAT exclusive', () => {
    expect(calculateVatAmount(1000, 20, false)).toBe(200);
  });

  it('calculates VAT inclusive', () => {
    const vat = calculateVatAmount(1200, 20, true);
    expect(vat).toBeCloseTo(200, 2);
  });

  it('returns 0 for null rate', () => {
    expect(calculateVatAmount(1000, null)).toBe(0);
  });

  it('returns 0 for zero rate', () => {
    expect(calculateVatAmount(1000, 0)).toBe(0);
  });

  it('calculates reduced rate', () => {
    expect(calculateVatAmount(1000, 5, false)).toBe(50);
  });
});

describe('getNetAmount', () => {
  it('returns amount for exclusive', () => {
    expect(getNetAmount(1000, 20, false)).toBe(1000);
  });

  it('strips VAT for inclusive', () => {
    expect(getNetAmount(1200, 20, true)).toBeCloseTo(1000, 2);
  });

  it('returns amount for null rate', () => {
    expect(getNetAmount(1000, null)).toBe(1000);
  });
});

describe('calculateVatReturn', () => {
  it('calculates standard scheme return', () => {
    const settings: Settings = { ...defaultSettings, vatRegistered: true, vatScheme: 'standard' };
    const txs: Transaction[] = [
      makeTx({ type: 'income', amount: 1000, vatRate: 20, vatAmount: 200, date: '2024-06-15' }),
      makeTx({ type: 'cost', amount: 500, vatRate: 20, vatAmount: 100, date: '2024-06-20', id: '2' }),
    ];

    const result = calculateVatReturn(txs, '2024-04-01', '2024-06-30', settings);
    expect(result.box1).toBe(200);
    expect(result.box4).toBe(100);
    expect(result.box5).toBe(100);
    expect(result.box6).toBe(1000);
    expect(result.box7).toBe(500);
  });

  it('calculates flat rate scheme return', () => {
    const settings: Settings = { ...defaultSettings, vatRegistered: true, vatScheme: 'flat-rate', vatFlatRate: 14.5 };
    const txs: Transaction[] = [
      makeTx({ type: 'income', amount: 1000, vatRate: 20, vatAmount: 200, date: '2024-06-15' }),
    ];

    const result = calculateVatReturn(txs, '2024-04-01', '2024-06-30', settings);
    expect(result.box1).toBeCloseTo(1200 * 0.145, 2);
    expect(result.box4).toBe(0);
  });

  it('only includes transactions in period', () => {
    const settings: Settings = { ...defaultSettings, vatRegistered: true, vatScheme: 'standard' };
    const txs: Transaction[] = [
      makeTx({ type: 'income', amount: 1000, vatAmount: 200, date: '2024-06-15' }),
      makeTx({ type: 'income', amount: 2000, vatAmount: 400, date: '2024-08-15', id: '2' }),
    ];

    const result = calculateVatReturn(txs, '2024-04-01', '2024-06-30', settings);
    expect(result.box1).toBe(200);
  });
});
