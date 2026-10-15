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
  /** Exact zip size in bytes. */
  downloadBytes: number;
  /** Exact unpacked size in bytes. */
  installedBytes: number;
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
    downloadBytes: 42_233_323,
    installedBytes: 68_483_807,
  },
  en: {
    id: 'en',
    version: 'vosk-model-small-en-us-0.15',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
    sha256: '30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498',
    directory: 'vosk-model-small-en-us-0.15',
    downloadBytes: 41_205_931,
    installedBytes: 70_898_967,
  },
};

/**
 * The English small model ships with lattice-beam 2, which drops a confusable
 * file (e versus d) before the app ever sees it. A wider lattice keeps that
 * alternative so the move is refused instead of played. The French model is
 * already wider and is left unchanged.
 */
export function tuneVoskModelConf(text: string): string {
  const lattice = text.match(/^--lattice-beam=(\S+)/m);
  const value = lattice ? Number(lattice[1]) : 0;
  if (Number.isFinite(value) && value >= 4) return text;
  return text
    .replace(/^--beam=.*$/m, '--beam=15.0')
    .replace(/^--lattice-beam=.*$/m, '--lattice-beam=8.0')
    .replace(/^--max-active=.*$/m, '--max-active=7000');
}

export function dictationLanguage(language: string | null | undefined): DictationLanguage {
  return language === 'en' ? 'en' : 'fr';
}

/** Stored dictation language wins. Otherwise the app language is used. */
export function activeDictationLanguage(prefs: {
  language?: string | null;
  dictationLanguage?: string | null;
}): DictationLanguage {
  if (prefs.dictationLanguage === 'fr' || prefs.dictationLanguage === 'en') {
    return prefs.dictationLanguage;
  }
  return dictationLanguage(prefs.language);
}

function groupDigits(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}

/** Real archive size, grouped, plus the decimal megabyte figure from those bytes. */
export function formatDownloadSize(bytes: number, language: DictationLanguage): string {
  const mb = (bytes / 1_000_000).toFixed(1);
  const mega = language === 'fr' ? `${mb.replace('.', ',')} Mo` : `${mb} MB`;
  const unit = language === 'fr' ? 'octets' : 'bytes';
  return `${groupDigits(bytes)} ${unit} (${mega})`;
}
