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
git push origin main
```

## Sauvegarde locale

Une copie de sauvegarde a été créée le 12/07/2026 :

```
C:\Users\marie\OneDrive\Bureau\AnyChess-V1-web-backup-2026-07-12
```

## Reprendre le développement dans Cursor

1. Ouvrir le dossier `AnyChess-V1-web` dans Cursor
2. Installer les dépendances (`pnpm install --ignore-scripts`)
3. Lancer Expo (`pnpm exec expo start --web` dans `artifacts/mobile`)
4. Modifier les fichiers principaux :
   - `artifacts/mobile/app/(tabs)/index.tsx` — écran de jeu
   - `artifacts/mobile/contexts/GameContext.tsx` — logique de partie
   - `artifacts/mobile/components/ChessBoard.tsx` — échiquier
