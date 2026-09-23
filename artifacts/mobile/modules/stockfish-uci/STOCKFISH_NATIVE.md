# Native Stockfish (Phase G1–G5)

Android-only UCI process bridge. **G1** validated the transport. **G2** wires
AnyLyseur. **G3** wires Classic / Opening play. **G4** wires endgames.
**G5** calibrates Android analysis depth + AppState recover. Web WASM is
unchanged.

## Binary

| Field | Value |
|---|---|
| Engine | Stockfish 19 |
| Tag | `sf_19` (2026-09-05) |
| Source | https://github.com/official-stockfish/Stockfish/tree/sf_19 |
| Release | https://github.com/official-stockfish/Stockfish/releases/tag/sf_19 |
| Artifact | `stockfish-android-arm64-universal.tar.gz` |
| SHA-256 | `ebb24051aa4a222b4daaf049b882ecf1163d370c128fe02316602643f4d5e426` |
| Binary member | `stockfish/stockfish-android-arm64-universal` |
| Format | ELF 64-bit LSB executable, ARM aarch64, statically linked, stripped |
| Size | ~97 MiB (NNUE embedded) |
| License | GPL-3.0-or-later (`vendor/stockfish/Copying.txt`) |
| ABI shipped | **arm64-v8a only** (Pixel / modern Android) |
| Not shipped | armeabi-v7a, x86, x86_64 |

The tarball also contains upstream source/wiki; the fetch script extracts **only the executable** into `jniLibs/arm64-v8a/libstockfish.so`.

## Why not `filesDir`?

Pixel G1 smoke (`error=13, Permission denied`) copied the binary to
`/data/user/0/com.anychess.app/files/stockfish-sf_19` and then
`ProcessBuilder.start()` failed **before any UCI**. On Android 10+ (API 29)
the kernel refuses `execve` of files the app wrote under its home directory
(W^X). `File.setExecutable(true, …)` / `chmod 0755` can succeed and
`File.canExecute()` can be true; spawn still fails. The supported executable
location is `applicationInfo.nativeLibraryDir` (extracted jniLibs).

G1 therefore:

1. Ships the official binary as `libstockfish.so` (jniLibs require the `lib*.so` name).
2. Sets `expo.useLegacyPackaging=true` / `android:extractNativeLibs=true` so the
   file is extracted to disk (not left inside the APK).
3. Spawns `ProcessBuilder(nativeLibraryDir/libstockfish.so)` with cwd `filesDir`.
4. Does **not** copy the engine into `filesDir`.

## Location in the project

| Path | Role |
|---|---|
| `modules/stockfish-uci/` | Local Expo module (autolinked from `./modules`) |
| `modules/stockfish-uci/app.plugin.js` | extractNativeLibs + doNotStrip + legacy packaging |
| `modules/stockfish-uci/scripts/stockfish-android-manifest.json` | URL, tag, sha256, ABI |
| `modules/stockfish-uci/scripts/fetch-android-binary.mjs` | Gradle `preBuild` download + verify |
| `modules/stockfish-uci/android/src/main/jniLibs/arm64-v8a/libstockfish.so` | Gitignored; extracted to `nativeLibraryDir` at install |
| `modules/stockfish-uci/vendor/stockfish/` | Upstream `Copying.txt` + `AUTHORS` |

## Architecture

```
JS UciTransport (lib/engines/stockfish/transport.ts)
  → Expo module StockfishUci (stdin/stdout lines)
    → ProcessBuilder(nativeLibraryDir/libstockfish.so)

G2 AnyLyseur:
  useAnyLyseurAnalysis → AnalysisController → StockfishChessEngine
    → createChessEngineService.ts (Android) → UciTransport above

G3a Classic:
  GameContext → createOpponentEngine → StockfishEngine → UciTransport above
  (RandomEngine only if native init fails)

G4 Endgames:
  UI → SharedStockfishRuntime → StockfishAnalysisService
    → ChessEngineService → UciTransport above
```

Web keeps `transport.web.ts` (WASM Worker) via `createChessEngineService.web.ts`.
Metro never resolves the native module on web.

`diagnose()` (DEV) reports `absolutePath`, `exists`, `length`, `canExecute`,
POSIX mode, `setExecutable` / `chmod` results, `extractNativeLibs`, and the
legacy filesDir candidate (not used for spawn).

## Device recipe (G1)

1. Install the Development Build APK (`assembleDebug`) on an **arm64** device.
2. Open `/dev/stockfish-uci` (DEV only).
3. Expect: Engine started → uciok → readyok → info → bestmove → stop OK → terminate OK.
4. Failures are explicit (no start / no uciok / no readyok / timeout / no bestmove / process still alive).

## Device recipe (G2)

1. Same Development Build (native module already in the APK). Metro reload is enough for the JS factory.
2. Open AnyLyseur (not Classic / Openings / Finales).
3. Expect: engine goes from unavailable → ready; position analysis; eval; MultiPV; Fast/Normal/Deep; stop-on-navigate; retry; dispose on leave; clean re-init on return.

## Device recipe (G3a Classic)

1. Metro reload is enough (JS factory). Same G1 APK.
2. Open **Partie classique** only (not Opening play — G3b waits).
3. Expect: opponent thinks, plays a legal move, undo/cancel, new game, strength band, leave/return, no freeze, no orphan process. RandomEngine only if native init fails.

## Device recipe (G4 Endgames)

1. Metro reload is enough (JS). Same G1 APK.
2. **Défends la nulle**: prewarm → ready → defend, WDL/pressure unchanged, retry, leave during search, return, no orphan.
3. **Finales théoriques**: engine plays, session/explanations unchanged, Analyze Game / Analyze Position still work.
4. Do not overlap Classic/AnyLyseur searches (one native process).

## G5 calibration (code-derived)

Stockfish 18 WASM and Stockfish 19 native share `UCI_LimitStrength` +
`UCI_Elo` with a **1320 floor**. Product bands `<800` … `1200–1400` all send
`UCI_Elo 1320` plus MultiPV 8 / variety 120. Labels were not renamed.
Play movetime stays 1000 ms (`DEFAULT_STOCKFISH_CONFIG`).

AnyLyseur web profiles stay Fast 12/250, Normal 16/800, Deep 20/2500.
Android raises depth caps to 20 / 26 / 32 so native NPS does not make Deep
exit at depth 20 in a few dozen ms. Movetimes (UI budget) stay identical.

Background: Kotlin + JS already kill the process. G5 adds `recoverAfterBackground`
on `ChessEngineService` and `StockfishEngine` so foreground re-inits.

## Device recipe (G5)

1. Same Development Build. Metro reload is enough for JS.
2. **Bands**: play a few moves at `<800`, `1000–1200`, `1400–1600`, `>2200`.
   Expect 800-class to feel similar to 1200 (same UCI floor) but weaker than 1500.
3. **AnyLyseur**: Fast / Normal / Deep — UI stays responsive; Deep takes longer
   wall-clock than Fast; MultiPV 3; note depth in `__DEV__` logs.
4. **Background**: start a search, Home, return — engine re-inits, no freeze,
   no orphan `libstockfish.so` process (`ps -A | grep stockfish`).
5. **Successive screens**: Classic → AnyLyseur → Finales → leave. No orphan.
6. Heat / RAM: native binary ~97 MiB + default 16 MiB hash. Watch for thermal
   throttling on a long Deep Analyze Game.
