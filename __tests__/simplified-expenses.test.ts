import { describe, it, expect } from 'vitest';
import { calculateMileageAllowance, calculateWorkingFromHomeAllowance } from '../lib/simplified-expenses';

describe('calculateMileageAllowance', () => {
  it('calculates car mileage under threshold', () => {
    expect(calculateMileageAllowance(5000, 'car', 0)).toBe(5000 * 0.45);
  });

  it('calculates car mileage crossing threshold (12,000 miles total)', () => {
    const result = calculateMileageAllowance(12000, 'car', 0);
    expect(result).toBe(10000 * 0.45 + 2000 * 0.25);
  });

  it('uses after rate when previous miles exceed threshold', () => {
    const result = calculateMileageAllowance(5000, 'car', 11000);
    expect(result).toBe(5000 * 0.25);
  });

  it('splits correctly with previous miles below threshold', () => {
    const result = calculateMileageAllowance(5000, 'car', 8000);
    expect(result).toBe(2000 * 0.45 + 3000 * 0.25);
  });

  it('calculates motorcycle mileage (flat rate)', () => {
    expect(calculateMileageAllowance(5000, 'motorcycle', 0)).toBe(5000 * 0.24);
  });

  it('calculates bicycle mileage (flat rate)', () => {
    expect(calculateMileageAllowance(100, 'bicycle', 0)).toBe(100 * 0.20);
  });
});

describe('calculateWorkingFromHomeAllowance', () => {
  it('returns £26 for 101+ hours', () => {
    expect(calculateWorkingFromHomeAllowance(120)).toBe(26);
  });

  it('returns £18 for 51-100 hours', () => {
    expect(calculateWorkingFromHomeAllowance(60)).toBe(18);
  });

  it('returns £10 for 25-50 hours', () => {
    expect(calculateWorkingFromHomeAllowance(30)).toBe(10);
  });

  it('returns £0 for under 25 hours', () => {
    expect(calculateWorkingFromHomeAllowance(20)).toBe(0);
  });

  it('returns £10 at exactly 25 hours', () => {
    expect(calculateWorkingFromHomeAllowance(25)).toBe(10);
  });

  it('returns £18 at exactly 51 hours', () => {
    expect(calculateWorkingFromHomeAllowance(51)).toBe(18);
  });

  it('returns £26 at exactly 101 hours', () => {
    expect(calculateWorkingFromHomeAllowance(101)).toBe(26);
  });
});
