/**
 * Clickable move notation with variation branches for Lecteur / Analyseur.
 * Main line: columns (move# | white | black). Variations full-width underneath.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { formatSanForDisplay } from '@/lib/chess/notation';
import type { ReaderGame, ReaderNode } from '@/lib/gameReader';
import {
  buildNotationColumnRows,
  notationScrollIndexForNode,
  type NotationColumnRow,
  type NotationVariationBlock,
} from '@/lib/gameReader/notationColumns';

export type NotationEntry = {
  key: string;
  nodeId: string;
  san: string;
  displaySan: string;
  depth: number;
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

const ROW_H = 30;
const VAR_COLLAPSE_AT = 8;
const VAR_PREVIEW = 4;

function movePrefix(node: ReaderNode): string {
  if (node.color === 'white') return `${node.moveNumber}.`;
  return `${node.moveNumber}...`;
}

/**
 * Flatten the tree for display (legacy / tests). Prefer buildNotationColumnRows.
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

    walk(childIds[0]!, depth);

    for (let i = 1; i < childIds.length; i += 1) {
      const varId = childIds[i]!;
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
      const children: string[] = node.childIds;
      if (children.length === 0) break;
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

function MoveCell({
  nodeId,
  displaySan,
  selected,
  onActiveLine,
  onPress,
  testID,
}: {
  nodeId: string;
  displaySan: string;
  selected: boolean;
  onActiveLine: boolean;
  onPress: () => void;
  testID: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.cell,
        selected
          ? {
              backgroundColor: colors.primary,
            }
          : null,
      ]}
    >
      <Text
        style={[
          styles.san,
          {
            color: selected
              ? colors.primaryForeground
              : onActiveLine
                ? colors.foreground
                : colors.mutedForeground,
            fontFamily: selected
              ? DesignTokens.typography.weightBold
              : DesignTokens.typography.weightSemiBold,
          },
        ]}
        numberOfLines={1}
      >
        {displaySan}
      </Text>
    </Pressable>
  );
}

function VariationBlockView({
  block,
  currentNodeId,
  activeSet,
  formatSan,
  onSelectNode,
}: {
  block: NotationVariationBlock;
  currentNodeId: string | null;
  activeSet: Set<string>;
  formatSan: (san: string) => string;
  onSelectNode: (nodeId: string) => void;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  const long = block.moves.length > VAR_COLLAPSE_AT;
  const [expanded, setExpanded] = useState(false);
  const visible =
    long && !expanded ? block.moves.slice(0, VAR_PREVIEW) : block.moves;
  const activeInVar =
    currentNodeId != null &&
    (block.moves.some((m) => m.nodeId === currentNodeId) ||
      block.nested.some((n) =>
        n.moves.some((m) => activeSet.has(m.nodeId) || m.nodeId === currentNodeId),
      ) ||
      activeSet.has(block.moves[0]?.nodeId ?? ''));

  return (
    <View
      style={[
        styles.varOuter,
        {
          marginLeft: Math.min(4 + block.depth * 6, 28),
          borderLeftColor: activeInVar ? colors.primary : colors.border,
        },
      ]}
      testID={`game-reader-var-${block.key}`}
    >
      <View style={styles.varBlock}>
        <View style={styles.varMoves}>
          <Text
            style={[
              styles.varParen,
              { color: activeInVar ? colors.primary : colors.mutedForeground },
            ]}
          >
            (
          </Text>
          {visible.map((m, i) => {
            const selected = currentNodeId === m.nodeId;
            const onLine = activeSet.has(m.nodeId);
            return (
              <Pressable
                key={m.nodeId}
                testID={`game-reader-node-${m.nodeId}`}
                accessibilityRole="button"
                onPress={() => onSelectNode(m.nodeId)}
                style={[
                  styles.varMove,
                  selected ? { backgroundColor: colors.primary } : null,
                ]}
              >
                <Text
                  style={{
                    color: selected
                      ? colors.primaryForeground
                      : activeInVar || onLine
                        ? colors.primary
                        : colors.mutedForeground,
                    fontFamily: DesignTokens.typography.weightRegular,
                    fontStyle: 'italic',
                    fontSize: 13,
                  }}
                >
                  {i > 0 ? ' ' : ''}
                  {m.prefix}
                  {formatSan(m.san)}
                </Text>
              </Pressable>
            );
          })}
          {long && !expanded ? (
            <Text
              style={{
                color: activeInVar ? colors.primary : colors.mutedForeground,
                fontSize: 13,
              }}
            >
              {' '}
              …
            </Text>
          ) : null}
          <Text
            style={[
              styles.varParen,
              { color: activeInVar ? colors.primary : colors.mutedForeground },
            ]}
          >
            )
          </Text>
        </View>
        {long ? (
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={
              expanded
                ? t('parties.anyliseurLess')
                : t('parties.anyliseurMore')
            }
            hitSlop={6}
            style={styles.varToggle}
          >
            <Text style={{ color: colors.primary, fontSize: 11 }}>
              {expanded ? '−' : '+'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {/* Nested sub-variations — recursive, unbounded depth */}
      {block.nested.map((child) => (
        <VariationBlockView
          key={child.key}
          block={child}
          currentNodeId={currentNodeId}
          activeSet={activeSet}
          formatSan={formatSan}
          onSelectNode={onSelectNode}
        />
      ))}
    </View>
  );
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

  const rows = useMemo(() => buildNotationColumnRows(game), [game]);

  const formatSan = (san: string) => formatSanForDisplay(san, chessNotation);

  const activeSet = useMemo(
    () => new Set(activeLineNodeIds),
    [activeLineNodeIds],
  );

  useEffect(() => {
    if (!currentNodeId || rows.length === 0) return;
    // Only scroll when the cursor node changes — not on analysis / FEN ticks.
    if (lastAutoNode.current === currentNodeId) return;
    lastAutoNode.current = currentNodeId;
    const index = notationScrollIndexForNode(rows, currentNodeId);
    if (index < 0) return;
    const y = Math.max(0, index * ROW_H - Math.floor(maxHeight / 3));
    scrollRef.current?.scrollTo({ y, animated: true });
  }, [currentNodeId, rows, maxHeight]);

  if (rows.length === 0) return null;

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.scroll, { maxHeight }]}
      contentContainerStyle={styles.content}
      testID={testID}
      nestedScrollEnabled
    >
      {rows.map((row) => (
        <NotationRow
          key={row.key}
          row={row}
          currentNodeId={currentNodeId}
          activeSet={activeSet}
          formatSan={formatSan}
          onSelectNode={onSelectNode}
          numberColor={colors.mutedForeground}
        />
      ))}
    </ScrollView>
  );
}

function NotationRow({
  row,
  currentNodeId,
  activeSet,
  formatSan,
  onSelectNode,
  numberColor,
}: {
  row: NotationColumnRow;
  currentNodeId: string | null;
  activeSet: Set<string>;
  formatSan: (san: string) => string;
  onSelectNode: (nodeId: string) => void;
  numberColor: string;
}) {
  return (
    <View style={styles.plyBlock}>
      {(row.white || row.black) && (
        <View style={[styles.mainRow, { minHeight: ROW_H }]}>
          <Text style={[styles.moveNum, { color: numberColor }]}>
            {row.moveNumber}.
          </Text>
          <View style={styles.cellSlot}>
            {row.white ? (
              <MoveCell
                nodeId={row.white.nodeId}
                displaySan={formatSan(row.white.san)}
                selected={currentNodeId === row.white.nodeId}
                onActiveLine={activeSet.has(row.white.nodeId)}
                onPress={() => onSelectNode(row.white!.nodeId)}
                testID={`game-reader-node-${row.white.nodeId}`}
              />
            ) : (
              <Text style={[styles.san, { color: numberColor }]}>—</Text>
            )}
          </View>
          <View style={styles.cellSlot}>
            {row.black ? (
              <MoveCell
                nodeId={row.black.nodeId}
                displaySan={formatSan(row.black.san)}
                selected={currentNodeId === row.black.nodeId}
                onActiveLine={activeSet.has(row.black.nodeId)}
                onPress={() => onSelectNode(row.black!.nodeId)}
                testID={`game-reader-node-${row.black.nodeId}`}
              />
            ) : null}
          </View>
        </View>
      )}
      {row.variations.map((block) => (
        <VariationBlockView
          key={block.key}
          block={block}
          currentNodeId={currentNodeId}
          activeSet={activeSet}
          formatSan={formatSan}
          onSelectNode={onSelectNode}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { width: '100%' },
  content: { gap: 2, paddingVertical: 2 },
  plyBlock: { width: '100%', gap: 2 },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  moveNum: {
    width: 28,
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'right',
  },
  cellSlot: {
    flex: 1,
    minWidth: 0,
  },
  cell: {
    borderRadius: DesignTokens.radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  san: {
    fontSize: 14,
  },
  varOuter: {
    borderLeftWidth: 2,
    paddingLeft: 6,
    paddingVertical: 2,
    gap: 2,
    width: '100%',
  },
  varBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  varMoves: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  varParen: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  varMove: {
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  varToggle: {
    minWidth: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
