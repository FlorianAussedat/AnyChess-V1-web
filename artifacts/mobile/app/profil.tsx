/**
 * Profil redirect — identity lives in Utilisateur, prefs in Paramètres.
 */
import { Redirect } from 'expo-router';

export default function ProfilRedirect() {
  return <Redirect href="/utilisateur" />;
}
