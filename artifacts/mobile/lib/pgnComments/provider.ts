import { createLivePgnTranslationProvider } from './liveProvider.ts';
import { tokensUnchanged } from './protectTokens.ts';
import type { PgnTranslationProvider, PgnTranslationProviderResult } from './types.ts';

export { UnconfiguredPgnTranslationProvider } from './unconfiguredProvider.ts';

/** Test-only provider. Never used as a production success path. */
export class FakePgnTranslationProvider implements PgnTranslationProvider {
  readonly configured = true;
  private readonly map: Record<string, string>;

  constructor(map: Record<string, string> = {}) {
    this.map = map;
  }

  async translateComments(
    batch: { id: string; text: string; context?: string }[],
  ): Promise<PgnTranslationProviderResult[]> {
    return batch.map((item) => {
      const text = this.map[item.id] ?? this.map[item.text];
      if (!text) return { id: item.id, error: 'rejected' as const };
      if (!tokensUnchanged(item.text, text)) {
        return { id: item.id, error: 'invalid' as const };
      }
      return { id: item.id, text };
    });
  }
}

export {
  HttpPgnTranslationProvider,
  createLivePgnTranslationProvider,
  resolvePgnTranslateUrl,
} from './liveProvider.ts';

export const defaultPgnTranslationProvider: PgnTranslationProvider =
  createLivePgnTranslationProvider();
