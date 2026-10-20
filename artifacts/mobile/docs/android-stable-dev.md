# AnyChess Stable et AnyChess Dev

Deux applications s’installent côte à côte. `com.anychess.standalone` n’est pas reconstruit.

| | Stable | Dev |
|---|---|---|
| Nom | AnyChess | AnyChess Dev |
| Paquet | `com.anychess.app` | `com.anychess.dev` |
| `versionCode` actuel | 8 | 1 |
| Version affichée | 0.0.7 | 0.0.7 |
| Rôle | APK autonome, JavaScript embarqué | Expo Dev Client, Metro, Fast Refresh |
| Signature | clé release privée | certificat debug Expo, limité à ce paquet |
| Schéma | `mobile` | `anychessdev` et `exp+anychessdev` |
| Client d’authentification | `app` | `dev` |

Le `versionCode` 8 de Stable ne met pas à jour l’application déjà installée avec le certificat debug. Android refuse ce remplacement. L’ancienne application `com.anychess.app` reste en place tant qu’elle n’est pas retirée à la main. Aucune commande de cette configuration ne la désinstalle.

## Signature Stable

La clé est créée une seule fois par `node scripts/create-stable-release-keystore.mjs`. Si le fichier existe déjà et que son empreinte correspond à `signing/stable-release-cert.json`, le script le conserve. Il refuse d’en créer une autre.

Emplacements, tous hors de `android/` :

- Keystore : `artifacts/mobile/.signing/anychess-stable-release.jks`
- Mots de passe : `artifacts/mobile/.signing/release.env` (mode `0600`)
- Copie et sauvegarde chiffrée : `~/.anychess-release/`

`.signing/`, `*.jks` et `*.keystore` sont ignorés par git. Le dépôt ne reçoit que le SHA-256 public.

`node scripts/verify-release-keystore.mjs` avec `ANYCHESS_VARIANT=stable` refuse le certificat debug public et tout autre certificat. Le plugin `withReleaseSigning` exécute cette vérification avant d’écrire la configuration Gradle. Le dossier `android/` est régénéré par `expo prebuild` ; la clé n’y est pas rangée.

Pour EAS, importer ce même fichier. Une clé générée par EAS serait un autre certificat et ne pourrait plus mettre à jour Stable.

## Compilation locale

Depuis `artifacts/mobile`, avec le SDK Android disponible :

```bash
node scripts/build-android-apk.mjs stable
node scripts/build-android-apk.mjs development
```

Stable produit un APK release arm64. Dev produit un APK debug qui se connecte à Metro :

```bash
ANYCHESS_VARIANT=development pnpm exec expo start --dev-client
```

## Confirmation de compte

Le code ouvre `com.anychess.dev` pour `client=dev`, `com.anychess.app` pour `client=app`, et `com.anychess.standalone` pour toute autre valeur. `site/auth/confirm.html` suit ce code. La page déjà en ligne sur Netlify et la fonction Supabase déployée ne changent pas tant qu’un déploiement n’est pas demandé.
