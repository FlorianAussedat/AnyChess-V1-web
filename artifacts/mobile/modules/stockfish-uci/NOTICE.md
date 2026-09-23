# Stockfish licence notice

This local Expo module (`stockfish-uci`) ships **official Stockfish 19** as a
standalone Android process and talks to it over UCI stdin/stdout.

Stockfish is copyright the Stockfish authors and is licensed under
**GNU GPL-3.0-or-later**.

| Item | Location |
|---|---|
| Licence text | `vendor/stockfish/Copying.txt` |
| Authors | `vendor/stockfish/AUTHORS` |
| Provenance pin | `scripts/stockfish-android-manifest.json` |
| Corresponding Source | https://github.com/official-stockfish/Stockfish/tree/sf_19 |
| Official release | https://github.com/official-stockfish/Stockfish/releases/tag/sf_19 |
| Artifact | `stockfish-android-arm64-universal.tar.gz` |
| SHA-256 | `ebb24051aa4a222b4daaf049b882ecf1163d370c128fe02316602643f4d5e426` |

The Gradle `preBuild` fetch script downloads that official tarball, verifies
the SHA-256, and extracts only the `arm64-v8a` executable as
`libstockfish.so`. The tarball is not committed; rebuilds re-download from
upstream.

The JS/Kotlin UCI bridge in this folder is original AnyChess code. It does
not modify Stockfish sources. Communication is with a separate process
(`ProcessBuilder` → `nativeLibraryDir/libstockfish.so`).

To obtain source matching the shipped binary: clone tag `sf_19` at the URL
above, or download the release source archive from the same GitHub release.
Do not delete `Copying.txt` or `AUTHORS`.
