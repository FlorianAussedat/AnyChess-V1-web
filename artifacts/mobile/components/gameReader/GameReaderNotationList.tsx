/**
 * Clickable move notation with variation branches for Lecteur / Analyseur.
 * Main line stays primary; side lines are indented and parenthesized.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';
import { DesignTokens } from '@/constants/designTokens';
import { formatSanForDisplay } from '@/lib/chess/notation';
import type { ReaderGame, ReaderNode } from '@/lib/gameReader';

export type NotationEntry = {
  key: string;
  nodeId: string;
  san: string;
  displaySan: string;
  depth: number;
  /** Prefix like "2..." when starting a black variation. */
  prefix?: string;
  isVariationStart?: boolean;
  isVariationEnd?: boolean;
};

type Props = {
  game: ReaderGame;
  currentNodeId: string | null;
  activeLineNodeIds: string[];
  onSelectNode: (nodeId: string) => void;
  maxHeight?: number;
  testID?: string;
};

const ROW_H = 28;

function movePrefix(node: ReaderNode): string {
  if (node.color === 'white') return `${node.moveNumber}.`;
  return `${node.moveNumber}...`;
}

/**
 * Flatten the tree for display: main child first, then each side variation
 * as an indented parenthetical line.
 */
export function flattenNotationTree(game: ReaderGame): NotationEntry[] {
  const out: NotationEntry[] = [];

  function walk(nodeId: string, depth: number) {
    const node: ReaderNode | undefined = game.nodesById[nodeId];
    if (!node) return;
    const isVar = depth > 0;
    out.push({
      key: nodeId,
      nodeId,
      san: node.san,
      displaySan: node.san,
      depth,
      prefix: node.color === 'white' || isVar ? movePrefix(node) : undefined,
      isVariationStart: isVar && node.variationIndex > 0,
    });

    const childIds = node.childIds;
    if (childIds.length === 0) return;

    // Main continuation
    walk(childIds[0]!, depth);

    // Side variations after this move's main child fork: rendered as siblings
    // of the main child (alternatives at the same parent).
    for (let i = 1; i < childIds.length; i += 1) {
      const varId = childIds[i]!;
      // Emit a parenthetical block for this whole side line.
      const startIndex = out.length;
      walkVariationLine(varId, depth + 1);
      if (out.length > startIndex) {
        out[startIndex] = {
          ...out[startIndex]!,
          isVariationStart: true,
        };
        out[out.length - 1] = {
          ...out[out.length - 1]!,
          isVariationEnd: true,
        };
      }
    }
  }

  function walkVariationLine(nodeId: string, depth: number) {
    let id: string | null = nodeId;
    while (id) {
      const node: ReaderNode | undefined = game.nodesById[id];
      if (!node) break;
      out.push({
        key: `${id}-v`,
        nodeId: id,
        san: node.san,
        displaySan: node.san,
        depth,
        prefix: movePrefix(node),
        isVariationStart: false,
      });
      // Inside a variation, still show nested side lines.
      const children: string[] = node.childIds;
      if (children.length === 0) break;
      // Nested variations of the next move
      const main: string = children[0]!;
      for (let i = 1; i < children.length; i += 1) {
        const nestedStart = out.length;
        walkVariationLine(children[i]!, depth + 1);
        if (out.length > nestedStart) {
          out[nestedStart] = { ...out[nestedStart]!, isVariationStart: true };
          out[out.length - 1] = { ...out[out.length - 1]!, isVariationEnd: true };
        }
      }
      id = main;
    }
  }

  for (let i = 0; i < game.rootIds.length; i += 1) {
    const rootId = game.rootIds[i]!;
    if (i === 0) {
      walk(rootId, 0);
    } else {
      const start = out.length;
      walkVariationLine(rootId, 1);
      if (out.length > start) {
        out[start] = { ...out[start]!, isVariationStart: true };
        out[out.length - 1] = { ...out[out.length - 1]!, isVariationEnd: true };
      }
    }
  }

  return out;
}

export function GameReaderNotationList({
  game,
  currentNodeId,
  activeLineNodeIds,
  onSelectNode,
  maxHeight = 220,
  testID = 'game-reader-notation',
}: Props) {
  const colors = useColors();
  const { chessNotation } = usePreferences();
  const scrollRef = useRef<ScrollView>(null);
  const lastAutoNode = useRef<string | null>(null);

  const entries = useMemo(() => {
    const flat = flattenNotationTree(game);
    return flat.map((e) => ({
      ...e,
      displaySan: formatSanForDisplay(e.san, chessNotation),
    }));
  }, [game, chessNotation]);

  const activeSet = useMemo(
    () => new Set(activeLineNodeIds),
    [activeLineNodeIds],
  );

  useEffect(() => {
    if (!currentNodeId || entries.length === 0) return;
    if (lastAutoNode.current === currentNodeId) return;
    lastAutoNode.current = currentNodeId;
    const index = entries.findIndex((e) => e.nodeId === currentNodeId);
    if (index < 0) return;
    const y = Math.max(0, index * ROW_H - Math.floor(maxHeight / 3));
    scrollRef.current?.scrollTo({ y, animated: true });
  }, [currentNodeId, entries, maxHeight]);

  if (entries.length === 0) return null;

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.scroll, { maxHeight }]}
      contentContainerStyle={styles.content}
      testID={testID}
      nestedScrollEnabled
    >
      {entries.map((entry) => {
        const active = currentNodeId === entry.nodeId;
        const onActiveLine = activeSet.has(entry.nodeId);
        const indent = entry.depth * 12;
        const open = entry.isVariationStart ? '(' : '';
        const close = entry.isVariationEnd ? ')' : '';
        return (
          <Pressable
            key={entry.key}
            testID={`game-reader-node-${entry.nodeId}`}
            accessibilityRole="button"
            onPress={() => onSelectNode(entry.nodeId)}
            style={[
              styles.row,
              {
                minHeight: ROW_H,
                paddingLeft: 4 + indent,
                backgroundColor: active
                  ? 'rgba(57, 138, 85, 0.28)'
                  : 'transparent',
              },
            ]}
          >
            {entry.prefix ? (
              <Text
                style={[
                  styles.prefix,
                  {
                    color: colors.mutedForeground,
                    fontStyle: entry.depth > 0 ? 'italic' : 'normal',
                  },
                ]}
              >
                {open}
                {entry.prefix}
              </Text>
            ) : open ? (
              <Text style={[styles.prefix, { color: colors.mutedForeground }]}>
                {open}
              </Text>
            ) : null}
            <Text
              style={[
                styles.san,
                {
                  color: active
                    ? colors.primary
                    : onActiveLine
                      ? colors.foreground
                      : colors.mutedForeground,
                  fontStyle: entry.depth > 0 ? 'italic' : 'normal',
                  fontFamily:
                    entry.depth > 0
                      ? DesignTokens.typography.weightRegular
                      : DesignTokens.typography.weightSemiBold,
                },
              ]}
            >
              {entry.displaySan}
              {close}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { width: '100%' },
  content: { gap: 1, paddingVertical: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: DesignTokens.radius.sm,
    paddingVertical: 3,
    paddingRight: 8,
  },
  prefix: {
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightSemiBold,
    minWidth: 28,
  },
  san: {
    fontSize: 15,
  },
});
