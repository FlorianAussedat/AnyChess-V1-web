/** French names shown to users; unknown ECO names remain valid in English. */
const aliases: Record<string, string[]> = {
  'Italian Game': ['Partie italienne', 'Italienne'],
  'Italian Game: Giuoco Piano': ['Giuoco Piano', 'Italienne Giuoco Piano'],
  'Sicilian Defense': ['Défense sicilienne', 'Sicilienne'],
  'Sicilian Defense: Accelerated Dragon': ['Dragon accéléré', 'Sicilienne dragon accéléré'],
  'Ruy Lopez': ['Partie espagnole', 'Espagnole'],
  'French Defense': ['Défense française', 'Française'],
  'Queen’s Gambit Declined': ['Gambit dame refusé'],
};

export class OpeningAliasRepository {
  aliasesFor(canonicalName: string): string[] {
    return [canonicalName, ...(aliases[canonicalName] ?? [])];
  }
}

export const openingAliasRepository = new OpeningAliasRepository();
