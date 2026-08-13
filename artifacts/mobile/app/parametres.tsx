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
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { ProfilNavRow } from '@/components/profil/ProfilNavRow';
import { BooleanSettingRow } from '@/components/ui/BooleanSettingRow';
import { OptionChip } from '@/components/ui/OptionChip';
import {
  DICTATION_PACES,
  type AppLanguage,
  type ChessNotation,
  type DictationPace,
} from '@/lib/preferences';
import type { MessageKey } from '@/lib/i18n/messages';

type EditorKind = null | 'language' | 'notation';

const PACE_LABEL_KEYS: Record<DictationPace, MessageKey> = {
  slow: 'settings.paceSlow',
  quiteSlow: 'settings.paceQuiteSlow',
  medium: 'settings.paceMedium',
  quiteFast: 'settings.paceQuiteFast',
  fast: 'settings.paceFast',
};

export default function ParametresScreen() {
  const colors = useColors();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const { voiceEnabled, toggleVoice } = useAudioSettings();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { language, chessNotation, dictationPace, updatePreferences, resetPreferences } =
    usePreferences();
  const { t } = useTranslation();

  const [editor, setEditor] = useState<EditorKind>(null);

  const languageLabel = language === 'en' ? t('profil.langEn') : t('profil.langFr');
  const notationLabel =
    chessNotation === 'en' ? t('profil.notationEn') : t('profil.notationFr');

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
      <Text style={[styles.title, { color: colors.foreground }]}>
        {t('settings.title')}
      </Text>

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
          />
        ))}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: DesignTokens.spacing.screenX,
    gap: DesignTokens.spacing.md,
  },
  title: {
    fontSize: DesignTokens.typography.title,
    fontFamily: DesignTokens.typography.weightBold,
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
