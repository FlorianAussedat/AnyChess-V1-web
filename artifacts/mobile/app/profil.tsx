/**
 * Profil / Mes données — local-only control center.
 * Sole settings hub: profile identity + preferences + data links.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useDefaultVoiceSpeed } from '@/hooks/useDefaultVoiceSpeed';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { ProfilNavRow } from '@/components/profil/ProfilNavRow';
import { BooleanSettingRow } from '@/components/ui/BooleanSettingRow';
import { DiscreteSlider } from '@/components/ui/DiscreteSlider';
import { OptionChip } from '@/components/ui/OptionChip';
import {
  PLAYER_ELO_RANGES,
  getPlayerEloRange,
  CHESS_YEARS_MAX,
  CHESS_YEARS_MIN,
} from '@/lib/profile';
import {
  VOICE_SPEED_MAX,
  VOICE_SPEED_MIN,
} from '@/lib/continueLine/voiceSpeed';
import { repertoireService } from '@/lib/repertoire';
import {
  RECORDS_CATEGORIES,
  countActiveRecordCategories,
  resetAllCatalogRecords,
} from '@/lib/records/AnyChessRecords';
import type { AppLanguage, ChessNotation } from '@/lib/preferences';

type EditorKind =
  | null
  | 'username'
  | 'rapid'
  | 'blitz'
  | 'bullet'
  | 'years'
  | 'voiceSpeed'
  | 'language'
  | 'notation';

const YEAR_OPTIONS = Array.from(
  { length: Math.min(21, CHESS_YEARS_MAX - CHESS_YEARS_MIN + 1) },
  (_, i) => CHESS_YEARS_MIN + i,
);

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const { profile, updateProfile } = useUserProfile();
  const { voiceEnabled, toggleVoice } = useAudioSettings();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { speed: voiceSpeed, setDefaultSpeed } = useDefaultVoiceSpeed();
  const { language, chessNotation, updatePreferences, resetPreferences } =
    usePreferences();
  const { t } = useTranslation();

  const [editor, setEditor] = useState<EditorKind>(null);
  const [draftUsername, setDraftUsername] = useState('');
  const [repertoireCount, setRepertoireCount] = useState(0);
  const [activeRecords, setActiveRecords] = useState(0);

  const reloadSummaries = useCallback(async () => {
    await repertoireService.ensureLoaded();
    setRepertoireCount(repertoireService.getFolders().length);
    setActiveRecords(await countActiveRecordCategories());
  }, []);

  useEffect(() => {
    reloadSummaries().catch(() => {});
  }, [reloadSummaries]);

  const summaryLine = useMemo(() => {
    if (profile.username) return profile.username;
    return t('profil.pseudoUnset');
  }, [profile.username, t]);

  const openUsername = () => {
    setDraftUsername(profile.username ?? '');
    setEditor('username');
  };

  const saveUsername = async () => {
    await updateProfile({ username: draftUsername });
    setEditor(null);
  };

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

  const resetRecords = () => {
    Alert.alert(t('profil.resetRecordsTitle'), t('profil.resetRecordsBody'), [
      { text: t('profil.cancel'), style: 'cancel' },
      {
        text: t('profil.erase'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await resetAllCatalogRecords();
            await reloadSummaries();
          })();
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
      testID="profil-screen"
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.foreground }]}>{t('profil.title')}</Text>

      <View
        style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID="profil-summary"
      >
        <Text style={[styles.summaryName, { color: colors.foreground }]}>{summaryLine}</Text>
        <Text style={[styles.summaryHint, { color: colors.mutedForeground }]}>
          {t('profil.localData')}
        </Text>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t('profil.sectionProfile')}
      </Text>
      <View style={styles.section}>
        <ProfilNavRow
          label={t('profil.username')}
          value={profile.username ?? '—'}
          onPress={openUsername}
          testID="profil-row-username"
        />
        <ProfilNavRow
          label={t('profil.rapid')}
          value={getPlayerEloRange(profile.rapidRangeId).label}
          onPress={() => setEditor('rapid')}
          testID="profil-row-rapid"
        />
        <ProfilNavRow
          label={t('profil.blitz')}
          value={getPlayerEloRange(profile.blitzRangeId).label}
          onPress={() => setEditor('blitz')}
          testID="profil-row-blitz"
        />
        <ProfilNavRow
          label={t('profil.bullet')}
          value={getPlayerEloRange(profile.bulletRangeId).label}
          onPress={() => setEditor('bullet')}
          testID="profil-row-bullet"
        />
        <ProfilNavRow
          label={t('profil.years')}
          value={profile.chessYears == null ? '—' : String(profile.chessYears)}
          onPress={() => setEditor('years')}
          testID="profil-row-years"
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t('profil.sectionMyData')}
      </Text>
      <View style={styles.section}>
        <ProfilNavRow
          label={t('profil.repertoires')}
          value={
            repertoireCount === 0
              ? t('profil.repertoiresNone')
              : `${repertoireCount} ${language === 'en' ? (repertoireCount > 1 ? 'repertoires' : 'repertoire') : `répertoire${repertoireCount > 1 ? 's' : ''}`}`
          }
          onPress={() => router.push('/openings')}
          testID="profil-row-repertoires"
        />
        <ProfilNavRow
          label={t('profil.records')}
          value={
            activeRecords === 0
              ? t('profil.recordsSee')
              : `${activeRecords} / ${RECORDS_CATEGORIES.length}`
          }
          onPress={() => router.push('/records')}
          testID="profil-row-records"
        />
      </View>

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
        <ProfilNavRow
          label={t('profil.voiceSpeed')}
          value={String(voiceSpeed)}
          onPress={() => setEditor('voiceSpeed')}
          testID="profil-row-voice-speed"
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t('profil.sectionSave')}
      </Text>
      <View
        style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID="profil-save-status"
      >
        <Text style={[styles.infoTitle, { color: colors.foreground }]}>
          {t('profil.saveTitle')}
        </Text>
        <Text style={[styles.infoBody, { color: colors.mutedForeground }]}>
          {t('profil.saveBody')}
        </Text>
        <Text style={[styles.infoSoon, { color: colors.mutedForeground }]}>
          {t('profil.saveSoon')}
        </Text>
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
        <Pressable
          onPress={resetRecords}
          testID="profil-reset-records"
          style={({ pressed }) => [
            styles.dangerBtn,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={{ color: colors.destructive, fontFamily: DesignTokens.typography.weightSemiBold }}>
            {t('profil.resetRecords')}
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={editor === 'username'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('profil.username')}
            </Text>
            <TextInput
              value={draftUsername}
              onChangeText={setDraftUsername}
              placeholder={t('profil.usernamePlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              maxLength={40}
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.input,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              testID="profil-username-input"
              onSubmitEditing={() => {
                void saveUsername();
              }}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditor(null)} style={styles.modalBtn}>
                <Text style={{ color: colors.foreground }}>{t('profil.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void saveUsername();
                }}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                testID="profil-username-save"
              >
                <Text style={{ color: colors.primaryForeground, fontFamily: DesignTokens.typography.weightSemiBold }}>
                  {t('profil.save')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
        visible={editor === 'rapid' || editor === 'blitz' || editor === 'bullet'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editor === 'rapid'
                ? t('profil.rapid')
                : editor === 'blitz'
                  ? t('profil.blitz')
                  : t('profil.bullet')}
            </Text>
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={styles.chipWrap}>
              {PLAYER_ELO_RANGES.map((range) => {
                const selectedId =
                  editor === 'rapid'
                    ? profile.rapidRangeId
                    : editor === 'blitz'
                      ? profile.blitzRangeId
                      : profile.bulletRangeId;
                const active = (selectedId ?? 'unrated') === range.id;
                return (
                  <OptionChip
                    key={range.id}
                    label={range.label}
                    active={active}
                    onPress={() => {
                      const patch =
                        editor === 'rapid'
                          ? { rapidRangeId: range.id }
                          : editor === 'blitz'
                            ? { blitzRangeId: range.id }
                            : { bulletRangeId: range.id };
                      void updateProfile(patch).then(() => setEditor(null));
                    }}
                  />
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setEditor(null)} style={styles.modalBtn}>
              <Text style={{ color: colors.mutedForeground }}>{t('profil.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editor === 'years'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('profil.years')}
            </Text>
            <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={styles.chipWrap}>
              {YEAR_OPTIONS.map((y) => (
                <OptionChip
                  key={y}
                  label={String(y)}
                  active={profile.chessYears === y}
                  onPress={() => {
                    void updateProfile({ chessYears: y }).then(() => setEditor(null));
                  }}
                />
              ))}
              <OptionChip
                label="20+"
                active={(profile.chessYears ?? 0) > 20}
                onPress={() => {
                  void updateProfile({ chessYears: 25 }).then(() => setEditor(null));
                }}
              />
            </ScrollView>
            <Pressable onPress={() => setEditor(null)} style={styles.modalBtn}>
              <Text style={{ color: colors.mutedForeground }}>{t('profil.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editor === 'voiceSpeed'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <DiscreteSlider
              label={t('profil.voiceSpeed')}
              valueLabel={String(voiceSpeed)}
              minimumValue={VOICE_SPEED_MIN}
              maximumValue={VOICE_SPEED_MAX}
              step={1}
              value={voiceSpeed}
              onValueChange={(v) => {
                void setDefaultSpeed(v);
              }}
              leftHint={language === 'en' ? 'Slow' : 'Lent'}
              rightHint={language === 'en' ? 'Fast' : 'Rapide'}
              testID="profil-voice-speed-slider"
            />
            <Pressable
              onPress={() => setEditor(null)}
              style={[styles.modalBtn, { backgroundColor: colors.primary, alignSelf: 'stretch' }]}
              testID="profil-voice-speed-done"
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
  title: {
    fontSize: DesignTokens.typography.title,
    fontFamily: DesignTokens.typography.weightBold,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.spacing.lg,
    gap: 4,
  },
  summaryName: {
    fontSize: 18,
    fontFamily: DesignTokens.typography.weightBold,
  },
  summaryHint: {
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightRegular,
  },
  sectionLabel: {
    marginTop: DesignTokens.spacing.sm,
    fontSize: 11,
    letterSpacing: 0.6,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  section: { gap: 8 },
  infoCard: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: DesignTokens.spacing.lg,
    gap: 6,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  infoBody: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: DesignTokens.typography.weightRegular,
  },
  infoSoon: {
    marginTop: 4,
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: DesignTokens.typography.weightRegular,
  },
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
  modalInput: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
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
