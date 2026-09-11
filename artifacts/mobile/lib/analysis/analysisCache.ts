import type { AnalysisProfileId, PositionAnalysis } from './types.ts';

export function makeAnalysisCacheKey(
  fen: string,
  profileId: AnalysisProfileId,
  depth: number,
  multiPv: number,
): string {
  const core = fen.trim().split(/\s+/).slice(0, 4).join(' ');
  return `${core}|${profileId}|d${depth}|mpv${multiPv}`;
}

export class AnalysisCache {
  private readonly map = new Map<string, PositionAnalysis>();

  get(key: string): PositionAnalysis | undefined {
    return this.map.get(key);
  }

  set(key: string, value: PositionAnalysis): void {
    this.map.set(key, value);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
