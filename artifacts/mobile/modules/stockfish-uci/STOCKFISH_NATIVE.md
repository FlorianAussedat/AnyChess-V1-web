# Native Stockfish (Phase G1)

Android-only UCI process bridge. Product screens (Classic, Openings, AnyLyseur, endgames) are **not** wired to this transport in G1.

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
```

Web keeps `transport.web.ts` (WASM Worker). Metro never resolves the native module on web.

`diagnose()` (DEV) reports `absolutePath`, `exists`, `length`, `canExecute`,
POSIX mode, `setExecutable` / `chmod` results, `extractNativeLibs`, and the
legacy filesDir candidate (not used for spawn).

## Device recipe (G1)

1. Install the Development Build APK (`assembleDebug`) on an **arm64** device.
2. Open `/dev/stockfish-uci` (DEV only).
3. Expect: Engine started → uciok → readyok → info → bestmove → stop OK → terminate OK.
4. Failures are explicit (no start / no uciok / no readyok / timeout / no bestmove / process still alive).
