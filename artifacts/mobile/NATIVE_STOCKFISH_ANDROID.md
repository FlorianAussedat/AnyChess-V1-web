# Native Stockfish on Android (baseline)

Canonical notes for the `feat/native-stockfish` baseline. Module-local fetch
and W^X details also live under `modules/stockfish-uci/` (`NOTICE.md`,
`scripts/stockfish-android-manifest.json`).

**Status:** G1–G5 validated on Pixel arm64-v8a. Web WASM is unchanged.
**iOS is not included.** Do not treat Expo Go as a Stockfish host.

## Architecture

```
Android (native process)
  UciTransport          lib/engines/stockfish/transport.ts
    → Expo module       modules/stockfish-uci (StockfishUci)
      → ProcessBuilder  nativeLibraryDir/libstockfish.so  (SF19, arm64-v8a)

Web (unchanged)
  UciTransport          lib/engines/stockfish/transport.web.ts
    → Web Worker        public/engine/stockfish-18-lite-single.js + .wasm
```

Product wiring (existing stacks, no extra engine layer):

| Mode | Factory | Engine |
|---|---|---|
| AnyLyseur | `createChessEngineService` (Android injects native transport) | `ChessEngineService` full strength |
| Partie classique | `createOpponentEngine` → `StockfishEngine` | LimitStrength + `UCI_Elo` |
| Opening play | same `createOpponentEngine` | same, after book exit |
| Défends la nulle / Finales | `SharedStockfishRuntime` → `StockfishAnalysisService` | full strength + WDL |

Classic/Opening: `RandomEngine` only if native `init()` fails (`withInitFallback`).
AnyLyseur / endgames never fall back to random moves.

Do not run Classic, AnyLyseur, and endgames searches at the same time on
Android (one native process).

## Transport

`UciTransport` is `{ start, send, terminate }`.

- **Android / iOS Metro:** `transport.ts`. Android uses `StockfishUci`. iOS throws
  (no binary). Background: JS `AppState` + Kotlin `OnActivityEntersBackground`
  kill the process. Foreground: `recoverAfterBackground` re-inits if the screen
  still owns the service.
- **Web Metro:** `transport.web.ts` — `new Worker(enginePath)`. No native module.

## Local Expo module

| Path | Role |
|---|---|
| `modules/stockfish-uci/` | Autolinked Expo module |
| `android/.../StockfishUciModule.kt` | stdin/stdout process bridge |
| `app.plugin.js` | `extractNativeLibs`, `doNotStrip`, `expo.useLegacyPackaging` |
| `scripts/fetch-android-binary.mjs` | Gradle `preBuild` download + sha256 |
| `scripts/stockfish-android-manifest.json` | Version pin |
| `vendor/stockfish/Copying.txt` | GPL-3.0-or-later text |
| `vendor/stockfish/AUTHORS` | Upstream authors |
| `NOTICE.md` | Provenance + how to get Corresponding Source |

App plugin is listed in `app.json`.

## Binary / version

| Field | Value |
|---|---|
| Engine | Stockfish 19 |
| Tag | `sf_19` |
| Source | https://github.com/official-stockfish/Stockfish/tree/sf_19 |
| Release | https://github.com/official-stockfish/Stockfish/releases/tag/sf_19 |
| Artifact | `stockfish-android-arm64-universal.tar.gz` |
| SHA-256 | `ebb24051aa4a222b4daaf049b882ecf1163d370c128fe02316602643f4d5e426` |
| On device | `libstockfish.so` in `applicationInfo.nativeLibraryDir` |
| Size | ~97 MiB (NNUE embedded, statically linked) |
| License | GPL-3.0-or-later |

The binary is **gitignored** and fetched at `preBuild`. Do not copy it into
`filesDir` (Android 10+ W^X → `error=13`).

## ABI

**Supported:** `arm64-v8a` (Pixel / modern Android).

**Not shipped:** `armeabi-v7a`, `x86`, `x86_64`.

This baseline does not compile extra Stockfish ABIs. The React Native app may
still package other ABIs for other `.so` files; Stockfish is absent there.

Non-arm64 devices: Kotlin throws a clear “arm64-v8a only” error before spawn.
Classic/Opening fall back to `RandomEngine`. AnyLyseur / endgames surface
`error` / retry — never a random eval.

## Lifecycle

1. `start` → `ProcessBuilder(libstockfish.so)`.
2. UCI handshake `uci` → `uciok` → options → `isready` → `readyok`.
3. `go` / `stop` / `quit`.
4. App background → terminate process (no resume of the old PID).
5. App foreground → JS re-boots a new process if the owner is still mounted.
6. `destroy` / leave screen → `quit` + `terminate`.

## Factory wiring

- AnyLyseur: `useAnyLyseurAnalysis` → `AnalysisController` → `StockfishChessEngine` → `createChessEngineService.ts`
- Classic: `GameContext` → `createOpponentEngine` → `StockfishEngine`
- Opening: `OpeningGameContext` → same factory
- Endgames: UI → `SharedStockfishRuntime` → `StockfishAnalysisService` → `ChessEngineService`

Elo bands, WDL, practical-pressure, and theory session logic are unchanged.
`UCI_Elo` floor remains **1320** (Stockfish). Product labels were not renamed.
AnyLyseur web: Fast 12/250, Normal 16/800, Deep 20/2500. Android depth caps
20 / 26 / 32 with the same movetimes.

## Web vs native

| | Web | Android |
|---|---|---|
| Engine | Stockfish 18 lite single-thread WASM | Stockfish 19 official native |
| Transport | Worker | Process + Expo module |
| Classic | `StockfishEngine` | `StockfishEngine` + RandomEngine fallback |
| AnyLyseur | `createChessEngineService.web.ts` | `createChessEngineService.ts` |
| Endgames | `SharedStockfishRuntime` | same, native transport |
| iOS | n/a (this table) | unavailable |
| Expo Go | WASM on web only | no custom module |

`transport.web.ts` and `createChessEngineService.web.ts` are the web path.
Metro does not resolve `StockfishUci` on web.

## Limitations

- arm64-v8a only.
- No iOS binary.
- Expo Go cannot load `StockfishUci`.
- One native process: overlapping screens can contend.
- Bands below 1320 share Stockfish’s Elo floor + extra MultiPV/variety.
- Native analysis is stronger/faster than WASM lite; Deep uses more of the
  time budget (higher depth caps).
- ~97 MiB RAM for the engine image plus default 16 MiB hash.
- Background always kills the engine (no mid-search resume).

## DEV harness

Keep **`/dev/stockfish-uci`** for Development Builds.

- Registered in the root stack only when `__DEV__`.
- Production: `Redirect` to `/`. Not linked from Accueil or product nav.
- Deep link: `mobile://dev/stockfish-uci` (rewritten by `+native-intent`).
- Usage: install debug APK → open the route → **Run UCI smoke**.
  Expect start, uciok, readyok, info, bestmove, stop, terminate.

## Build recipe

1. `cd artifacts/mobile`
2. Development Client / `android/` prebuild already present, or `npx expo prebuild -p android`.
3. `cd android && ./gradlew :app:assembleDebug`
   - `preBuild` fetches and verifies `libstockfish.so`.
4. Install the APK on an **arm64** device (not Expo Go).
5. `pnpm typecheck` and `pnpm test` from `artifacts/mobile`.

## Device smoke (baseline)

On Pixel arm64-v8a, after G1–G5:

1. `/dev/stockfish-uci` smoke (optional).
2. Partie classique — legal moves, undo, bands.
3. Opening play — book then native handoff.
4. AnyLyseur — ready, eval, MultiPV, Fast/Normal/Deep, retry, leave/return.
5. Défends la nulle — WDL / practical-pressure.
6. Finales théoriques — play + Analyze Game / Position.
7. Home/background then return — re-init, no orphan `libstockfish.so`.

---

# NATIVE STOCKFISH ANDROID BASELINE

Fast-forward `feat/native-stockfish` → `main` (10 commits G1–G6, no squash).
Ancestor: PRE-STOCKFISH `edd1ba7`.

| Item | Value |
|---|---|
| SHA `main` (landing) | `25aadc566710a834d7bccb6a65abd483a4e883ef` |
| Expo | SDK 54 (`expo` 54.0.35, pin `~54.0.27`) |
| Stockfish | 19 official (`sf_19`) native process `libstockfish.so` |
| Android package | `com.anychess.app` |
| ABI | **arm64-v8a only** |
| Typecheck | OK |
| Tests | 1212 pass / 1 pre-existing fail (`vision UX opt-ins`) |
| expo-doctor | 17/18 — pre-existing `expo` / `expo-constants` patch skew (not bumped) |
| assembleDebug | BUILD SUCCESSFUL (`app-debug.apk` ~168 MiB) |
| Device | G1–G5 PASS on Pixel arm64-v8a |
| Web | WASM Worker unchanged |
| iOS | not supported |

**READY — NATIVE STOCKFISH ANDROID MERGED**
