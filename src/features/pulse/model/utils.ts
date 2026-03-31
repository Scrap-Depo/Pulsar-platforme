import { PulseDistribution } from './types';

export function getPulseItems(distribution: PulseDistribution) {
  return Object.entries(distribution).map(([value, count]) => ({
    value: Number(value),
    count,
  }));
}

export function createPulseDistribution(baseDistribution: PulseDistribution, participantValue: number) {
  return {
    ...baseDistribution,
    [participantValue]: (baseDistribution[participantValue] ?? 0) + 1,
  };
}

export function getPulseAverage(distribution: PulseDistribution) {
  const items = getPulseItems(distribution);
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);

  if (totalCount === 0) {
    return 0;
  }

  const weightedTotal = items.reduce((sum, item) => sum + item.value * item.count, 0);
  return Number((weightedTotal / totalCount).toFixed(1));
}
