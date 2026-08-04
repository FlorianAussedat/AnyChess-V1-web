/** True when `score` strictly beats the previous best (ties do not count). */
export function isRecordBeat(score: number, previousRecord: number): boolean {
  return score > previousRecord;
}
