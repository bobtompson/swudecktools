// Shapes returned by the SWUDB deck API (https://www.swudb.com/api/deck/{id}).
// Only the fields we consume are typed; the payload carries more.

export interface RawCard {
  cardId: number;
  cardName: string;
  title?: string | null;
  cost?: number | null;
  aspects?: number[];
  frontsideAspects?: number[];
  backsideAspects?: number[];
  type?: number | null;
  arena?: number | null;
  alternativeDeckMaximum?: number | null;
  defaultImagePath?: string;
  defaultExpansionAbbreviation?: string;
  defaultCardNumber?: string | number;
  defaultRarity?: number;
}

export interface RawDeckEntry {
  count?: number;
  sideboardCount?: number;
  card?: RawCard;
}

export interface RawDeck {
  deckId?: string;
  deckName?: string;
  authorName?: string;
  deckFormat?: number; // 1 = Premier-style, 2 = Twin Suns
  leader?: RawCard | null;
  secondLeader?: RawCard | null;
  base?: RawCard | null;
  shuffledDeck?: RawDeckEntry[];
}

// Normalized internal shapes used by sort/validate.

export interface DeckCard {
  card: RawCard;
  quantity: number;
  cardId: number | undefined;
  name: string;
  set: string;
  number: string; // zero-padded to 3
}

export interface NormalizedDeck {
  title: string;
  author: string;
  url: string;
  formatCode: number | undefined;
  leaders: RawCard[];
  base: RawCard | null;
  mainboard: DeckCard[];
  sideboard: DeckCard[];
}

// Set legality catalog entry (https://api.swu-db.com/sets).
export interface SetInfo {
  setId: string;
  fullName?: string;
  parentSetId?: string | null;
  releaseDate?: string; // "M/D/YY"
  numberCards?: number;
}
