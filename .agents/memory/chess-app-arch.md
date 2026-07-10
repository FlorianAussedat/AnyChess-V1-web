---
name: Chess app architecture
description: Key decisions and gotchas for the Échecs à l'oral Expo mobile app
---

## Core packages
- `chess.js` v1.4.0 — v1.x API: `isGameOver()`, `isCheck()`, etc. `game.move()` throws on illegal moves (wrap in try/catch). `game.moves({ verbose: true })` returns `Move[]`.
- `expo-speech` — must be installed via `npx expo install` to get correct SDK-matched version (v14.x for SDK 54, not v57).
- `expo-speech-recognition` — `useSpeechRecognitionEvent` hooks must be called unconditionally. Event `result` has `{ isFinal, results: [{ transcript }] }`.

## Turn-state guards
- `applyUserMove` in GameContext must guard `!waitingForUser || isOpponentThinking || game.isGameOver()` to prevent late speech-recognition events firing during opponent turn.

**Why:** Delayed STT result events can arrive after turn handoff, corrupting game state.

## AI timeout race condition
- `opponentMove` uses `setTimeout`; reference kept in `opponentTimeoutRef`. Always `clearTimeout` before scheduling a new one, and also in `newGame`.

**Why:** If user triggers new game while AI timeout is pending, old callback fires into reset board.

## useColors typing
- `colors` object has `light`, `dark`, `radius` — use destructuring (`const { light, dark, radius } = colors`) not a `Record<string, typeof colors.light>` cast (fails TS because `radius: number` doesn't match palette shape).

## Web insets
- `Platform.OS === 'web'`: apply 67px top + 34px bottom padding (no SafeAreaView on web).
