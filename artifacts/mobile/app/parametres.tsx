/**
 * Paramètres — app preferences (language, notation, voice, coords, dictation pace).
 */
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ProfilNavRow } from '@/components/profil/ProfilNavRow';
import { BooleanSettingRow } from '@/components/ui/BooleanSettingRow';
import { OptionChip } from '@/components/ui/OptionChip';
import { PuzzleRatingBandSlider } from '@/components/puzzles/PuzzleRatingBandSlider';
import { PuzzleFilterChip } from '@/components/puzzles/PuzzleFilterChip';
import {
  DICTATION_PACES,
  type AppLanguage,
  type ChessNotation,
  type DictationPace,
} from '@/lib/preferences';
import { getPuzzleRatingBand } from '@/lib/puzzles';
import {
  getStrengthBand,
} from '@/lib/difficulty/StockfishStrengthBands';
import { StrengthBandSlider } from '@/components/ui/StrengthBandSlider';
import type { MessageKey } from '@/lib/i18n/messages';

type EditorKind =
  | null
  | 'language'
  | 'notation'
  | 'visualDifficulty'
  | 'blindDifficulty'
  | 'stockfishStrength';

const PACE_LABEL_KEYS: Record<DictationPace, MessageKey> = {
  slow: 'settings.paceSlow',
  quiteSlow: 'settings.paceQuiteSlow',
  medium: 'settings.paceMedium',
  quiteFast: 'settings.paceQuiteFast',
  fast: 'settings.paceFast',
};

export default function ParametresScreen() {
  const colors = useColors();
  const router = useRouter();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const { voiceEnabled, toggleVoice } = useAudioSettings();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const {
    language,
    chessNotation,
    dictationPace,
    visualProblemDifficulty,
    blindProblemDifficulty,
    stockfishStrengthBandId,
    updatePreferences,
    resetPreferences,
  } = usePreferences();
  const { t } = useTranslation();

  const [editor, setEditor] = useState<EditorKind>(null);

  const languageLabel = language === 'en' ? t('profil.langEn') : t('profil.langFr');
  const notationLabel =
    chessNotation === 'en' ? t('profil.notationEn') : t('profil.notationFr');
  const strengthLabel = getStrengthBand(stockfishStrengthBandId).label;

  const resetPrefs = () => {
    Alert.alert(t('profil.resetPrefsTitle'), t('profil.resetPrefsBody'), [
      { text: t('profil.cancel'), style: 'cancel' },
      {
        text: t('profil.reset'),
        style: 'destructive',
        onPress: () => {
          void resetPreferences();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.page,
        {
          paddingTop: topPad + DesignTokens.spacing.xl,
          paddingBottom: bottomPad + DesignTokens.spacing.xl,
        },
      ]}
      testID="parametres-screen"
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        onBack={() => router.back()}
        title={t('settings.title')}
        backTestID="parametres-back"
      />

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t('profil.sectionPreferences')}
      </Text>
      <View style={styles.section}>
        <ProfilNavRow
          label={t('profil.language')}
          value={languageLabel}
          onPress={() => setEditor('language')}
          testID="profil-row-language"
        />
        <ProfilNavRow
          label={t('profil.notation')}
          value={notationLabel}
          onPress={() => setEditor('notation')}
          testID="profil-row-notation"
        />
        <BooleanSettingRow
          label={t('profil.voice')}
          value={voiceEnabled}
          onToggle={() => {
            void toggleVoice();
          }}
          activeIcon="volume-high"
          inactiveIcon="volume-mute"
          testID="profil-pref-voice"
        />
        <BooleanSettingRow
          label={t('profil.coordinates')}
          value={showCoordinates}
          onToggle={() => {
            void toggleCoordinates();
          }}
          testID="profil-pref-coordinates"
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t('settings.dictationPace')}
      </Text>
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 12,
          fontFamily: DesignTokens.typography.weightRegular,
        }}
      >
        {t('settings.dictationPaceDesc')}
      </Text>
      <View style={styles.chipWrap} testID="parametres-pace-section">
        {DICTATION_PACES.map((pace) => (
          <OptionChip
            key={pace}
            label={t(PACE_LABEL_KEYS[pace])}
            active={dictationPace === pace}
            onPress={() => {
              void updatePreferences({ dictationPace: pace });
            }}
            testID={`parametres-pace-${pace}`}
            accessibilityLabel={t(PACE_LABEL_KEYS[pace])}
          />
        ))}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t('settings.problemDifficulty')}
      </Text>
      <View style={styles.section}>
        <ProfilNavRow
          label={t('settings.visualProblemDifficulty')}
          value={getPuzzleRatingBand(visualProblemDifficulty).label}
          onPress={() => setEditor('visualDifficulty')}
          testID="profil-row-visual-difficulty"
        />
        <ProfilNavRow
          label={t('settings.blindProblemDifficulty')}
          value={getPuzzleRatingBand(blindProblemDifficulty).label}
          onPress={() => setEditor('blindDifficulty')}
          testID="profil-row-blind-difficulty"
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t('settings.engineStrength')}
      </Text>
      <View style={styles.section}>
        <ProfilNavRow
          label={t('settings.stockfishStrength')}
          value={strengthLabel}
          onPress={() => setEditor('stockfishStrength')}
          testID="profil-row-stockfish-strength"
        />
      </View>

      <View style={styles.dangerZone}>
        <Pressable
          onPress={resetPrefs}
          testID="profil-reset-prefs"
          style={({ pressed }) => [
            styles.dangerBtn,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={{ color: colors.mutedForeground, fontFamily: DesignTokens.typography.weightSemiBold }}>
            {t('profil.resetPrefs')}
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={editor === 'language'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('profil.language')}
            </Text>
            <View style={styles.chipWrap}>
              {([
                { id: 'fr' as AppLanguage, label: t('profil.langFr') },
                { id: 'en' as AppLanguage, label: t('profil.langEn') },
              ]).map((opt) => (
                <OptionChip
                  key={opt.id}
                  label={opt.label}
                  active={language === opt.id}
                  onPress={() => {
                    void updatePreferences({ language: opt.id }).then(() => setEditor(null));
                  }}
                  testID={`profil-lang-${opt.id}`}
                />
              ))}
            </View>
            <Pressable onPress={() => setEditor(null)} style={styles.modalBtn}>
              <Text style={{ color: colors.mutedForeground }}>{t('profil.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editor === 'notation'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('profil.notation')}
            </Text>
            <View style={styles.chipWrap}>
              {([
                { id: 'fr' as ChessNotation, label: t('profil.notationFr') },
                { id: 'en' as ChessNotation, label: t('profil.notationEn') },
              ]).map((opt) => (
                <OptionChip
                  key={opt.id}
                  label={opt.label}
                  active={chessNotation === opt.id}
                  onPress={() => {
                    void updatePreferences({ chessNotation: opt.id }).then(() =>
                      setEditor(null),
                    );
                  }}
                  testID={`profil-notation-${opt.id}`}
                />
              ))}
            </View>
            <Pressable onPress={() => setEditor(null)} style={styles.modalBtn}>
              <Text style={{ color: colors.mutedForeground }}>{t('profil.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editor === 'visualDifficulty' || editor === 'blindDifficulty'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <PuzzleRatingBandSlider
              bandId={
                editor === 'blindDifficulty'
                  ? blindProblemDifficulty
                  : visualProblemDifficulty
              }
              onBandIdChange={(bandId) => {
                void updatePreferences(
                  editor === 'blindDifficulty'
                    ? { blindProblemDifficulty: bandId }
                    : { visualProblemDifficulty: bandId },
                );
              }}
              label={
                editor === 'blindDifficulty'
                  ? t('settings.blindProblemDifficulty')
                  : t('settings.visualProblemDifficulty')
              }
              testID={
                editor === 'blindDifficulty'
                  ? 'profil-blind-difficulty-slider'
                  : 'profil-visual-difficulty-slider'
              }
            />
            <View style={styles.chipWrap}>
              <PuzzleFilterChip
                label={t('puzzle.randomAll')}
                active={
                  (editor === 'blindDifficulty'
                    ? blindProblemDifficulty
                    : visualProblemDifficulty) === 'all'
                }
                onPress={() => {
                  void updatePreferences(
                    editor === 'blindDifficulty'
                      ? { blindProblemDifficulty: 'all' }
                      : { visualProblemDifficulty: 'all' },
                  );
                }}
              />
            </View>
            <Pressable
              onPress={() => setEditor(null)}
              style={[styles.modalBtn, { backgroundColor: colors.primary, alignSelf: 'stretch' }]}
              testID="profil-difficulty-done"
            >
              <Text
                style={{
                  color: colors.primaryForeground,
                  fontFamily: DesignTokens.typography.weightSemiBold,
                  textAlign: 'center',
                }}
              >
                OK
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={editor === 'stockfishStrength'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('settings.stockfishStrength')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {t('settings.stockfishStrengthHint')}
            </Text>
            <StrengthBandSlider
              bandId={stockfishStrengthBandId}
              onBandIdChange={(bandId) => {
                void updatePreferences({ stockfishStrengthBandId: bandId });
              }}
              testID="profil-stockfish-strength-slider"
            />
            <Pressable
              onPress={() => setEditor(null)}
              style={[styles.modalBtn, { backgroundColor: colors.primary, alignSelf: 'stretch' }]}
              testID="profil-stockfish-strength-done"
            >
              <Text
                style={{
                  color: colors.primaryForeground,
                  fontFamily: DesignTokens.typography.weightSemiBold,
                  textAlign: 'center',
                }}
              >
                OK
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: DesignTokens.spacing.screenX,
    gap: DesignTokens.spacing.md,
  },
  sectionLabel: {
    marginTop: DesignTokens.spacing.sm,
    fontSize: 11,
    letterSpacing: 0.6,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  section: { gap: 8 },
  dangerZone: { gap: 8, marginTop: DesignTokens.spacing.sm },
  dangerBtn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.spacing.lg,
    gap: DesignTokens.spacing.md,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: DesignTokens.typography.weightBold,
  },
  modalBtn: {
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
