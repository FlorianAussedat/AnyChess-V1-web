# AnyChess — First Android Development Build

Observations **build** + checklist **appareil**.  
Aucun test téléphone n’a encore été exécuté dans cet environnement (pas d’émulateur / pas d’APK sideloadé sur un device physique).  
Les cases appareil sont à remplir avec **PASS** / **BUG** / **NON DISPONIBLE VOLONTAIREMENT**.

**Date :** 2026-09-22  
**Branche :** `cursor/first-android-dev-build-0b65` (base `cursor/pre-dev-build-fixes-0b65` / PR #57)  
**Package :** `com.anychess.app`  
**Version :** `0.0.6` (versionCode 1)  
**SDK :** Expo 54 / RN 0.81.5 / New Architecture

Stockfish natif : **non intégré** (voulu).

---

## 1. Vérification pré-build

### Config

| Item | État |
|---|---|
| `app.json` name / slug / scheme | AnyChess / `mobile` / `mobile` |
| `android.package` | `com.anychess.app` |
| `orientation` | `portrait` |
| `newArchEnabled` | `true` |
| `expo-dev-client` | `~6.0.21` + plugin `app.json` |
| `eas.json` profil `development` | `developmentClient: true`, `distribution: internal`, `android.withoutCredentials: true` |
| `ios.bundleIdentifier` | **absent** (Android-only, non bloquant) |
| `extra.eas.projectId` | **absent** — requis seulement pour EAS cloud après `eas login` + `eas init` |

### Plugins `app.json`

- `expo-router` (`origin: https://replit.com/` — web Replit, non bloquant compile)
- `expo-font`
- `expo-web-browser`
- `expo-dev-client`
- `expo-speech-recognition` (micro + reco vocale)

Plugins **auto-appliqués** par les packages (pas listés explicitement, autolink config) :

- `expo-av` (ajoute `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS`)
- `expo-splash-screen`
- `expo-document-picker`

### Pins SDK 54 (après PR #57)

| Package | Pin |
|---|---|
| `expo-clipboard` | `~8.0.8` |
| `expo-speech-recognition` | dist-tag `sdk-54` → 3.1.3 |
| `@react-native-community/slider` | `5.0.1` |
| `expo-dev-client` | `~6.0.21` |

### Permissions Android générées (manifest)

- `INTERNET`
- `RECORD_AUDIO` (reco vocale + expo-av)
- `MODIFY_AUDIO_SETTINGS`
- `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` (template Expo)
- `VIBRATE`
- `SYSTEM_ALERT_WINDOW` (debug / overlay Expo)
- queries : Google speech (`com.google.android.googlequicksearchbox` + `RecognitionService`)

### Checks

| Check | Résultat |
|---|---|
| `pnpm typecheck` | OK |
| `pnpm test` | 1155 pass / **1 fail préexistante** `vision UX opt-ins` (`nommer.tsx` / `colors.primary`) — **non bloquant** |
| `npx expo-doctor` | 17/18 — mismatches patch `expo 54.0.35` vs `~54.0.37` et `expo-constants 18.0.13` vs `~18.0.14` (**non touchés**) |
| `expo config --type prebuild` | `sdkVersion 54.0.0`, package `com.anychess.app` |

---

## 2. Compilation

### EAS cloud (`development`)

**Non lancé jusqu’au bout.** Compte Expo manquant.

```
An Expo user account is required to proceed.
Either log in with eas login or set the EXPO_TOKEN environment variable
```

Commande :

```bash
cd artifacts/mobile
npx eas-cli build --platform android --profile development --non-interactive
```

Pas de Docker → `eas build --local` impossible ici.

### Prebuild + Gradle local (équivalent `developmentClient` debug APK)

**Compile : OUI.** `BUILD SUCCESSFUL` en 10 m 23 s, 548 tâches.

```bash
cd artifacts/mobile
CI=1 EXPO_NO_TELEMETRY=1 pnpm exec expo prebuild --platform android --no-install
# ANDROID_HOME = SDK 36 + NDK 27.1.12297006 + build-tools 36.0.0
cd android
./gradlew :app:assembleDebug --no-daemon
```

APK :

- `artifacts/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- copie : `/opt/cursor/artifacts/builds/anychess-dev-android-debug.apk`
- taille : **~220 Mo** (debug, 4 ABI : armeabi-v7a, arm64-v8a, x86, x86_64)
- signature : **debug keystore** (`androiddebugkey`)
- `applicationId` : `com.anychess.app`

`android/` reste gitignoré (CNG). Pas de dossier natif custom commité.

### Erreurs natives

**Aucune.** Prebuild et `assembleDebug` OK. Pas de red screen compile, pas d’échec autolink.

Warnings Gradle (dépréciations Gradle 9, non bloquants) — **non corrigés**.

---

## 3. Config / fichiers réellement modifiés pour cette étape

Minimal, uniquement pour produire un APK debug sideloadable sans credentials Play :

1. `artifacts/mobile/eas.json` — `android.withoutCredentials: true` sur le profil `development`
2. `artifacts/mobile/package.json` — scripts Expo `android` / `ios` ajoutés par prebuild (`expo run:android` / `expo run:ios`)
3. `artifacts/mobile/FIRST_DEV_BUILD_DEVICE_REPORT.md` — ce rapport

**Non modifié :** `app.json` plugins, Stockfish, stores, datasets, flows produit.

Prebuild a aussi **tenté** de dupliquer `expo` / `react` / `react-native` dans `dependencies` — **annulé** (inutile et hors périmètre).

---

## 4. Commandes utilisées

```bash
pnpm typecheck
pnpm test
npx expo-doctor
pnpm exec expo config --type prebuild
npx eas-cli build --platform android --profile development --non-interactive
CI=1 EXPO_NO_TELEMETRY=1 pnpm exec expo prebuild --platform android --no-install
./gradlew :app:assembleDebug --no-daemon
```

---

## 5. Comment installer sur Android

### Option A — APK debug local (disponible maintenant)

1. Copier `app-debug.apk` sur le téléphone (câble, Drive, etc.) **ou** :

```bash
adb install -r artifacts/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

2. Autoriser « sources inconnues » si demandé.
3. Ouvrir **AnyChess**. Premier lancement = client de dev (écran Expo Dev Client).
4. Sur la machine de dev, dans `artifacts/mobile` :

```bash
pnpm exec expo start --dev-client
```

5. Scanner le QR / entrer l’URL Metro (même réseau, ou tunnel).

Sans Metro, le binaire s’installe mais le JS bundle debug n’est pas servi (c’est un **development build**, pas un standalone release).

### Option B — EAS cloud (après login Expo)

```bash
cd artifacts/mobile
npx eas-cli login          # ou EXPO_TOKEN
npx eas-cli init           # écrit extra.eas.projectId dans app.json
npx eas-cli build --platform android --profile development
```

Le profil `development` (`developmentClient` + `distribution: internal`) produit un APK installable. Lien de download sur expo.dev. Puis même `expo start --dev-client`.

### Option C — machine locale avec SDK

```bash
cd artifacts/mobile
pnpm android
# = expo run:android (prebuild si besoin + assemble + install émulateur/device)
```

---

## 6. Comportement moteur attendu (ne pas traiter comme bug compile)

| Surface | Attendu sur ce build |
|---|---|
| Partie classique / ouvertures jeu | `RandomEngine` (pas de vrai Stockfish) |
| AnyLyseur | statut `unavailable` propre, pas de crash, lecteur utilisable |
| Finales qui appellent l’analyse | indisponibilité gérée, pas de WASM RN |
| Export PGN fichier / Share | incomplet possible, **ne doit pas crasher l’app** |
| `content://` FileSystem fallback | pas implémenté |
| SQLite | non |
| Analyses persistées | RAM session only |

---

## 7. Checklist appareil

Remplir **une** case par ligne : PASS / BUG / NON DISPONIBLE VOLONTAIREMENT.  
Noter URI `content://` exacts si un import fichier échoue.  
Ne pas « corriger » un écart web tant que ce n’est pas un crash.

Légende : **NDV** = non disponible volontairement.

### Boot

| # | Test | PASS | BUG | NDV | Notes |
|---|---|---|---|---|---|
| B1 | Installation APK | | | | |
| B2 | Premier lancement | | | | |
| B3 | Splash `#0B1728` | | | | |
| B4 | Accueil | | | | |
| B5 | Navigation barre du bas | | | | |
| B6 | Back Android | | | | |

### UI

| # | Test | PASS | BUG | NDV | Notes |
|---|---|---|---|---|---|
| U1 | Safe areas | | | | |
| U2 | Scrolling | | | | |
| U3 | Tailles / débordements | | | | |
| U4 | Plateau | | | | |
| U5 | Orientation portrait (paysage bloqué) | | | | |
| U6 | Tap des cases | | | | |
| U7 | Overlays (flèches, dots) | | | | |
| U8 | Keypad échecs | | | | |
| U9 | Clavier Android (paste PGN, champs) | | | | |

### Stockage

| # | Test | PASS | BUG | NDV | Notes |
|---|---|---|---|---|---|
| S1 | Modifier préférences | | | | |
| S2 | Kill app | | | | |
| S3 | Relancer | | | | |
| S4 | Persistance prefs OK | | | | |
| S5 | Importer une petite partie | | | | |
| S6 | Rouvrir la bibliothèque | | | | |

### PGN

| # | Test | PASS | BUG | NDV | Notes / URI |
|---|---|---|---|---|---|
| P1 | Import fichier simple | | | | |
| P2 | Import multi-parties | | | | |
| P3 | DocumentPicker s’ouvre | | | | |
| P4 | Fichier depuis Downloads | | | | `content://` : |
| P5 | Autre provider Android | | | | `content://` : |

Téléchargement `.pgn` natif / Share PGN : **NDV** si absent ; BUG seulement si **crash**.

### Presse-papiers

| # | Test | PASS | BUG | NDV | Notes |
|---|---|---|---|---|---|
| C1 | Copier PGN | | | | |
| C2 | Copier FEN (si le bouton existe sur l’écran testé) | | | | |

### TTS

| # | Test | PASS | BUG | NDV | Notes |
|---|---|---|---|---|---|
| T1 | Parler un coup | | | | |
| T2 | Arrêter | | | | |
| T3 | Quitter l’écran pendant la parole | | | | |
| T4 | Relancer TTS | | | | |

### Micro

| # | Test | PASS | BUG | NDV | Notes |
|---|---|---|---|---|---|
| M1 | Demande de permission | | | | |
| M2 | Autoriser | | | | |
| M3 | Refuser (clavier/keypad toujours OK) | | | | |
| M4 | Dictée FR | | | | |
| M5 | Dictée EN si dispo | | | | |
| M6 | Quitter / revenir sur l’écran | | | | |

### Partie classique

| # | Test | PASS | BUG | NDV | Notes |
|---|---|---|---|---|---|
| G1 | Lancement | | | | |
| G2 | Camp Blancs | | | | |
| G3 | Camp Noirs | | | | |
| G4 | Déplacement tap-tap | | | | |
| G5 | Keypad | | | | |
| G6 | Fallback moteur (RandomEngine, pas Stockfish) | | | NDV Stockfish réel | |
| G7 | Undo | | | | |
| G8 | Quitter l’écran | | | | |

### Lecteur

| # | Test | PASS | BUG | NDV | Notes |
|---|---|---|---|---|---|
| L1 | Charger une partie | | | | |
| L2 | Naviguer | | | | |
| L3 | Variante | | | | |
| L4 | Flip | | | | |
| L5 | Kill / restart | | | | |
| L6 | Restauration session | | | | |

### AnyLyseur

| # | Test | PASS | BUG | NDV | Notes |
|---|---|---|---|---|---|
| A1 | Ouverture | | | | |
| A2 | Absence Stockfish = `unavailable` propre | | | NDV moteur réel | |
| A3 | Aucun red screen | | | | |
| A4 | Aucune Promise non gérée | | | | |
| A5 | Lecteur utilisable sans moteur | | | | |

### Ouvertures

| # | Test | PASS | BUG | NDV | Notes |
|---|---|---|---|---|---|
| O1 | Ouvrir répertoire | | | | |
| O2 | Study | | | | |
| O3 | Éditeur | | | | |
| O4 | Sauvegarde | | | | |
| O5 | Navigation | | | | |
| O6 | Keypad | | | | |
| O7 | Micro | | | | |

### Tactique

| # | Test | PASS | BUG | NDV | Notes |
|---|---|---|---|---|---|
| X1 | Problème | | | | |
| X2 | Tap | | | | |
| X3 | Keypad | | | | |
| X4 | Résultat | | | | |

### Finales

| # | Test | PASS | BUG | NDV | Notes |
|---|---|---|---|---|---|
| F1 | Ouvrir les écrans | | | | |
| F2 | Absence moteur gérée (pas de crash) | | | NDV Stockfish réel | |
| F3 | Aucun crash | | | | |

### Background / foreground

| # | Test | PASS | BUG | NDV | Notes |
|---|---|---|---|---|---|
| BG1 | App en arrière-plan | | | | |
| BG2 | Revenir — écran cohérent | | | | |
| BG3 | Audio / micro arrêtés correctement | | | | |

---

## 8. Suite volontairement hors de cette étape

- Corriger les bugs fonctionnels découverts **sur téléphone**
- Stockfish UCI natif / WASM dans RN
- Share PGN, FileSystem `content://`, SQLite
- Merger cette branche
- Compte Expo / `eas init` (à faire sur la machine du mainteneur)
