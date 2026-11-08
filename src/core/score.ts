/** A header or badge score: how many of `total` are on track. Pure. */
export interface Score {
  /** Hit (weekly) or on pace (year) so far. */
  achieved: number;
  total: number;
}

/** "2/5" */
export function formatScore(score: Score): string {
  return `${score.achieved}/${score.total}`;
}
