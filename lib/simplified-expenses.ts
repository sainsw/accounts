export type VehicleType = 'car' | 'motorcycle' | 'bicycle';

const MILEAGE_RATES: Record<VehicleType, { first: number; after: number; threshold: number }> = {
  car: { first: 0.45, after: 0.25, threshold: 10_000 },
  motorcycle: { first: 0.24, after: 0.24, threshold: Infinity },
  bicycle: { first: 0.20, after: 0.20, threshold: Infinity },
};

const WORKING_FROM_HOME_RATES = [
  { minHours: 101, maxHours: Infinity, monthlyRate: 26 },
  { minHours: 51, maxHours: 100, monthlyRate: 18 },
  { minHours: 25, maxHours: 50, monthlyRate: 10 },
] as const;

export function calculateMileageAllowance(
  miles: number,
  vehicleType: VehicleType,
  previousMilesInYear: number = 0
): number {
  const rates = MILEAGE_RATES[vehicleType];
  const totalMiles = previousMilesInYear + miles;
  const threshold = rates.threshold;

  if (previousMilesInYear >= threshold) {
    return miles * rates.after;
  }

  const milesAtFirst = Math.max(0, Math.min(miles, threshold - previousMilesInYear));
  const milesAtAfter = miles - milesAtFirst;

  return milesAtFirst * rates.first + milesAtAfter * rates.after;
}

export function calculateWorkingFromHomeAllowance(monthlyHours: number): number {
  for (const band of WORKING_FROM_HOME_RATES) {
    if (monthlyHours >= band.minHours) {
      return band.monthlyRate;
    }
  }
  return 0;
}
