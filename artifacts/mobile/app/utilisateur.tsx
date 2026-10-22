import { consumeAccountFocus, subscribeAccountFocus } from '@/lib/cloud/accountFocus';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GeneralMenu } from '@/components/navigation/GeneralMenu';
/**
 * Utilisateur — profile identity + local data links (no preferences).
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { navigateMainTab } from '@/lib/navigation/routes';
import { usePathname, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useCloudAccount } from '@/hooks/useCloudAccount';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { confirmAction } from '@/lib/openings/confirmAction';
import { CloudAccountSection } from '@/components/cloud/CloudAccountSection';
import { AvatarField } from '@/components/profile/AvatarField';
import { ProfilNavRow } from '@/components/profil/ProfilNavRow';
import { OptionChip } from '@/components/ui/OptionChip';
import {
  PLAYER_ELO_RANGES,
  getPlayerEloRange,
  CHESS_YEARS_MAX,
  CHESS_YEARS_MIN,
} from '@/lib/profile';
import { cloudSyncEngine } from '@/lib/cloud';
import {
  cacheRemoteAvatar,
  commitAvatarChange,
} from '@/lib/profile/avatarRemote';
import { isMascotId } from '@/lib/profile/mascotCatalog';
import {
  normalizeAvatarEmail,
  readAvatarCache,
  readPendingAvatar,
} from '@/lib/profile/avatarLocal';
import { defaultKeyValueStorage } from '@/lib/storage';
import { repertoireService } from '@/lib/repertoire';
import {
  RECORDS_CATEGORIES,
  countActiveRecordCategories,
  resetAllCatalogRecords,
} from '@/lib/records/AnyChessRecords';

type EditorKind = null | 'username' | 'rapid' | 'blitz' | 'bullet' | 'years';

const YEAR_OPTIONS = Array.from(
  { length: Math.min(21, CHESS_YEARS_MAX - CHESS_YEARS_MIN + 1) },
  (_, i) => CHESS_YEARS_MIN + i,
);

export default function UtilisateurScreen() {
  const colors = useColors();
  const router = useRouter();
  const pathname = usePathname();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const { profile, updateProfile } = useUserProfile();
  const cloud = useCloudAccount();
  const { t } = useTranslation();

  const [editor, setEditor] = useState<EditorKind>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [mascotSourceId, setMascotSourceId] = useState<string | null>(null);
  const [mascotSource, setMascotSource] = useState<ImageSourcePropType | null>(
    null,
  );
  const avatarAccountRef = useRef<string | null>(null);
  const [avatarOwner, setAvatarOwner] = useState<string | null>(null);
  const ownerRef = useRef(cloud.user?.id);
  ownerRef.current = cloud.user?.id;
  const scrollRef = useRef<ScrollView>(null);
  const accountOffset = useRef(0);
  const accountLaidOut = useRef(false);
  const focusAccount = useCallback(() => {
    if (accountLaidOut.current && consumeAccountFocus()) scrollRef.current?.scrollTo({ y: accountOffset.current, animated: true });
  }, []);
  useEffect(() => { focusAccount(); return subscribeAccountFocus(focusAccount); }, [focusAccount]);
  useEffect(() => { if (cloud.sessionReady && !cloud.user) consumeAccountFocus(); }, [cloud.sessionReady, cloud.user]);
  const [editError, setEditError] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const editBusyRef = useRef(false);
  const [draftUsername, setDraftUsername] = useState('');
  const [repertoireCount, setRepertoireCount] = useState(0);
  const [activeRecords, setActiveRecords] = useState(0);

  const reloadSummaries = useCallback(async () => {
    await repertoireService.ensureLoaded();
    setRepertoireCount(repertoireService.getFolders().length);
    setActiveRecords(await countActiveRecordCategories());
  }, []);

  useEffect(() => {
    if (!cloud.user) return;
    reloadSummaries().catch(() => {});
  }, [reloadSummaries, cloud.user]);

  useEffect(() => {
    const user = cloud.user;
    if (!user) {
      setAvatarUri(null);
      avatarAccountRef.current = null;
      return;
    }
    let cancelled = false;
    if (avatarAccountRef.current !== user.id) {
      setAvatarUri(null);
      setAvatarOwner(user.id);
      avatarAccountRef.current = user.id;
    }
    void (async () => {
      const pending = await readPendingAvatar(defaultKeyValueStorage, cloud.user?.email);
      if (cancelled) return;
      if (
        pending?.intent === 'remove' &&
        pending.email === normalizeAvatarEmail(user.email)
      ) {
        setAvatarUri(null);
        return;
      }
      const cached = await readAvatarCache(defaultKeyValueStorage, user.id);
      if (cancelled) return;
      if (cached) {
        setAvatarUri(cached);
        return;
      }
      if (!profile.hasAvatar) {
        setAvatarUri(null);
        return;
      }
      const downloaded = await cacheRemoteAvatar({
        storage: defaultKeyValueStorage,
        userId: user.id,
        accessToken: cloudSyncEngine.getAccessToken(),
      });
      if (!cancelled) setAvatarUri(downloaded);
    })().catch(() => {
      /* Keep the existing avatar; the next visit can retry reading it. */
    });
    return () => {
      cancelled = true;
    };
  }, [cloud.user, profile.hasAvatar]);

  useEffect(() => {
    if (!isMascotId(profile.mascotId)) {
      setMascotSource(null);
      return;
    }
    const id = profile.mascotId;
    setMascotSourceId(null);
    let cancelled = false;
    void import('@/components/profile/mascotImages').then((mod) => {
      if (!cancelled) {
        setMascotSource(mod.mascotImage(id));
        setMascotSourceId(id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profile.mascotId]);

  const onAvatarChange = async (
    dataUrl: string | null,
    context?: { cancelled: () => boolean; mascotId?: string },
  ) => {
    const user = cloud.user;
    if (!user) return 'failed' as const;
    const cancelled = () =>
      context?.cancelled() === true || ownerRef.current !== user.id;
    if (cancelled()) return 'cancelled' as const;
    const result = await commitAvatarChange({
      storage: defaultKeyValueStorage,
      userId: user.id,
      email: user.email,
      accessToken: cloudSyncEngine.getAccessToken(),
      dataUrl,
      mascotId: context?.mascotId,
      cancelled,
    });
    if (cancelled() || result === 'cancelled') return 'cancelled' as const;
    if (result === 'failed') return 'failed' as const;
    setAvatarOwner(user.id);
    setAvatarUri(context?.mascotId ? null : dataUrl);
    if (result === 'offline') cloudSyncEngine.markOffline();
    if (result === 'sync_failed') return 'sync_failed' as const;
  };

  const summaryLine = useMemo(() => {
    if (profile.username) return profile.username;
    return t('profil.pseudoUnset');
  }, [profile.username, t]);

  const openUsername = () => {
    setDraftUsername(profile.username ?? '');
    setEditError(false);
    setEditor('username');
  };

  const saveEdit = async (patch: Parameters<typeof updateProfile>[0]) => {
    if (editBusyRef.current) return;
    editBusyRef.current = true;
    setEditBusy(true);
    setEditError(false);
    try {
      await updateProfile(patch);
      setEditor(null);
    } catch {
      setEditError(true);
    } finally {
      editBusyRef.current = false;
      setEditBusy(false);
    }
  };
  const saveUsername = () => saveEdit({ username: draftUsername });

  const resetRecords = () => {
    confirmAction(
      t('profil.resetRecordsTitle'),
      t('profil.resetRecordsBody'),
      () => {
        void (async () => {
          await resetAllCatalogRecords();
          await reloadSummaries();
        })();
      },
      { destructive: true, confirmLabel: t('profil.erase') },
    );
  };

  if (!cloud.sessionReady) {
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
        testID="utilisateur-session-loading"
        accessibilityLabel={t('guest.restoring')}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!cloud.user) {
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
        testID="utilisateur-screen"
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title={t('utilisateur.title')}
          trailing={<GeneralMenu />}
        />
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.primary },
          ]}
          testID="utilisateur-guest-card"
        >
          <Text style={[styles.guestText, { color: colors.foreground }]}>
            {t('guest.userPrompt')}
          </Text>
        </View>
        <CloudAccountSection />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.page,
        {
          paddingTop: topPad + DesignTokens.spacing.xl,
          paddingBottom: bottomPad + DesignTokens.spacing.xl,
        },
      ]}
      testID="utilisateur-screen"
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader title={t('utilisateur.title')} trailing={<GeneralMenu />} />

      <View
        style={[
          styles.summaryCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        testID="profil-summary"
      >
        <AvatarField
          key={cloud.user.id}
          username={profile.username}
          imageUri={
            profile.mascotId || avatarOwner !== cloud.user.id ? null : avatarUri
          }
          imageSource={
            profile.mascotId === mascotSourceId ? mascotSource : null
          }
          onChange={(next, context) => onAvatarChange(next, context)}
          testID="profil-avatar"
        >
          <Pressable
            onPress={openUsername}
            testID="profil-row-username"
            accessibilityRole="button"
            accessibilityLabel={t('profil.editIdentity')}
            style={styles.identityEdit}
          >
            <Text style={[styles.summaryName, { color: colors.foreground }]}>
              {summaryLine}
            </Text>
            <Text style={{ color: colors.primary }}>
              {t('profil.editIdentity')}
            </Text>
          </Pressable>
        </AvatarField>
        <Pressable
          testID="profil-account-shortcut"
          accessibilityRole="button"
          onPress={() =>
            scrollRef.current?.scrollTo({
              y: accountOffset.current,
              animated: true,
            })
          }
          style={styles.accountShortcut}
        >
          <Text
            style={{
              color: colors.primary,
              fontFamily: DesignTokens.typography.weightSemiBold,
            }}
          >
            {t('profil.accountShortcut')}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t('profil.chessInformation')}
      </Text>
      <View style={styles.section}>
        <ProfilNavRow
          label={t('profil.rapid')}
          value={
            profile.rapidRangeId && profile.rapidRangeId !== 'unrated'
              ? getPlayerEloRange(profile.rapidRangeId).label
              : t('profil.eloUnrated')
          }
          onPress={() => {
            setEditError(false);
            setEditor('rapid');
          }}
          testID="profil-row-rapid"
        />
        <ProfilNavRow
          label={t('profil.blitz')}
          value={
            profile.blitzRangeId && profile.blitzRangeId !== 'unrated'
              ? getPlayerEloRange(profile.blitzRangeId).label
              : t('profil.eloUnrated')
          }
          onPress={() => {
            setEditError(false);
            setEditor('blitz');
          }}
          testID="profil-row-blitz"
        />
        <ProfilNavRow
          label={t('profil.bullet')}
          value={
            profile.bulletRangeId && profile.bulletRangeId !== 'unrated'
              ? getPlayerEloRange(profile.bulletRangeId).label
              : t('profil.eloUnrated')
          }
          onPress={() => {
            setEditError(false);
            setEditor('bullet');
          }}
          testID="profil-row-bullet"
        />
        <ProfilNavRow
          label={t('profil.years')}
          value={
            profile.chessYears == null
              ? t('profil.notProvided')
              : String(profile.chessYears)
          }
          onPress={() => {
            setEditError(false);
            setEditor('years');
          }}
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
              : t('profil.repertoiresCount', { count: repertoireCount })
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
          onPress={() => navigateMainTab(router, pathname, '/records')}
          testID="profil-row-records"
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t('profil.sectionSave')}
      </Text>
      <View
        style={[
          styles.infoCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        testID="profil-save-status"
      >
        <Text style={[styles.infoTitle, { color: colors.foreground }]}>
          {t('profil.saveTitle')}
        </Text>
        <Text style={[styles.infoBody, { color: colors.mutedForeground }]}>
          {t('profil.saveBody')}
        </Text>
      </View>

      <View style={styles.dangerZone}>
        <Pressable
          onPress={resetRecords}
          testID="profil-reset-records"
          style={({ pressed }) => [
            styles.dangerBtn,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text
            style={{
              color: colors.destructive,
              fontFamily: DesignTokens.typography.weightSemiBold,
            }}
          >
            {t('profil.resetRecords')}
          </Text>
        </Pressable>
      </View>

      <View
        testID="profil-account-section"
        onLayout={(event) => {
          accountOffset.current = event.nativeEvent.layout.y;
          accountLaidOut.current = true;
          focusAccount();
        }}
      >
        <Text style={[styles.accountHint, { color: colors.mutedForeground }]}>
          {t('profil.accountHint')}
        </Text>
        <CloudAccountSection />
      </View>
      {editError ? (
        <Text
          testID="profil-edit-error"
          accessibilityRole="alert"
          style={{ color: colors.destructive }}
        >
          {t('profil.saveFailed')}
        </Text>
      ) : null}

      <Modal
        visible={editor === 'username'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
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
            {editError ? (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.destructive }}
              >
                {t('profil.saveFailed')}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setEditor(null)}
                style={styles.modalBtn}
              >
                <Text style={{ color: colors.foreground }}>
                  {t('profil.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void saveUsername();
                }}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                disabled={editBusy}
                testID="profil-username-save"
              >
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontFamily: DesignTokens.typography.weightSemiBold,
                  }}
                >
                  {t('profil.save')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={
          editor === 'rapid' || editor === 'blitz' || editor === 'bullet'
        }
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editor === 'rapid'
                ? t('profil.rapid')
                : editor === 'blitz'
                  ? t('profil.blitz')
                  : t('profil.bullet')}
            </Text>
            {editError ? (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.destructive }}
              >
                {t('profil.saveFailed')}
              </Text>
            ) : null}
            <ScrollView
              style={{ maxHeight: 320 }}
              contentContainerStyle={styles.chipWrap}
            >
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
                    label={
                      range.id === 'unrated'
                        ? t('profil.eloUnrated')
                        : range.label
                    }
                    active={active}
                    disabled={editBusy}
                    testID={`profil-level-${range.id}`}
                    onPress={() => {
                      const patch =
                        editor === 'rapid'
                          ? { rapidRangeId: range.id }
                          : editor === 'blitz'
                            ? { blitzRangeId: range.id }
                            : { bulletRangeId: range.id };
                      void saveEdit(patch);
                    }}
                  />
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setEditor(null)} style={styles.modalBtn}>
              <Text style={{ color: colors.mutedForeground }}>
                {t('profil.close')}
              </Text>
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
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('profil.years')}
            </Text>
            {editError ? (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.destructive }}
              >
                {t('profil.saveFailed')}
              </Text>
            ) : null}
            <ScrollView
              style={{ maxHeight: 280 }}
              contentContainerStyle={styles.chipWrap}
            >
              {YEAR_OPTIONS.map((y) => (
                <OptionChip
                  key={y}
                  label={String(y)}
                  active={profile.chessYears === y}
                  disabled={editBusy}
                  testID={`profil-years-${y}`}
                  onPress={() => {
                    void saveEdit({ chessYears: y });
                  }}
                />
              ))}
              <OptionChip
                label={t('profil.yearsTwentyPlus')}
                active={(profile.chessYears ?? 0) > 20}
                onPress={() => {
                  void saveEdit({ chessYears: 25 });
                }}
              />
            </ScrollView>
            <Pressable onPress={() => setEditor(null)} style={styles.modalBtn}>
              <Text style={{ color: colors.mutedForeground }}>
                {t('profil.close')}
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: DesignTokens.typography.weightRegular,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.spacing.lg,
    gap: DesignTokens.spacing.md,
  },
  identityEdit: {
    minHeight: DesignTokens.minTouchTarget,
    justifyContent: 'center',
    gap: 4,
  },
  accountShortcut: {
    minHeight: DesignTokens.minTouchTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  accountHint: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: DesignTokens.spacing.sm,
  },
  summaryName: {
    fontSize: 18,
    fontFamily: DesignTokens.typography.weightBold,
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
