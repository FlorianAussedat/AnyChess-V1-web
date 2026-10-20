# Signature de l’application autonome

L’application déjà installée sous `com.anychess.standalone` (APK `AnyChess-standalone-release.apk`, version affichée 0.0.6, `versionCode` 1) ne peut être mise à jour que par un APK du même paquet, signé avec le même certificat, et portant un `versionCode` supérieur à 1. Le code source prévoit déjà `versionCode` 2 pour cette variante.

## Certificat public attendu

| | |
|---|---|
| Paquet | `com.anychess.standalone` |
| SHA-256 | `CB:DF:1C:90:EE:FA:B0:91:80:BE:47:73:90:F9:99:06:24:1A:AE:DE:1F:48:96:2A:B8:E9:41:6A:FD:4C:E7:AA` |
| SHA-1 | `05:E8:E5:CC:40:5D:41:69:82:30:FC:7D:4E:63:72:3E:E9:EC:FB:55` |
| Sujet | `CN=AnyChess, OU=AnyChess, O=AnyChess, L=Unknown, ST=Unknown, C=FR` |
| SHA-256 du fichier APK V0.0.6 | `3fd60686ecb51f75e58c7025a0ebf2637d103a35405028c593456b0f04cae4bd` |

Ces empreintes sont enregistrées dans `signing/standalone-release-cert.json`. Ce fichier contient le certificat public. Il ne contient pas la clé privée.

Avant d’installer une future mise à jour, l’empreinte de l’application présente sur le téléphone doit être la même. Sur un appareil branché :

```bash
adb shell pm path com.anychess.standalone
adb pull <chemin-apk> /tmp/installed.apk
apksigner verify --print-certs /tmp/installed.apk
```

On compare uniquement le SHA-256.

## Le keystore d’origine n’est pas dans cet environnement

La recherche locale n’a trouvé que les keystores de debug du modèle Expo (`android/app/debug.keystore`). Leur SHA-256 est `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`. Ce certificat signe `com.anychess.app`. Il ne met pas à jour `com.anychess.standalone`.

Aucun fichier `.jks` de release n’est dans le dépôt, dans l’historique git, ni sur la machine de build. Les secrets GitHub Actions de ce dépôt ne sont pas lisibles depuis ici (HTTP 403). La clé privée ne se reconstruit pas à partir de l’APK ni du certificat public.

Aucun APK autonome V0.0.7 n’est donc produit. Le fichier déjà publié `AnyChess-V0.0.7.apk` reste une mise à jour de `com.anychess.app` seulement.

## Fournir le keystore d’origine

Le fichier `.jks` reste hors du dépôt git. Les mots de passe restent hors du dépôt. Deux endroits acceptés :

- les variables `ANYCHESS_RELEASE_STORE_FILE`, `ANYCHESS_RELEASE_STORE_PASSWORD`, `ANYCHESS_RELEASE_KEY_ALIAS`, `ANYCHESS_RELEASE_KEY_PASSWORD` ;
- ou le fichier gitignoré `artifacts/mobile/.signing/release.env` (mode `0600`), dont le modèle est `signing/release.env.example`.

Vérification, avant tout build autonome :

```bash
node scripts/verify-release-keystore.mjs
```

La commande affiche l’empreinte attendue et le résultat. Elle n’affiche pas les mots de passe. Le plugin `plugins/withReleaseSigning.js` exécute cette vérification dès que `ANYCHESS_VARIANT=standalone`. Un certificat différent arrête la compilation. Un keystore neuf est refusé : le test `verifyReleaseKeystore` en génère un temporaire et constate l’écart.

Le keystore de debug et le paquet `com.anychess.app` ne passent pas par cette vérification. Leur mise à jour continue avec la clé debug déjà installée.

## Copie durable

La mémoire de Cursor ne conserve pas une clé privée. Pour qu’une prochaine version puisse encore mettre à jour le même téléphone :

1. Conserver le `.jks` d’origine dans un coffre (gestionnaire de mots de passe, disque chiffré, ou secrets EAS / GitHub Actions) et une seconde copie chiffrée hors ligne.
2. Conserver les mots de passe dans ce coffre, séparés du fichier si le coffre le permet.
3. Au moment du build, les déposer dans `.signing/release.env` ou dans l’environnement, puis lancer la vérification ci-dessus.
4. Si un jour le fichier est importé dans EAS, importer cette clé existante. La génération d’une nouvelle clé EAS produirait un autre certificat et ne mettrait pas à jour l’application installée.

`.gitignore` ignore `*.jks`, `*.keystore` et `.signing/`.

## Si le keystore reste introuvable

L’application `com.anychess.standalone` reste installée. Ses études, commentaires et sa progression restent dans son stockage privé.

Depuis cette application : se connecter au compte si l’écran le permet, attendre l’état synchronisé, et exporter les PGN importants. L’export contient le texte et les commentaires. Les statistiques suivent le compte, pas le fichier PGN.

Une nouvelle signature, même avec le même paquet, ne s’installe pas par-dessus l’application actuelle. La désinstallation efface ce stockage privé. Elle n’est pas une étape de migration. `adb backup` n’est pas une sauvegarde fiable sur un Pixel récent.

Une application signée avec une nouvelle clé peut exister à côté, sous un autre paquet, seulement après avoir vérifié que les études voulues sont sur le compte ou dans les exports. Les études locales ne sont pas supprimées pour cela.

## Configuration Supabase des prochains builds

L’APK V0.0.6 contenait déjà l’URL publique `https://zqfxnzwtptepulmgpxhb.supabase.co` et la clé client `anon` de ce projet. `scripts/ensure-supabase-public-env.mjs` l’accepte quand `.env` et le jeton de gestion sont absents ou refusés. Le rôle `service_role` est rejeté. La clé est écrite dans `artifacts/mobile/.env`, gitignoré, en mode `0600`. Le 20 octobre 2026, `GET /auth/v1/settings` avec cette clé a répondu HTTP 200.

L’APK `AnyChess-V0.0.7.apk` déjà publié a été compilé avant ce rétablissement : il n’embarque pas cette clé. Le prochain build, autonome ou de développement, la prendra au moment du bundle.
