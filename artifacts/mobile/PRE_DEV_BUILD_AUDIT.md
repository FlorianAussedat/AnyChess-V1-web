# AnyChess — Pre Dev Build Audit

Document de consolidation (audits cartographie, qualité, fonctionnel, tests, Stockfish, stockage, PGN, voix, UI, perf, dépendances, Expo, architecture, résilience).

**Périmètre :** `artifacts/mobile` — Expo SDK 54, React Native 0.81.5, React 19.1.0.  
**Date :** 2026-09-22.  
**Branche d’audit :** `cursor/audit-dev-build-0b65` (base `main` @ `16e40c8`).  
**Aucune correction de code dans cette étape.**

Objectif du gate : rendre AnyChess **assez stable, testable et découplé** pour un Premier Development Build Android, **sans** réécriture et **sans** dette « pour le futur ».

---

## 1. État général

AnyChess est une application **Expo Router / React Native Web** déjà structurée pour le natif sur le métier (échecs, PGN, voix *parse*, stores). Le runtime actuel est **web-first** (Replit + Metro). Il n’y a **pas** de `android/` / `ios/` (CNG, gitignorés), **pas** d’`eas.json`, **pas** d’`expo-dev-client`.

Ce qui est solide :

- Parsers PGN (index léger + parse des seules parties choisies).
- `chess.js` pour la légalité ; erreurs de coups généralement catchées.
- Interfaces `ChessEngine`, `UciTransport`, `KeyValueStorage`, `speechService`, `pickPgnFile(s)`, `copyToClipboard`.
- ErrorBoundary racine ; AnyLyseur affiche PGN/FEN invalide au lieu de throw.
- 114 tests `node:test` sur le métier.

Ce qui n’est **pas** prêt tel quel pour un binaire :

- Identité Expo incomplète (`android.package` absent).
- Trois packages **hors** versions bundled SDK 54 (`expo-clipboard@57`, `expo-speech-recognition@56`, slider `5.2.0`).
- Stockfish **web-only** (Worker + WASM) ; natif = `RandomEngine` / analyse `unavailable` — **voulu** pour le 1er build, pas un secret.
- Un trou de persistance : bibliothèque de parties qui **peut s’écraser** si le JSON disque est corrompu.

**Décision de fond :** un Premier Dev Build sert à **booter l’UI + TTS + micro + picker + stockage** sur un vrai Android. Stockfish fort et share PGN viennent **après**.

---

## 2. BLOCKERS

Uniquement ce qui rend le *development build* dangereux à compiler, linker, ou qui casse une fonctionnalité **cœur** dès l’install (voix, identité, modules natifs incompatibles).

### B1 — Identité Expo / EAS / dev-client absents

- **Problème :** `app.json` sans `android.package`, sans `ios.bundleIdentifier`, sans `eas.json`, sans `expo-dev-client`. `slug`/`scheme` = `mobile`.
- **Fichiers :** `app.json`, `package.json` (pas de `expo-dev-client`).
- **Impact :** prebuild / EAS refuse ou produit un id non unique. Reco vocale = module **hors Expo Go** → sans dev-client, pas de STT natif.
- **Correction :** `android.package` + `ios.bundleIdentifier` stables (ex. `com.anychess.app`) ; `scheme`/`slug` `anychess` ; `expo-dev-client@~6.0.21` ; `eas.json` profil `development` (`developmentClient: true`).
- **Tests :** `npx expo config --type public` affiche package/bundle ; `eas build --profile development --platform android` (ou prebuild local) aboutit.

### B2 — `expo-clipboard@57` vs SDK 54 (`~8.0.8`)

- **Problème :** lock `57.0.1` (module Expo **57**). Bundled SDK 54 = `expo-clipboard ~8.0.8`.
- **Fichiers :** `package.json`, `pnpm-lock.yaml`, `lib/clipboard.ts`.
- **Impact :** autolink / compile native imprévisible ; copie FEN/PGN cassée sur appareil.
- **Correction :** `pnpm exec expo install expo-clipboard` **dans** `artifacts/mobile` → pin `~8.0.8`. **Pas** `expo upgrade`.
- **Tests :** `expo-doctor` / versions bundled ; smoke copie AnyLyseur.

### B3 — `expo-speech-recognition@56` vs tag `sdk-54`

- **Problème :** lock `56.0.1` (ciblé Expo 56). README du package : `npm install expo-speech-recognition@sdk-54`.
- **Fichiers :** `package.json`, `app.json` (plugin déjà présent), `services/SpeechRecognitionService.ts`.
- **Impact :** STT / micro **cœur** ; linker ou runtime natif faux. Web (Web Speech) masque le problème.
- **Correction :** installer le dist-tag **`sdk-54`**. Garder le plugin et les strings de permission.
- **Tests :** `ExpoSpeechRecognitionModule.isRecognitionAvailable()` + `requestPermissionsAsync` sur appareil ; refus micro → clavier toujours utilisable.

### B4 — `@react-native-community/slider@5.2.0` vs bundled `5.0.1`

- **Problème :** New Arch (`newArchEnabled: true`) testée par Expo avec **5.0.1**.
- **Fichiers :** `package.json`, `components/ui/DiscreteSlider.tsx`.
- **Impact :** `expo-doctor` rouge ; crash native possible sur curseurs (tactique, force, aveugle).
- **Correction :** pin **`5.0.1`** via `expo install`.
- **Tests :** un écran avec `DiscreteSlider` (puzzles settings, Classique force).

Ces quatre points **bloquent** un premier binaire honnête. Le reste peut attendre le smoke appareil, sauf la section 3 (données / autolink).

---

## 3. FIX BEFORE DEV BUILD

Non bloquants pour « ça compile », **fortement recommandés** avant de mettre l’app entre des mains (perte de données, permissions Play, plugins manquants).

| Item | Fichiers | Pourquoi | Correction minimale |
|---|---|---|---|
| Wipe bibliothèque si JSON corrompu | `lib/gameLibrary/GameLibraryStore.ts` `getSnapshot` `catch` → `{}` | Prochain `persist` **écrase** toutes les parties | `loadStoredJson` + quarantaine ; **ne pas** `setItem` du vide |
| Cache avant `setItem` | `GameLibraryStore.persist` | Quota → UI « sauvé », disque ancien | `setItem` puis `this.cache = next` |
| Autolink permissions inutiles | `expo-location`, `expo-image-picker`, blur, glass, linear-gradient, symbols, `expo-web-browser` | GPS / photos dans le manifeste sans feature | Retirer du `package.json` + plugin web-browser |
| npm `stockfish` | `package.json` dependencies | Non importé ; moteur = `public/engine/*.wasm` | Retirer le package npm |
| Plugins manquants | `app.json` | SFX, splash, picker iOS | Ajouter `expo-av`, `expo-splash-screen`, `expo-document-picker` (versions **déjà** 54) |
| Icône / splash | `app.json`, `assets/images/icon.png` (~1 Mo, 1024²) | Splash = même PNG ; pas d’`adaptiveIcon` | Adaptive Android ; splash fond `#0B1728` + visuel compressé |
| Plugin router `origin: replit.com` | `app.json` | Origine web Replit dans le binaire | Ne pas l’emporter tel quel dans le profil natif |
| Runtime en `devDependencies` | `package.json` | `pnpm install --prod` casserait l’app | Déplacer expo/RN/react en `dependencies` **sans** changer les versions |

**Ne pas** : virtualiser toutes les listes, mémoïser React partout, fusionner les 3 workers, upgrader le SDK.

---

## 4. SAFE TO MIGRATE

Assez propres / déjà abstraites — **pas de travail préalable important**.

- **Métier :** `chess.js`, `lib/repertoire/pgnParser.ts`, `indexPgnGamesLight`, `importSelectedPgnGames`, `parseReaderPgn`, arbres `ReaderGame`, quiz, tactique, finales, aveugle (logique), `parseChessVoice`.
- **Moteur (contrat) :** `lib/engine.ts` `ChessEngine`, `createOpponentEngine()`, `transport.ts` stub, `createChessEngineService.ts` sans transport → `unavailable`.
- **Stockage (contrat) :** `KeyValueStorage` / `AsyncKeyValueStorage` / `loadStoredJson` (répertoire, prefs, session, records). AsyncStorage web **et** Android.
- **Voix parse :** `lib/voice/*` — zéro DOM.
- **TTS :** `services/SpeechService.ts` (`expo-speech`).
- **STT appelants :** écrans via `useSpeechInput` uniquement.
- **Picker :** branche `DocumentPicker` **déjà** écrite (`pickPgnFile`, `pickPgnFiles`).
- **UI RN :** échiquier SVG, keypad, `Alert` (`confirmAction`), haptics, `expo-image`, Router, SafeArea.
- **Jeu sans Stockfish :** Classique / Ouvertures contre `RandomEngine` (natif actuel) — l’app reste jouable.
- **AnyLyseur sans moteur :** statut `unavailable` déjà prévu.

---

## 5. POST-MIGRATION

Utile, **ne retarde pas** le 1er dev build.

- **Stockfish natif :** implémenter `createUciTransport` dans `lib/engines/stockfish/transport.ts` ; basculer `createOpponentEngine` / factory d’analyse. Point unique.
- **Share PGN :** `downloadPgnFile` no-op sans DOM ; `Share` / `expo-sharing` + `copyToClipboard` dans `GameExportPgnModal`.
- **`content://` :** si `fetch(uri)` échoue → `expo-file-system`.
- SQLite / fichiers répertoire (quota).
- `expo-av` → `expo-audio` (SFX seulement).
- LRU `AnalysisCache` / plafond `sessionAnalysisStore`.
- Virtualisation notation 300+ plies ; `React.memo` si jank mesuré.
- Persister l’éditeur parqué (RAM aujourd’hui).
- Bandeau « stockage illisible » (répertoire) avant qu’un CRUD n’écrase.
- iOS après Android.
- Notifications : **ne pas ouvrir**.

---

## 6. WEB-ONLY DEPENDENCIES

Pas des packages npm séparés : **APIs navigateur dans des helpers** (sauf fuites UI).

| API | Où | Métier contaminé ? | Native |
|---|---|---|---|
| `new Worker` + WASM `public/engine/` | `transport.web.ts`, `workerUrl.ts` | Non (Metro `.web.ts`) | Stub `transport.ts` |
| `<input type="file">`, `file.text()` | `pickPgnFile.ts`, `pickPgnFiles.ts` | Non (`Platform.OS`) | `expo-document-picker` |
| `Blob` / `createObjectURL` / `<a download>` | `lib/pgn/PgnExporter.ts` `downloadPgnFile` | Non, mais **appelé** depuis manage/annotate/Classic | no-op aujourd’hui |
| `navigator.clipboard` | `lib/clipboard.ts` ; **fuite** `GameExportPgnModal` | Modal Classique oui | `expo-clipboard` (après pin 8.x) |
| `window.confirm` | `confirmAction.ts` ; **fuite** `app/parties/index.tsx` | Écran bibliothèque | `Alert` déjà dans `confirmAction` |
| `getUserMedia` | `SpeechRecognitionService.ensureWebMicrophoneAccess` | Non (service) | `requestPermissionsAsync` |
| Web Speech | derrière `expo-speech-recognition` | Non | même module natif |
| `window` keydown | `useReaderKeyboard.ts` | UI Lecteur | no-op natif |
| `location.origin` | `workerUrl.ts` | Moteur web | N/A |
| localStorage | **uniquement** via AsyncStorage | Non (sauf `favoritesStore` AsyncStorage direct) | AsyncStorage natif |

**Aucune** dépendance cachée `localStorage` / `Worker` / `document` dans parsers, `parseChessVoice`, stores (hors favoris finales).

---

## 7. PLATFORM ABSTRACTIONS

| Domaine | État | Avant 1er build ? |
|---|---|---|
| **Moteur** | `ChessEngine` + factories + `transport.ts` / `.web.ts`. Natif = Random / unavailable. | **Ne pas** créer `EngineService`. |
| **Stockage** | `KeyValueStorage` OK. `GameLibraryStore` hors `loadStoredJson`. `favoritesStore` AsyncStorage brut. | Fix bibliothèque (section 3). Pas de SQLite. |
| **Fichiers** | Pick web/natif déjà splité. Export web-only. | Plugin picker. Share = post. |
| **Voix** | TTS = `speechService`. STT = service unique. Parse = pur. | Pin reco `sdk-54`. |
| **Audio** | `sfxService` (`expo-av`). `continue.tsx` appelle `Audio.setAudioModeAsync`. | Plugin `expo-av`. |
| **Partage** | Absent. | Après smoke. |
| **Confirm / clipboard** | Helpers existent ; 2 fuites UI. | Optionnel 15 min, pas un nouveau service. |
| **`PlatformService`** | **Ne pas créer.** | — |

Architecture cible déjà réelle :

```
UI → métier (chess.js, PGN, voice parse, stores)
   → ChessEngine | KeyValueStorage | speech* | pickPgn* | copyToClipboard | confirmAction
   → impl web (Worker, input, Blob) ou native (UCI plus tard, DocumentPicker, Alert)
```

---

## 8. TEST COVERAGE

- **Existant :** 114 fichiers `node:test` (`--experimental-strip-types`). Métier PGN, variantes, import light, session, stockage hygiène, moteurs mocks, voix parse, tactique, etc.
- **Pas :** RTL / E2E / hooks React / Expo Router.
- **Trous critiques avant build (ciblés, pas 100 %) :**
  1. `GameLibraryStore.getSnapshot` corrupt → **ne pas** persister le vide (aujourd’hui non testé comme wipe).
  2. Factory native Stockfish / `transport.ts` throw (déjà partiellement dans tests runtime).
  3. Quota `setItem` / persist bibliothèque.
- **Verts à exiger au gate :** suite `pnpm test` mobile (PGN/FEN/variantes/import/session/voix parse). Pas d’E2E appareil dans CI.

---

## 9. PERFORMANCE RISKS

**Critique mobile (plus tard, mesurable) :** caches d’analyse non bornés ; copie `gameNodes` à chaque nœud + re-render AnyLyseur / `parties/index` ; `JSON.stringify` arbre session (debounce 300 ms) ; undo éditeur JSON × 40 ; WASM 7 Mo + reboot worker à chaque focus Classique ; notation `ScrollView` 300 plies ; `puzzles.json` 1 Mo eager ; assets marque ~27 Mo.

**Déjà OK :** index PGN léger, parse sélectionné, cap 10/100 parties, `dispose()` AnyLyseur, destroy moteur au blur, debounce session.

**Avant 1er build :** ne pas optimiser. Compresser l’icône / adaptive (poids APK) = section 3, pas un LRU.

---

## 10. DATA / STORAGE RISKS

| Risque | Gravité | Gate |
|---|---|---|
| Bibliothèque : catch → vide → prochain save wipe | **Perte** | Fix section 3 |
| Répertoire corrupt : UI vide, octets gardés jusqu’au CRUD | Perte si l’utilisateur « recrée » | Bandeau post-APK acceptable |
| Session Lecteur : autosave catch vide | Perte exploration | Acceptable 1er build |
| Éditeur parqué RAM | Perte étude si kill process | Acceptable |
| Quota ~5 Mo web | Blob unique répertoire + library | Native AsyncStorage plus large ; rester KV |
| Schema app v0→v1 no-op ; v>CURRENT non touché | OK | — |
| `runStorageMigrations().catch(() => {})` | Silence si trou futur | Log later |
| Analyses Stockfish | RAM only, voulu | — |

Stratégie définie : **`loadStoredJson` = contrat** (fallback + quarantaine, pas d’overwrite). La bibliothèque doit **rejoindre** ce contrat avant un usage réel sur device.

---

## 11. DEPENDENCIES

**Ne pas** `npm update` / `expo upgrade`.

| Package | Action |
|---|---|
| `expo@54.0.35`, `react-native@0.81.5`, `react@19.1.0` | **Ne pas toucher** |
| `expo-clipboard` 57.0.1 | **Pin ~8.0.8** (blocker) |
| `expo-speech-recognition` 56.0.1 | **Tag sdk-54** (blocker) |
| `@react-native-community/slider` 5.2.0 | **Pin 5.0.1** (blocker) |
| `expo-dev-client` | **Ajouter ~6.0.21** (blocker) |
| location, image-picker, blur, glass, linear-gradient, symbols, web-browser, npm `stockfish` | **Retirer** |
| `expo-av` 16.0.8, `expo-speech` 14.0.8, `expo-document-picker` 14.0.8, async-storage 2.2.0, svg 15.12.1, router 6.0.24, reanimated 4.1.x, worklets 0.5.1 | **Garder** (bundled 54) |
| `chess.js` | **Garder** |
| `@tanstack/react-query`, `@workspace/api-client-react`, `zod` mobile | Morts ; **ne pas** nettoyer en urgence |
| Workspace `api-server` / mockup / drizzle | Hors APK |

`newArchEnabled: true` est **aligné** SDK 54 une fois le slider pinner.

---

## 12. DEV BUILD MIGRATION CHECKLIST

Ordre exact, **sans** Stockfish natif.

1. Pins B2–B4 + `expo-dev-client@~6.0.21` (`expo install` dans `artifacts/mobile` seulement).
2. `android.package` / `ios.bundleIdentifier` / `scheme` / `slug`.
3. Retirer packages natifs inutilisés + npm `stockfish` + plugin `expo-web-browser`.
4. Plugins : speech-recognition (déjà), `expo-av`, `expo-splash-screen`, `expo-document-picker`, `expo-dev-client`.
5. `adaptiveIcon` + splash dédié / icône compressée.
6. `GameLibraryStore` → `loadStoredJson` + persist après write.
7. Déplacer runtime `devDependencies` → `dependencies` (mêmes versions).
8. `eas.json` profil `development` ; `eas init`.
9. `pnpm test` (mobile) vert.
10. `eas build --profile development --platform android` **ou** `npx expo prebuild -p android` + `run:android`.
11. Installer l’APK ; `npx expo start --dev-client`.
12. Smoke appareil (section 13 Phase F).

---

## 13. RECOMMENDED EXECUTION ORDER

### Phase A — Fix critiques (compile + données)

1. Pins clipboard / reco / slider + `expo-dev-client`.
2. Identité `app.json` + plugins SFX/splash/picker + purge autolink.
3. `GameLibraryStore` load/persist sûrs.

### Phase B — Tests ciblés

4. Test : JSON bibliothèque corrompu → pas d’overwrite + quarantaine.
5. Relancer la suite existante (PGN, variantes, import light, session, voix parse). **Pas** de nouvelle pyramide de tests.

### Phase C — Isoler fuites web (optionnel, < 1 h, pas de nouvelles couches)

6. `parties/index` → `confirmAction`.
7. `GameExportPgnModal` → `copyToClipboard`.
8. `favoritesStore` → `KeyValueStorage`.

**Pas** de `PlatformService` / `ShareService` / `EngineService`.

### Phase D — Préparer Expo

9. `adaptiveIcon`, splash, `eas.json`, runtime en `dependencies`.
10. Vérifier `npx expo-doctor` (ou équivalent versions bundled 54).

### Phase E — Créer le dev build

11. EAS development Android (ou prebuild local).
12. Brancher Metro `--dev-client`.

### Phase F — Tests sur appareil réel

13. Boot, nav, AsyncStorage (reopen app).
14. TTS, micro (grant / deny), SFX, haptics, keypad, board.
15. Import PGN via picker natif (petit fichier).
16. Classique : coup joueur + **RandomEngine** (pas Stockfish).
17. AnyLyseur : UI « moteur indisponible », collage PGN/FEN invalide = message.
18. Permissions : **pas** de localisation / photos.

### Phase G — Après le 1er APK (hors gate)

19. `exportPgnToUser` (Share) si l’export est testé.
20. `FileSystem` si `fetch(uri)` casse.
21. **Stockfish natif** uniquement dans `transport.ts` + factories.
22. Perf (LRU analyse, notation) **si** mesure.

---

## 14. GO / NO-GO CONDITIONS

**GO** si **tous** les points suivants sont vrais :

- [ ] Aucun blocker B1–B4 ouvert (identité, clipboard 8.x, reco sdk-54, slider 5.0.1, dev-client).
- [ ] `expo-location` / `expo-image-picker` absents du binaire (pas de permission GPS/photos).
- [ ] `GameLibraryStore` ne persiste plus un snapshot vide sur JSON corrompu.
- [ ] `pnpm test` dans `artifacts/mobile` vert (PGN / FEN / variantes / import sélectionné / session / parse voix).
- [ ] Aucune API navigateur **dans le métier** (parsers, `parseChessVoice`, stores hors favoris — favoris = Phase C optionnelle).
- [ ] Moteur isolé : `ChessEngine` + `transport.ts` ; natif Random / unavailable **documenté**, pas un crash.
- [ ] Import : `pickPgn*` + parse string ; export web-only **accepté** pour le 1er build (share = Phase G).
- [ ] Stockage : KV AsyncStorage ; stratégie corrupt = `loadStoredJson` (bibliothèque alignée).
- [ ] Permissions identifiées : `RECORD_AUDIO` + queries speech, `VIBRATE`, `INTERNET` ; pas de localisation.
- [ ] Pas d’`expo upgrade` / pas de bump SDK 55+.

**NO-GO** si :

- un package Expo **hors** bundled 54 reste (clipboard 57, reco 56, slider 5.2) ;
- pas de `android.package` / pas de dev-client ;
- `getSnapshot` bibliothèque peut encore wipe au save ;
- la suite unit métier est rouge ;
- on conditionne le 1er build à Stockfish natif (ce n’est **pas** un critère GO).

---

## 15. FINAL CHECKLIST

Cocher **juste avant** de lancer pins + prebuild / EAS :

- [ ] Branche de travail dédiée (pas un `npm update` sur `main`).
- [ ] `bundledNativeModules.json` SDK 54 sous les yeux pour chaque `expo install`.
- [ ] B1–B4 + purge location/image-picker + `GameLibraryStore` planifiés **dans cet ordre**.
- [ ] Aucune nouvelle abstraction (`*Service` générique).
- [ ] Stockfish natif **hors** de cette PR.
- [ ] Share PGN / FileSystem / LRU **hors** de cette PR.
- [ ] Commande unique d’install : `expo install` des pins, pas `pnpm update`.
- [ ] Après build : smoke Phase F, y compris **refus micro** et **PGN invalide**.
- [ ] Si le smoke échoue : corriger le helper existant, ne pas « architecturer ».

---

**Synthèse GO :** AnyChess est **structurellement** prêt (métier découplé, contrats moteur/stockage/voix). Il n’est **pas** prêt à *compiler* un development build tant que B1–B4 et le wipe bibliothèque ne sont pas traités. Une fois ces items fermés, **GO** pour un APK de smoke — Stockfish native = Phase G, pas le gate.
