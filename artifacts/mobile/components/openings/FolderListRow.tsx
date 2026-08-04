import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { RepertoireFolder } from '@/lib/repertoire';
import { sideLabel } from '@/components/RepertoireSidePicker';

type Props = {
  folder: RepertoireFolder;
  fileCount: number;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
};

export function FolderListRow({ folder, fileCount, onOpen, onRename, onDelete }: Props) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
      testID={`folder-${folder.id}`}
    >
      <View style={[styles.folderIcon, { backgroundColor: colors.primary }]}>
        <Ionicons name="folder" size={22} color={colors.primaryForeground} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{folder.name}</Text>
        <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
          {fileCount === 0
            ? 'Aucun fichier PGN'
            : `${fileCount} fichier${fileCount > 1 ? 's' : ''} PGN`}
          {folder.side ? ` · ${sideLabel(folder.side)}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={onRename}
        hitSlop={8}
        style={styles.iconOnly}
        testID={`rename-folder-${folder.id}`}
      >
        <Ionicons name="pencil-outline" size={18} color={colors.mutedForeground} />
      </Pressable>
      <Pressable
        onPress={onDelete}
        hitSlop={8}
        style={styles.iconOnly}
        testID={`delete-folder-${folder.id}`}
      >
        <Ionicons name="trash-outline" size={18} color={colors.destructive} />
      </Pressable>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  folderIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  iconOnly: { padding: 4 },
});
