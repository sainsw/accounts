import { describe, it, expect } from 'vitest';
import {
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_COST_CATEGORIES,
  UK_COST_CATEGORIES,
  DEFAULT_COST_CATEGORY_META,
  defaultSettings,
  STORAGE_KEYS,
} from '../lib/defaults';

describe('DEFAULT_INCOME_CATEGORIES', () => {
  it('is non-empty and contains expected categories', () => {
    expect(DEFAULT_INCOME_CATEGORIES.length).toBeGreaterThan(0);
    expect(DEFAULT_INCOME_CATEGORIES).toContain('Consulting');
    expect(DEFAULT_INCOME_CATEGORIES).toContain('Other Income');
  });
});

describe('DEFAULT_COST_CATEGORIES', () => {
  it('is non-empty and contains expected categories', () => {
    expect(DEFAULT_COST_CATEGORIES.length).toBeGreaterThan(0);
    expect(DEFAULT_COST_CATEGORIES).toContain('Software & Tools');
    expect(DEFAULT_COST_CATEGORIES).toContain('Other Cost');
  });
});

describe('UK_COST_CATEGORIES', () => {
  it('contains all 20 UK-specific categories', () => {
    expect(UK_COST_CATEGORIES).toHaveLength(20);
    expect(UK_COST_CATEGORIES).toContain('Vehicle / Mileage');
    expect(UK_COST_CATEGORIES).toContain('Accountancy Fees');
    expect(UK_COST_CATEGORIES).toContain('Telephone & Internet');
    expect(UK_COST_CATEGORIES).toContain('Use of Home');
    expect(UK_COST_CATEGORIES).toContain('Subscriptions & Memberships');
    expect(UK_COST_CATEGORIES).toContain('Fines & Penalties');
  });
});

describe('DEFAULT_COST_CATEGORY_META', () => {
  it('has an entry for every UK cost category', () => {
    const metaNames = DEFAULT_COST_CATEGORY_META.map((m) => m.name);
    for (const cat of UK_COST_CATEGORIES) {
      expect(metaNames).toContain(cat);
    }
  });

  it('marks "Fines & Penalties" as non-allowable', () => {
    const entry = DEFAULT_COST_CATEGORY_META.find((m) => m.name === 'Fines & Penalties');
    expect(entry).toBeDefined();
    expect(entry!.allowable).toBe('no');
  });

  it('marks "Meals & Entertainment" as partial', () => {
    const entry = DEFAULT_COST_CATEGORY_META.find((m) => m.name === 'Meals & Entertainment');
    expect(entry).toBeDefined();
    expect(entry!.allowable).toBe('partial');
  });

  it('marks "Telephone & Internet" as partial', () => {
    const entry = DEFAULT_COST_CATEGORY_META.find((m) => m.name === 'Telephone & Internet');
    expect(entry).toBeDefined();
    expect(entry!.allowable).toBe('partial');
  });
});

describe('defaultSettings', () => {
  it('has all required Settings fields with sensible defaults', () => {
    expect(defaultSettings.businessName).toBe('');
    expect(defaultSettings.currencySymbol).toBe('$');
    expect(defaultSettings.taxYear).toBe('calendar');
    expect(defaultSettings.taxMode).toBe('flat');
    expect(defaultSettings.taxRate).toBe(0);
    expect(defaultSettings.vatRegistered).toBe(false);
    expect(defaultSettings.vatScheme).toBe('standard');
    expect(defaultSettings.studentLoanPlan).toBe('none');
    expect(defaultSettings.accountingBasis).toBe('cash');
    expect(defaultSettings.lastExportDate).toBeNull();
    expect(Array.isArray(defaultSettings.incomeCategories)).toBe(true);
    expect(Array.isArray(defaultSettings.costCategories)).toBe(true);
  });
});

describe('STORAGE_KEYS', () => {
  it('contains keys for all persisted stores', () => {
    expect(STORAGE_KEYS.settings).toBeDefined();
    expect(STORAGE_KEYS.transactions).toBeDefined();
    expect(STORAGE_KEYS.clients).toBeDefined();
    expect(STORAGE_KEYS.invoices).toBeDefined();
    expect(STORAGE_KEYS.onboardingDone).toBeDefined();
  });
});
