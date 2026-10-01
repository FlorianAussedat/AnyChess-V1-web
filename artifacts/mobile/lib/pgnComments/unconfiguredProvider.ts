import type { PgnTranslationProvider, PgnTranslationProviderResult } from './types.ts';

export class UnconfiguredPgnTranslationProvider implements PgnTranslationProvider {
  readonly configured = false;

  async translateComments(
    batch: { id: string; text: string; context?: string }[],
  ): Promise<PgnTranslationProviderResult[]> {
    return batch.map((item) => ({ id: item.id, error: 'not_configured' as const }));
  }
}
