import { Redirect } from 'expo-router';

/** Published confirmation button: host `open` has no other screen. */
export default function OpenAccountReturn() {
  return <Redirect href="/utilisateur" />;
}
