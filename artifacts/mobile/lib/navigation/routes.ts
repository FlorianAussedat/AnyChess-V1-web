import type { Href } from 'expo-router';

/** Navigation policy only: no account, activity, or persistence mutations. */
export const MAIN_ROUTES = ['/', '/records', '/utilisateur', '/parametres'] as const;
export type MainRoute = (typeof MAIN_ROUTES)[number];
export type BottomNavTabId = 'home' | 'records' | 'utilisateur' | 'parametres';

export function resolveActiveTab(pathname: string): BottomNavTabId | null {
  switch (pathname) {
    case '/': case '/index': return 'home';
    case '/records': return 'records';
    case '/utilisateur': return 'utilisateur';
    case '/parametres': return 'parametres';
    default: return null;
  }
}

export function showMainNavigation(pathname: string, introDone: boolean): boolean {
  return introDone && resolveActiveTab(pathname) !== null;
}

/** A direct link has no previous screen: return to the nearest selection hub. */
export function backFallback(pathname: string): string {
  if (pathname === '/creer-compte' || pathname === '/profil') return '/utilisateur';
  if (pathname === '/openings/annotate') return '/openings/manage';
  if (/^\/openings\/[^/]+$/.test(pathname) &&
      !['/openings/manage', '/openings/import', '/openings/learn', '/openings/play',
        '/openings/review', '/openings/continue', '/openings/study'].includes(pathname)) {
    return '/openings/learn';
  }
  if (pathname.startsWith('/puzzles/defends-nulle-')) return '/puzzles/defends-nulle';
  if (pathname === '/puzzles/finales-theoriques-play') return '/puzzles/finales-theoriques';
  for (const hub of ['/openings', '/parties', '/puzzles', '/visualisation', '/quiz-ouverture']) {
    if (pathname.startsWith(`${hub}/`)) return hub;
  }
  return '/';
}

type BackRouter = { canGoBack(): boolean; back(): void; replace(path: Href): void };

export function backToPrevious(router: BackRouter, pathname: string, fallback?: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback ?? backFallback(pathname) as Href);
}

type TabRouter = { replace(path: Href): void };

/** Main screens are peers. Replacing the current peer keeps repeated taps bounded. */
export function navigateMainTab(router: TabRouter, pathname: string, target: MainRoute): void {
  const current = pathname === '/index' ? '/' : pathname;
  if (current !== target) router.replace(target as Href);
}
