/**
 * Canonical scenario colours — used in the What-if list AND all Output charts.
 * Order matters: the i-th What-if (by creation order) gets SCENARIO_COLORS[i % length].
 */
export const SCENARIO_COLORS = [
  '#3B82F6', // blue
  '#22C55E', // green
  '#A855F7', // purple
  '#F97316', // orange
  '#14B8A6', // teal
  '#F43F5E', // rose
  '#6366F1', // indigo
  '#F59E0B', // amber
] as const;

/** Get the colour for the n-th scenario (0-indexed) */
export function getScenarioColor(index: number): string {
  return SCENARIO_COLORS[index % SCENARIO_COLORS.length];
}
