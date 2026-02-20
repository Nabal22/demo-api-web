import * as soap from 'soap';
import type { BenchmarkResult } from '../../shared/types';

// === URLs des serveurs ===
const REST_URL = 'http://localhost:3001';
const GRAPHQL_URL = 'http://localhost:3002';
const GRAPHQL_ADMIN_URL = 'http://localhost:3012';
const SOAP_URL = 'http://localhost:3003';
const SOAP_WSDL = `${SOAP_URL}/wsdl`;

// === Helpers ===

/** Reset le compteur SQL d'un serveur via son endpoint admin */
async function resetSqlCounter(adminUrl: string): Promise<void> {
  await fetch(`${adminUrl}/admin/reset-sql-counter`, { method: 'POST' });
}

/** Lit le compteur SQL d'un serveur */
async function getSqlCount(adminUrl: string): Promise<number> {
  const res = await fetch(`${adminUrl}/admin/sql-count`);
  const data = await res.json() as { count: number };
  return data.count;
}

/** Exécute une requête GraphQL et retourne la réponse brute */
async function graphqlQuery(
  query: string,
  variables: Record<string, unknown> = {},
  useDataLoader: boolean = false
): Promise<Response> {
  return fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Use-Dataloader': useDataLoader ? 'true' : 'false',
      'X-Reset-Sql-Counter': 'false',
    },
    body: JSON.stringify({ query, variables }),
  });
}

/** Crée un client SOAP (mis en cache) */
let soapClient: any = null;
async function getSoapClient(): Promise<any> {
  if (!soapClient) {
    soapClient = await soap.createClientAsync(SOAP_WSDL);
  }
  return soapClient;
}

// =================================================================
// Scénario 1 : Requête simple — récupérer un livre par ID
// =================================================================

/** REST : un seul GET */
async function scenario1_REST(): Promise<{ httpRequests: number; totalBytes: number }> {
  const res = await fetch(`${REST_URL}/books/1`);
  const body = await res.text();
  return { httpRequests: 1, totalBytes: Buffer.byteLength(body) };
}

/** GraphQL : une seule query avec champs de base */
async function scenario1_GraphQL(useDataLoader: boolean): Promise<{ httpRequests: number; totalBytes: number }> {
  const res = await graphqlQuery(
    `query { book(id: "1") { id title year genre } }`,
    {},
    useDataLoader
  );
  const body = await res.text();
  return { httpRequests: 1, totalBytes: Buffer.byteLength(body) };
}

/** SOAP : GetBook */
async function scenario1_SOAP(): Promise<{ httpRequests: number; totalBytes: number }> {
  const client = await getSoapClient();
  const [result, rawResponse] = await client.GetBookAsync({ id: 1 });
  const body = typeof rawResponse === 'string' ? rawResponse : JSON.stringify(result);
  return { httpRequests: 1, totalBytes: Buffer.byteLength(body) };
}

// =================================================================
// Scénario 2 : Données liées — livre + auteur + reviews
// =================================================================

/** REST : 3 requêtes séquentielles */
async function scenario2_REST(): Promise<{ httpRequests: number; totalBytes: number }> {
  let totalBytes = 0;

  // 1. Récupérer le livre
  const bookRes = await fetch(`${REST_URL}/books/1`);
  const bookText = await bookRes.text();
  totalBytes += Buffer.byteLength(bookText);
  const book = JSON.parse(bookText);

  // 2. Récupérer l'auteur
  const authorRes = await fetch(`${REST_URL}/authors/${book.author_id}`);
  const authorText = await authorRes.text();
  totalBytes += Buffer.byteLength(authorText);

  // 3. Récupérer les reviews
  const reviewsRes = await fetch(`${REST_URL}/books/1/reviews`);
  const reviewsText = await reviewsRes.text();
  totalBytes += Buffer.byteLength(reviewsText);

  return { httpRequests: 3, totalBytes };
}

/** GraphQL : une seule query imbriquée */
async function scenario2_GraphQL(useDataLoader: boolean): Promise<{ httpRequests: number; totalBytes: number }> {
  const res = await graphqlQuery(
    `query {
      book(id: "1") {
        id title year genre
        author { id name bio nationality }
        reviews { id reviewer text rating }
      }
    }`,
    {},
    useDataLoader
  );
  const body = await res.text();
  return { httpRequests: 1, totalBytes: Buffer.byteLength(body) };
}

/** SOAP : GetBook retourne tout d'un coup */
async function scenario2_SOAP(): Promise<{ httpRequests: number; totalBytes: number }> {
  const client = await getSoapClient();
  const [result, rawResponse] = await client.GetBookAsync({ id: 1 });
  const body = typeof rawResponse === 'string' ? rawResponse : JSON.stringify(result);
  return { httpRequests: 1, totalBytes: Buffer.byteLength(body) };
}

// =================================================================
// Scénario 3 : Liste avec relations — 10 livres avec auteurs
// =================================================================

/** REST : 1 requête pour les livres + 1 par auteur unique */
async function scenario3_REST(): Promise<{ httpRequests: number; totalBytes: number }> {
  let totalBytes = 0;
  let httpRequests = 0;

  // 1. Récupérer les 10 livres
  const booksRes = await fetch(`${REST_URL}/books?limit=10`);
  const booksText = await booksRes.text();
  totalBytes += Buffer.byteLength(booksText);
  httpRequests++;

  const booksData = JSON.parse(booksText);
  const authorIds = [...new Set(booksData.data.map((b: any) => b.author_id))] as number[];

  // 2. Récupérer chaque auteur unique
  for (const authorId of authorIds) {
    const authorRes = await fetch(`${REST_URL}/authors/${authorId}`);
    const authorText = await authorRes.text();
    totalBytes += Buffer.byteLength(authorText);
    httpRequests++;
  }

  return { httpRequests, totalBytes };
}

/** GraphQL : une seule query avec résolution imbriquée */
async function scenario3_GraphQL(useDataLoader: boolean): Promise<{ httpRequests: number; totalBytes: number }> {
  const res = await graphqlQuery(
    `query {
      books(limit: 10) {
        id title year genre
        author { id name nationality }
      }
    }`,
    {},
    useDataLoader
  );
  const body = await res.text();
  return { httpRequests: 1, totalBytes: Buffer.byteLength(body) };
}

/** SOAP : GetBooks retourne les livres avec auteurs */
async function scenario3_SOAP(): Promise<{ httpRequests: number; totalBytes: number }> {
  const client = await getSoapClient();
  const [result, rawResponse] = await client.GetBooksAsync({ limit: 10, offset: 0 });
  const body = typeof rawResponse === 'string' ? rawResponse : JSON.stringify(result);
  return { httpRequests: 1, totalBytes: Buffer.byteLength(body) };
}

// =================================================================
// Export : définition des scénarios
// =================================================================

export interface ScenarioDefinition {
  name: string;
  description: string;
  apis: {
    name: BenchmarkResult['api'];
    adminUrl: string;
    run: () => Promise<{ httpRequests: number; totalBytes: number }>;
  }[];
}

export const scenarios: ScenarioDefinition[] = [
  {
    name: 'Requête simple',
    description: 'Récupérer un livre par ID',
    apis: [
      { name: 'REST', adminUrl: REST_URL, run: scenario1_REST },
      { name: 'GraphQL', adminUrl: GRAPHQL_ADMIN_URL, run: () => scenario1_GraphQL(false) },
      { name: 'GraphQL+DataLoader', adminUrl: GRAPHQL_ADMIN_URL, run: () => scenario1_GraphQL(true) },
      { name: 'SOAP', adminUrl: SOAP_URL, run: scenario1_SOAP },
    ],
  },
  {
    name: 'Données liées',
    description: 'Un livre avec son auteur et ses reviews (3 requêtes REST vs 1 requête GraphQL/SOAP)',
    apis: [
      { name: 'REST', adminUrl: REST_URL, run: scenario2_REST },
      { name: 'GraphQL', adminUrl: GRAPHQL_ADMIN_URL, run: () => scenario2_GraphQL(false) },
      { name: 'GraphQL+DataLoader', adminUrl: GRAPHQL_ADMIN_URL, run: () => scenario2_GraphQL(true) },
      { name: 'SOAP', adminUrl: SOAP_URL, run: scenario2_SOAP },
    ],
  },
  {
    name: 'Liste avec relations',
    description: '10 livres avec leurs auteurs (N+1 requêtes REST, N+1 SQL sans DataLoader)',
    apis: [
      { name: 'REST', adminUrl: REST_URL, run: scenario3_REST },
      { name: 'GraphQL', adminUrl: GRAPHQL_ADMIN_URL, run: () => scenario3_GraphQL(false) },
      { name: 'GraphQL+DataLoader', adminUrl: GRAPHQL_ADMIN_URL, run: () => scenario3_GraphQL(true) },
      { name: 'SOAP', adminUrl: SOAP_URL, run: scenario3_SOAP },
    ],
  },
];

export { resetSqlCounter, getSqlCount };
