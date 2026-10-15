/**
 * Offline dictation models. Apache-2.0 Vosk models, pinned by archive hash.
 * They are downloaded by AnyChess, not bundled in the APK.
 */
export type DictationLanguage = 'fr' | 'en';

export type VoskModelSpec = {
  id: 'fr' | 'en';
  version: string;
  url: string;
  sha256: string;
  /** Top-level directory inside the zip. */
  directory: string;
  /** Decimal megabytes of the zip, for the confirmation text. */
  downloadMegabytes: number;
  /** Unpacked size reported by du, for the confirmation text. */
  installedMegabytes: number;
};

export const VOSK_ENGINE = {
  androidMaven: 'com.alphacephei:vosk-android:0.3.75',
  license: 'Apache-2.0',
} as const;

export const VOSK_MODELS: Record<DictationLanguage, VoskModelSpec> = {
  fr: {
    id: 'fr',
    version: 'vosk-model-small-fr-0.22',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip',
    sha256: 'cabf6180e177eb9b3a9a9d43a437bd5e549f3a7d09525e5d69a3fed787be12ad',
    directory: 'vosk-model-small-fr-0.22',
    downloadMegabytes: 42,
    installedMegabytes: 69,
  },
  en: {
    id: 'en',
    version: 'vosk-model-small-en-us-0.15',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
    sha256: '30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498',
    directory: 'vosk-model-small-en-us-0.15',
    downloadMegabytes: 41,
    installedMegabytes: 71,
  },
};

export function dictationLanguage(language: string | null | undefined): DictationLanguage {
  return language === 'en' ? 'en' : 'fr';
}
