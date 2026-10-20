# APK autonome AnyChess V0.0.7

Build de test pour Pixel 8 Pro (arm64). Ce n’est pas une release définitive et la branche n’est pas fusionnée dans `main`.

## Ne pas utiliser ce fichier pour l’application autonome

`AnyChess-V0.0.7.apk` met à jour `com.anychess.app` (AnyChess Dev). Il ne remplace pas `com.anychess.standalone`.

Le keystore de release de l’application autonome n’est pas dans le dépôt, ni dans cet environnement. Aucun APK `com.anychess.standalone` ne doit être produit avec une autre signature : Android refuserait la mise à jour, et une désinstallation effacerait les études. Le `versionCode` autonome prévu dans le code est 2 (il a d’abord été 1). Une mise à jour compatible devra être signée avec le keystore d’origine et porter un `versionCode` strictement supérieur à celui installé.

## Identité du binaire

| | |
|---|---|
| Fichier | `AnyChess-V0.0.7.apk` |
| Nom affiché | AnyChess |
| Version Android | `0.0.7` (`versionCode` 5) |
| Paquet | `com.anychess.app` |
| ABI | `arm64-v8a` seulement |
| Signature | clé debug du modèle Expo / React Native |
| SHA-1 | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| SHA-256 | `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C` |

Le paquet n’a pas été changé : c’est celui de l’application déjà installée sous le nom de développement. Le JavaScript et les ressources sont dans l’APK. Metro, Expo Go et Cursor ne sont pas nécessaires. Stockfish 19 arm64 est inclus (`libstockfish.so`). Aucun fichier `.pgn` personnel n’est dans l’APK.

L’écran d’accueil et Paramètres affichent `AnyChess V0.0.7`. Les informations Android affichent la version `0.0.7`.

## Mise à jour et données

Android n’accepte la mise à jour que si le certificat ci-dessus est celui de l’application déjà installée **et** que son `versionCode` est inférieur à 5.

Les builds locaux `assembleDebug` du client de développement utilisent ce certificat. Dans ce cas, installer cet APK remplace l’application sans désinstallation et conserve AsyncStorage : études, statistiques, progression, réglages.

Ne désinstalle pas l’application actuelle.

- Si Android refuse l’installation à cause de la signature, les données restent dans l’ancienne application. Il ne faut pas la désinstaller pour « faire de la place ».
- L’autre paquet `com.anychess.standalone` n’est pas celui de cet APK. S’il est installé à côté, ses données ne sont pas copiées ici. Aucun keystore de release n’était disponible pour le mettre à jour.
- Ce build n’a pas pu embarquer la clé publique Supabase : le jeton de gestion présent dans l’environnement a été refusé (HTTP 401). La connexion au compte est donc indisponible dans cet APK. Le verrou « bibliothèque vide sans compte » ne s’applique pas tant que le client n’est pas configuré : les études déjà sur l’appareil restent lisibles et modifiables, et elles ne sont pas déplacées dans le coffre. La synchronisation reviendra dans un prochain APK qui contiendra la clé publique.

## Installation sur le Pixel 8 Pro

1. Garde une copie de `AnyChess-V0.0.7.apk` hors du téléphone (ordinateur ou Drive).
2. Ne désinstalle pas AnyChess.
3. Copie l’APK sur le téléphone et ouvre-le. Autorise l’installation depuis cette source si Android le demande.
4. Si l’écran dit que l’application n’a pas été installée, ou que la signature ne correspond pas, arrête-toi. L’ancienne application et ses données sont intactes.
5. Ouvre AnyChess. Le nom est AnyChess, plus « AnyChess Dev ». Paramètres doit afficher `AnyChess V0.0.7`.
6. Vérifie que les études déjà présentes s’ouvrent, qu’un dossier se replie, et qu’une partie contre Stockfish démarre sans ordinateur. Ferme le téléphone, rallume-le, rouvre l’application.

Aucun essai sur un Pixel réel n’a été fait depuis la machine qui a compilé cet APK. Les tests automatiques du dépôt ont été exécutés ; ils ne remplacent pas cet essai.

## Contenu fonctionnel

Arborescence des ouvertures (dossiers et sous-dossiers), import et ouverture des PGN locaux, apprentissage, révision, AnyLyseur, Stockfish, entraînements déjà présents dans la branche `major-update/0.0.7`. La synchronisation Supabase n’est pas active dans ce fichier.
