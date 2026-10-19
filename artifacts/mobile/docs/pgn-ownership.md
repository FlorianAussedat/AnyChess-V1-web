# Propriété des PGN (0.0.7)

Les études d’ouvertures appartiennent à un compte AnyChess. L’application n’embarque aucun fichier `.pgn` personnel et n’en crée pas à l’installation.

## Mode invité

Sans session, la bibliothèque affichée est vide. Les écrans Ouvertures proposent de se connecter ou de créer un compte. La création, l’import, la modification et l’enregistrement d’une étude sont refusés (`PersonalPgnAccessError`).

Les études déjà présentes sur l’appareil avant cette règle sont copiées dans le coffre local `anychess.cloud.guestPgnVault.v1`, puis retirées de la bibliothèque active. Ce coffre n’est pas un document synchronisé et n’est pas effacé automatiquement.

## Compte

Chaque compte a son cache `anychess.cloud.workspace.<id>.v1`. La déconnexion masque tout de suite la bibliothèque : les études du compte quittent le document actif et restent dans ce cache. Un autre compte, ou l’invité, ne les lit pas et ne les envoie pas.

La connexion charge le cache de ce compte, puis le fusionne avec les documents Supabase de cet utilisateur seulement. Une réinstallation vide, suivie de la même connexion, retrouve les études déjà présentes dans Supabase.

Un chargement déjà commencé au moment du changement de compte est abandonné. Il ne réécrit pas les études de l’ancien propriétaire dans le document actif.

## Migration des études invitées

Elle ne démarre pas toute seule. L’utilisateur confirme « Importer les données invitées ».

Avant toute écriture :

1. L’application interroge Supabase et enregistre le constat dans `anychess.cloud.pgnPresence.v1` (identifiant du compte, études distantes, études du coffre, horodatage).
2. Si Supabase ne répond pas, rien n’est copié et rien n’est supprimé.
3. Si la fusion prévue perdrait une étude du coffre, l’import est refusé.
4. Les études ne sont écrites dans le compte local qu’après que Supabase a renvoyé chacun de leurs identifiants.
5. Le coffre invité est conservé même après une copie confirmée.

Aucune étude n’est supprimée sans une confirmation explicite dans l’interface (suppression d’un fichier, ou conservation du contenu lors de la suppression d’un dossier).
