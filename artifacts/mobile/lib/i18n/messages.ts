/**
 * Lightweight UI string dictionaries (FR / EN).
 * Chess notation is independent — see lib/chess/notation.ts.
 */
import type { AppLanguage } from '../preferences/types.ts';

export type MessageKey =
  | 'nav.home'
  | 'nav.records'
  | 'nav.profil'
  | 'profil.title'
  | 'profil.localData'
  | 'profil.sectionProfile'
  | 'profil.sectionMyData'
  | 'profil.sectionPreferences'
  | 'profil.sectionSave'
  | 'profil.username'
  | 'profil.usernamePlaceholder'
  | 'profil.rapid'
  | 'profil.blitz'
  | 'profil.bullet'
  | 'profil.years'
  | 'profil.pseudoUnset'
  | 'profil.repertoires'
  | 'profil.repertoiresNone'
  | 'profil.records'
  | 'profil.recordsSee'
  | 'profil.language'
  | 'profil.notation'
  | 'profil.notationFr'
  | 'profil.notationEn'
  | 'profil.voice'
  | 'profil.coordinates'
  | 'profil.voiceSpeed'
  | 'profil.saveTitle'
  | 'profil.saveBody'
  | 'profil.saveSoon'
  | 'profil.resetPrefs'
  | 'profil.resetPrefsTitle'
  | 'profil.resetPrefsBody'
  | 'profil.resetRecords'
  | 'profil.resetRecordsTitle'
  | 'profil.resetRecordsBody'
  | 'profil.cancel'
  | 'profil.reset'
  | 'profil.erase'
  | 'profil.save'
  | 'profil.close'
  | 'profil.langFr'
  | 'profil.langEn'
  | 'modes.classic.title'
  | 'modes.classic.description'
  | 'modes.openings.title'
  | 'modes.openings.description'
  | 'modes.blind.title'
  | 'modes.blind.description'
  | 'modes.puzzles.title'
  | 'modes.puzzles.description'
  | 'modes.visualisation.title'
  | 'modes.visualisation.description'
  | 'modes.quiz-ouverture.title'
  | 'modes.quiz-ouverture.description'
  | 'game.movesPlayed'
  | 'game.exportPgn'
  | 'game.export'
  | 'keypad.a11y'
  | 'keypad.clear'
  | 'keypad.show'
  | 'keypad.hide'
  | 'keypad.systemOn'
  | 'keypad.systemOff';

const fr: Record<MessageKey, string> = {
  'nav.home': 'Accueil',
  'nav.records': 'Records',
  'nav.profil': 'Profil',
  'profil.title': 'Profil',
  'profil.localData': 'Données locales — aucun compte requis',
  'profil.sectionProfile': 'PROFIL',
  'profil.sectionMyData': 'MES DONNÉES',
  'profil.sectionPreferences': 'PRÉFÉRENCES',
  'profil.sectionSave': 'SAUVEGARDE',
  'profil.username': 'Pseudo',
  'profil.usernamePlaceholder': 'Ton pseudo',
  'profil.rapid': 'Niveau Rapide',
  'profil.blitz': 'Niveau Blitz',
  'profil.bullet': 'Niveau Bullet',
  'profil.years': 'Années de pratique',
  'profil.pseudoUnset': 'Pseudo non renseigné',
  'profil.repertoires': 'Répertoires PGN',
  'profil.repertoiresNone': 'Aucun',
  'profil.records': 'Records',
  'profil.recordsSee': 'Voir mes records',
  'profil.language': 'Langue de l’application',
  'profil.notation': 'Notation des coups',
  'profil.notationFr': 'Française',
  'profil.notationEn': 'English / Internationale',
  'profil.voice': 'Voix / son',
  'profil.coordinates': 'Coordonnées',
  'profil.voiceSpeed': 'Vitesse de la voix',
  'profil.saveTitle': 'Données enregistrées sur cet appareil',
  'profil.saveBody':
    'Profil, répertoires PGN, records et préférences restent locaux. Aucun compte ni cloud pour le moment.',
  'profil.saveSoon': 'Synchronisation multi-appareils — bientôt disponible',
  'profil.resetPrefs': 'Réinitialiser les préférences',
  'profil.resetPrefsTitle': 'Réinitialiser les préférences ?',
  'profil.resetPrefsBody':
    'Langue, notation, voix, coordonnées et vitesse de la voix reviendront aux valeurs par défaut.',
  'profil.resetRecords': 'Réinitialiser les records',
  'profil.resetRecordsTitle': 'Réinitialiser les records ?',
  'profil.resetRecordsBody':
    'Tous les records (Tactiques, Nommer, Jouer, Mémorisation) seront effacés sur cet appareil.',
  'profil.cancel': 'Annuler',
  'profil.reset': 'Réinitialiser',
  'profil.erase': 'Effacer',
  'profil.save': 'Enregistrer',
  'profil.close': 'Fermer',
  'profil.langFr': 'Français',
  'profil.langEn': 'English',
  'modes.classic.title': 'Partie classique',
  'modes.classic.description':
    'Joue une partie, tout simplement ! À la voix ou directement sur l’échiquier.',
  'modes.openings.title': 'Apprends tes ouvertures',
  'modes.openings.description':
    'Apprends et révise tes répertoires d’ouvertures, coup après coup.',
  'modes.blind.title': 'Mémorisation',
  'modes.blind.description':
    'Entraîne-toi à retenir des séquences de coups, à l’écoute ou en les observant.',
  'modes.puzzles.title': 'Entraînement tactique',
  'modes.puzzles.description':
    'Résous des positions tactiques, avec ou sans échiquier visible.',
  'modes.visualisation.title': 'Vision de l’échiquier',
  'modes.visualisation.description':
    'Entraîne-toi à suivre une position mentalement et à reconnaître rapidement les coups.',
  'modes.quiz-ouverture.title': 'Culture générale',
  'modes.quiz-ouverture.description':
    'Teste tes connaissances sur les ouvertures et la culture échiquéenne.',
  'game.movesPlayed': 'Coups joués',
  'game.exportPgn': 'Exporter en PGN',
  'game.export': 'Exporter',
  'keypad.a11y': 'Clavier coups d’échecs',
  'keypad.clear': 'Eff',
  'keypad.show': 'Afficher le clavier coups d’échecs',
  'keypad.hide': 'Masquer le clavier coups d’échecs',
  'keypad.systemOn': 'Revenir au clavier coups d’échecs',
  'keypad.systemOff': 'Utiliser le clavier système',
};

const en: Record<MessageKey, string> = {
  'nav.home': 'Home',
  'nav.records': 'Records',
  'nav.profil': 'Profile',
  'profil.title': 'Profile',
  'profil.localData': 'Local data — no account required',
  'profil.sectionProfile': 'PROFILE',
  'profil.sectionMyData': 'MY DATA',
  'profil.sectionPreferences': 'PREFERENCES',
  'profil.sectionSave': 'BACKUP',
  'profil.username': 'Username',
  'profil.usernamePlaceholder': 'Your username',
  'profil.rapid': 'Rapid level',
  'profil.blitz': 'Blitz level',
  'profil.bullet': 'Bullet level',
  'profil.years': 'Years of practice',
  'profil.pseudoUnset': 'Username not set',
  'profil.repertoires': 'PGN repertoires',
  'profil.repertoiresNone': 'None',
  'profil.records': 'Records',
  'profil.recordsSee': 'View my records',
  'profil.language': 'App language',
  'profil.notation': 'Move notation',
  'profil.notationFr': 'French',
  'profil.notationEn': 'English / International',
  'profil.voice': 'Voice / sound',
  'profil.coordinates': 'Coordinates',
  'profil.voiceSpeed': 'Voice speed',
  'profil.saveTitle': 'Data saved on this device',
  'profil.saveBody':
    'Profile, PGN repertoires, records and preferences stay local. No account or cloud for now.',
  'profil.saveSoon': 'Multi-device sync — coming soon',
  'profil.resetPrefs': 'Reset preferences',
  'profil.resetPrefsTitle': 'Reset preferences?',
  'profil.resetPrefsBody':
    'Language, notation, voice, coordinates and voice speed will return to defaults.',
  'profil.resetRecords': 'Reset records',
  'profil.resetRecordsTitle': 'Reset records?',
  'profil.resetRecordsBody':
    'All records (Tactics, Name the move, Play the move, Memorization) will be cleared on this device.',
  'profil.cancel': 'Cancel',
  'profil.reset': 'Reset',
  'profil.erase': 'Clear',
  'profil.save': 'Save',
  'profil.close': 'Close',
  'profil.langFr': 'Français',
  'profil.langEn': 'English',
  'modes.classic.title': 'Classic game',
  'modes.classic.description':
    'Just play a game — by voice or directly on the board.',
  'modes.openings.title': 'Learn your openings',
  'modes.openings.description':
    'Learn and revise your opening repertoires, move by move.',
  'modes.blind.title': 'Memorization',
  'modes.blind.description':
    'Train to remember move sequences by listening or watching.',
  'modes.puzzles.title': 'Tactical training',
  'modes.puzzles.description':
    'Solve tactical positions, with or without a visible board.',
  'modes.visualisation.title': 'Board vision',
  'modes.visualisation.description':
    'Train to follow a position mentally and recognize moves quickly.',
  'modes.quiz-ouverture.title': 'General knowledge',
  'modes.quiz-ouverture.description':
    'Test your knowledge of openings and chess culture.',
  'game.movesPlayed': 'Moves played',
  'game.exportPgn': 'Export PGN',
  'game.export': 'Export',
  'keypad.a11y': 'Chess move keypad',
  'keypad.clear': 'Clr',
  'keypad.show': 'Show chess move keypad',
  'keypad.hide': 'Hide chess move keypad',
  'keypad.systemOn': 'Return to chess move keypad',
  'keypad.systemOff': 'Use system keyboard',
};

const DICTS: Record<AppLanguage, Record<MessageKey, string>> = { fr, en };

export function translate(language: AppLanguage, key: MessageKey): string {
  return DICTS[language][key] ?? DICTS.fr[key] ?? key;
}

export function speechLocaleForLanguage(language: AppLanguage): string {
  return language === 'en' ? 'en-US' : 'fr-FR';
}
