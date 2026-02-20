// === Types partagés pour le catalogue de livres ===

/** Un auteur de la base de données */
export interface Author {
  id: number;
  name: string;
  bio: string;
  nationality: string;
}

/** Un livre avec la référence vers son auteur */
export interface Book {
  id: number;
  title: string;
  year: number;
  genre: string;
  author_id: number;
}

/** Un livre enrichi avec les données de son auteur et ses reviews */
export interface BookWithRelations extends Book {
  author?: Author;
  reviews?: Review[];
  averageRating?: number;
}

/** Une review / critique de livre */
export interface Review {
  id: number;
  book_id: number;
  reviewer: string;
  text: string;
  rating: number;
}

/** Résultat d'un benchmark */
export interface BenchmarkResult {
  scenario: string;
  api: 'REST' | 'GraphQL' | 'GraphQL+DataLoader' | 'SOAP';
  avgLatencyMs: number;
  httpRequests: number;
  sqlQueries: number;
  responsePayloadBytes: number;
}
