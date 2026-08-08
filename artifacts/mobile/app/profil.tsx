/**
 * Profil / Mes données — local-only control center.
 * No account, no cloud. Reuses existing preference + repertoire + records stores.
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
import { audioSettings } from '@/services/AudioSettings';
import { boardCoordinatesSettings } from '@/services/BoardCoordinatesSettings';
import { voiceSpeedSettings } from '@/lib/preferences/VoiceSpeedSettings';

type EditorKind =
  | null
  | 'username'
  | 'rapid'
  | 'blitz'
  | 'bullet'
  | 'years'
  | 'voiceSpeed';

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
    return 'Pseudo non renseigné';
  }, [profile.username]);

  const openUsername = () => {
    setDraftUsername(profile.username ?? '');
    setEditor('username');
  };

  const saveUsername = async () => {
    await updateProfile({ username: draftUsername });
    setEditor(null);
  };

  const resetPreferences = () => {
    Alert.alert(
      'Réinitialiser les préférences ?',
      'Voix, coordonnées et vitesse de la voix reviendront aux valeurs par défaut.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await audioSettings.setVoiceEnabled(true);
              await boardCoordinatesSettings.setCoordinatesVisible(true);
              await voiceSpeedSettings.resetToDefault();
            })();
          },
        },
      ],
    );
  };

  const resetRecords = () => {
    Alert.alert(
      'Réinitialiser les records ?',
      'Tous les records (Tactiques, Nommer, Jouer, Mémorisation) seront effacés sur cet appareil.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await resetAllCatalogRecords();
              await reloadSummaries();
            })();
          },
        },
      ],
    );
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
      <Text style={[styles.title, { color: colors.foreground }]}>Profil</Text>

      <View
        style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID="profil-summary"
      >
        <Text style={[styles.summaryName, { color: colors.foreground }]}>{summaryLine}</Text>
        <Text style={[styles.summaryHint, { color: colors.mutedForeground }]}>
          Données locales — aucun compte requis
        </Text>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PROFIL</Text>
      <View style={styles.section}>
        <ProfilNavRow
          label="Pseudo"
          value={profile.username ?? '—'}
          onPress={openUsername}
          testID="profil-row-username"
        />
        <ProfilNavRow
          label="Niveau Rapide"
          value={getPlayerEloRange(profile.rapidRangeId).label}
          onPress={() => setEditor('rapid')}
          testID="profil-row-rapid"
        />
        <ProfilNavRow
          label="Niveau Blitz"
          value={getPlayerEloRange(profile.blitzRangeId).label}
          onPress={() => setEditor('blitz')}
          testID="profil-row-blitz"
        />
        <ProfilNavRow
          label="Niveau Bullet"
          value={getPlayerEloRange(profile.bulletRangeId).label}
          onPress={() => setEditor('bullet')}
          testID="profil-row-bullet"
        />
        <ProfilNavRow
          label="Années de pratique"
          value={profile.chessYears == null ? '—' : String(profile.chessYears)}
          onPress={() => setEditor('years')}
          testID="profil-row-years"
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MES DONNÉES</Text>
      <View style={styles.section}>
        <ProfilNavRow
          label="Répertoires PGN"
          value={
            repertoireCount === 0
              ? 'Aucun'
              : `${repertoireCount} répertoire${repertoireCount > 1 ? 's' : ''}`
          }
          onPress={() => router.push('/openings')}
          testID="profil-row-repertoires"
        />
        <ProfilNavRow
          label="Records"
          value={
            activeRecords === 0
              ? 'Voir mes records'
              : `${activeRecords} / ${RECORDS_CATEGORIES.length} exercices`
          }
          onPress={() => router.push('/records')}
          testID="profil-row-records"
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PRÉFÉRENCES</Text>
      <View style={styles.section}>
        <ProfilNavRow
          label="Langue"
          value="Français"
          interactive={false}
          testID="profil-row-language"
        />
        <BooleanSettingRow
          label="Voix / son"
          value={voiceEnabled}
          onToggle={() => {
            void toggleVoice();
          }}
          activeIcon="volume-high"
          inactiveIcon="volume-mute"
          testID="profil-pref-voice"
        />
        <BooleanSettingRow
          label="Coordonnées"
          value={showCoordinates}
          onToggle={() => {
            void toggleCoordinates();
          }}
          testID="profil-pref-coordinates"
        />
        <ProfilNavRow
          label="Vitesse de la voix"
          value={String(voiceSpeed)}
          onPress={() => setEditor('voiceSpeed')}
          testID="profil-row-voice-speed"
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SAUVEGARDE</Text>
      <View
        style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID="profil-save-status"
      >
        <Text style={[styles.infoTitle, { color: colors.foreground }]}>
          Données enregistrées sur cet appareil
        </Text>
        <Text style={[styles.infoBody, { color: colors.mutedForeground }]}>
          Profil, répertoires PGN, records et préférences restent locaux. Aucun
          compte ni cloud pour le moment.
        </Text>
        <Text style={[styles.infoSoon, { color: colors.mutedForeground }]}>
          Synchronisation multi-appareils — bientôt disponible
        </Text>
      </View>

      <View style={styles.dangerZone}>
        <Pressable
          onPress={resetPreferences}
          testID="profil-reset-prefs"
          style={({ pressed }) => [
            styles.dangerBtn,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={{ color: colors.mutedForeground, fontFamily: DesignTokens.typography.weightSemiBold }}>
            Réinitialiser les préférences
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
            Réinitialiser les records
          </Text>
        </Pressable>
      </View>

      {/* Username editor */}
      <Modal
        visible={editor === 'username'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Pseudo</Text>
            <TextInput
              value={draftUsername}
              onChangeText={setDraftUsername}
              placeholder="Ton pseudo"
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
                <Text style={{ color: colors.foreground }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void saveUsername();
                }}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                testID="profil-username-save"
              >
                <Text style={{ color: colors.primaryForeground, fontFamily: DesignTokens.typography.weightSemiBold }}>
                  Enregistrer
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Elo range pickers */}
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
                ? 'Niveau Rapide'
                : editor === 'blitz'
                  ? 'Niveau Blitz'
                  : 'Niveau Bullet'}
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
              <Text style={{ color: colors.mutedForeground }}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Years picker */}
      <Modal
        visible={editor === 'years'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Années de pratique
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
              <Text style={{ color: colors.mutedForeground }}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Voice speed */}
      <Modal
        visible={editor === 'voiceSpeed'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <DiscreteSlider
              label="Vitesse de la voix (défaut)"
              valueLabel={String(voiceSpeed)}
              minimumValue={VOICE_SPEED_MIN}
              maximumValue={VOICE_SPEED_MAX}
              step={1}
              value={voiceSpeed}
              onValueChange={(v) => {
                void setDefaultSpeed(v);
              }}
              leftHint="Lent"
              rightHint="Rapide"
              testID="profil-voice-speed-slider"
            />
            <Text style={[styles.infoBody, { color: colors.mutedForeground }]}>
              Les exercices peuvent ajuster la vitesse pour la session sans
              modifier ce défaut.
            </Text>
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
