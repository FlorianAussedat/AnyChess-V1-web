# AnyChess — Guide de développement local (Windows)

## Emplacement du projet

```
C:\Users\marie\OneDrive\Bureau\AnyChess-V1-web
```

Le dossier est synchronisé via **OneDrive** (Bureau). Ne le déplacez pas sans mettre à jour ce guide.

## Prérequis

- **Node.js 24** — https://nodejs.org
- **pnpm** — `corepack enable` puis `corepack prepare pnpm@latest --activate`
- **Git** (recommandé) — https://git-scm.com/download/win

## Reprendre maintenant en local (intro splash 0.0.4)

Branche courante poussée sur GitHub : `cursor/anychess-intro-splash-975c`  
(base : `feature/WIP-Major-Update-0.0.4` — PR https://github.com/FlorianAussedat/AnyChess-V1-web/pull/5)

Dans **PowerShell** :

```powershell
cd "C:\Users\marie\OneDrive\Bureau\AnyChess-V1-web"
git fetch origin
git checkout cursor/anychess-intro-splash-975c
git pull origin cursor/anychess-intro-splash-975c
pnpm install --ignore-scripts
cd artifacts\mobile
pnpm exec expo start --web
```

Puis ouvrez **http://localhost:8081** et faites un hard refresh (Ctrl+Shift+R) pour voir l’intro.

Dans **Cursor Desktop** : File → Open Folder → `AnyChess-V1-web` (ce dossier). Travaillez hors Cloud Agent.

## Installation des dépendances

```powershell
cd "C:\Users\marie\OneDrive\Bureau\AnyChess-V1-web"
pnpm install --ignore-scripts
```

> Sous Windows, le script `preinstall` utilise `sh` (Unix). Utilisez `--ignore-scripts` pour éviter l'erreur.

## Lancer l'application (Échecs à l'oral)

```powershell
cd "C:\Users\marie\OneDrive\Bureau\AnyChess-V1-web\artifacts\mobile"
pnpm exec expo start --web
```

Puis ouvrez **http://localhost:8081** dans votre navigateur.

### Autres options Expo

- `pnpm exec expo start` — menu interactif (web, Android, iOS)
- Appuyez sur **w** pour ouvrir la version web
- Scannez le QR code avec **Expo Go** sur téléphone

## Structure du projet

| Dossier | Rôle |
|---------|------|
| `artifacts/mobile/` | App principale AnyChess (Expo / React Native) |
| `artifacts/api-server/` | API Express (nécessite PostgreSQL) |
| `artifacts/mockup-sandbox/` | Sandbox UI (Vite) |
| `lib/` | Bibliothèques partagées (API, DB, Zod) |

## Dépôt Git distant

Le projet est lié à GitHub :

```
https://github.com/FlorianAussedat/AnyChess-V1-web
```

### Sauvegarder vos modifications (après installation de Git)

```powershell
cd "C:\Users\marie\OneDrive\Bureau\AnyChess-V1-web"
git add .
git commit -m "Vos modifications"
git push -u origin HEAD
```

## Sauvegarde locale

Une copie de sauvegarde a été créée le 12/07/2026 :

```
C:\Users\marie\OneDrive\Bureau\AnyChess-V1-web-backup-2026-07-12
```

## Reprendre le développement dans Cursor (Desktop)

1. Ouvrir le dossier `AnyChess-V1-web` dans Cursor (**pas** un Cloud Agent)
2. `git fetch` + checkout de la branche voulue (voir section ci-dessus)
3. Installer les dépendances (`pnpm install --ignore-scripts`)
4. Lancer Expo (`pnpm exec expo start --web` dans `artifacts/mobile`)
5. Fichiers utiles :
   - `artifacts/mobile/app/_layout.tsx` — shell + intro splash
   - `artifacts/mobile/components/AnyChessSplashScreen.tsx` — intro de lancement
   - `artifacts/mobile/app/index.tsx` — Home / menu
   - `artifacts/mobile/contexts/GameContext.tsx` — logique de partie
   - `artifacts/mobile/components/ChessBoard.tsx` — échiquier
