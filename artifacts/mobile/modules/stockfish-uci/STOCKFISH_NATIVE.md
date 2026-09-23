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

The tarball also contains upstream source/wiki; the fetch script extracts **only the executable** into module assets.

## Location in the project

| Path | Role |
|---|---|
| `modules/stockfish-uci/` | Local Expo module (autolinked from `./modules`) |
| `modules/stockfish-uci/scripts/stockfish-android-manifest.json` | URL, tag, sha256, ABI |
| `modules/stockfish-uci/scripts/fetch-android-binary.mjs` | Gradle `preBuild` download + verify |
| `modules/stockfish-uci/android/src/main/assets/stockfish/stockfish.sfbin` | Gitignored; copied to `filesDir` on first `start()` |
| `modules/stockfish-uci/vendor/stockfish/` | Upstream `Copying.txt` + `AUTHORS` |

## Architecture

```
JS UciTransport (lib/engines/stockfish/transport.ts)
  → Expo module StockfishUci (stdin/stdout lines)
    → ProcessBuilder(official stockfish-android-arm64-universal)
```

Web keeps `transport.web.ts` (WASM Worker). Metro never resolves the native module on web.

## Device recipe (G1)

1. Install the Development Build APK (`assembleDebug`) on an **arm64** device.
2. Open `/dev/stockfish-uci` (DEV only).
3. Expect: Engine started → uciok → readyok → info → bestmove → stop OK → terminate OK.
4. Failures are explicit (no start / no uciok / no readyok / timeout / no bestmove / process still alive).
