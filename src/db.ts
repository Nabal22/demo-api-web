import Database from 'better-sqlite3';

const db = new Database(':memory:');

db.exec(`
  CREATE TABLE authors (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    bio TEXT,
    nationality TEXT
  );
  CREATE TABLE books (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    year INTEGER NOT NULL,
    genre TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    FOREIGN KEY (author_id) REFERENCES authors(id)
  );
  CREATE TABLE reviews (
    id INTEGER PRIMARY KEY,
    book_id INTEGER NOT NULL,
    reviewer TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
`);

const insertAuthor = db.prepare('INSERT INTO authors VALUES (?, ?, ?, ?)');
[
  [1, 'Frank Herbert',        'Auteur américain, créateur de la saga Dune.',              'Américain'],
  [2, 'Isaac Asimov',         'Auteur prolifique de SF et vulgarisation scientifique.',   'Américain'],
  [3, 'Philip K. Dick',       'Auteur visionnaire explorant réalité et identité.',        'Américain'],
  [4, 'Arthur C. Clarke',     'Auteur et inventeur britannique, co-auteur de 2001.',      'Britannique'],
  [5, 'Ursula K. Le Guin',    'Auteure féministe et anarchiste de SF et fantasy.',        'Américaine'],
  [6, 'William Gibson',       'Père du cyberpunk, créateur du terme cyberespace.',        'Américain'],
  [7, 'Kim Stanley Robinson', 'Spécialiste des futurs écologiques et alternatifs.',       'Américain'],
  [8, 'Octavia Butler',       'Pionnière afro-américaine de la SF, explorant race et pouvoir.', 'Américaine'],
].forEach(a => insertAuthor.run(...a));

const insertBook = db.prepare('INSERT INTO books VALUES (?, ?, ?, ?, ?)');
[
  [1,  'Dune',                                              1965, 'Space Opera',     1],
  [2,  'Le Messie de Dune',                                1969, 'Space Opera',     1],
  [3,  'Fondation',                                        1951, 'SF classique',    2],
  [4,  'I, Robot',                                         1950, 'SF classique',    2],
  [5,  "Les Cavernes d'acier",                             1954, 'SF policière',    2],
  [6,  "Les androïdes rêvent-ils de moutons électriques ?",1968, 'Cyberpunk',       3],
  [7,  'Le Maître du Haut Château',                        1962, 'Uchronie',        3],
  [8,  'Ubik',                                             1969, 'SF philosophique',3],
  [9,  "2001 : L'Odyssée de l'espace",                     1968, 'Hard SF',         4],
  [10, 'Rendez-vous avec Rama',                            1973, 'Hard SF',         4],
  [11, "Les Enfants d'Icare",                              1953, 'Hard SF',         4],
  [12, 'La Main gauche de la nuit',                        1969, 'SF sociale',      5],
  [13, 'Les Dépossédés',                                   1974, 'Utopie',          5],
  [14, 'Neuromancien',                                     1984, 'Cyberpunk',       6],
  [15, 'Comte Zéro',                                       1986, 'Cyberpunk',       6],
  [16, "Mona Lisa s'éveille",                              1988, 'Cyberpunk',       6],
  [17, 'Mars la rouge',                                    1992, 'Hard SF',         7],
  [18, 'Mars la verte',                                    1994, 'Hard SF',         7],
  [19, 'Liens de sang',                                    1979, 'Afrofuturisme',   8],
  [20, 'La Parabole du semeur',                            1993, 'Dystopie',        8],
].forEach(b => insertBook.run(...b));

const insertReview = db.prepare('INSERT INTO reviews VALUES (?, ?, ?, ?, ?)');
const reviewers = ['Alice', 'Bob', 'Clara', 'David', 'Emma', 'François'];
const comments  = [
  'Un incontournable de la SF.',
  'Brillant et visionnaire.',
  'Lecture fascinante, je recommande.',
  "Chef-d'œuvre du genre.",
  'Impossible à poser.',
  'Une œuvre majeure de la littérature.',
];
let rid = 1;
for (let bookId = 1; bookId <= 20; bookId++) {
  for (let i = 0; i < 3; i++) {
    insertReview.run(rid++, bookId, reviewers[(bookId + i) % 6], 4 + (i % 2), comments[(bookId + i) % 6]);
  }
}

export type Author = { id: number; name: string; bio: string; nationality: string };
export type Book   = { id: number; title: string; year: number; genre: string; author_id: number };
export type Review = { id: number; book_id: number; reviewer: string; rating: number; comment: string };

// Compteur SQL par requête HTTP
let _sqlCount = 0;
export const sqlCounter = {
  reset() { _sqlCount = 0; },
  get()   { return _sqlCount; },
};

// Wrapper qui logue chaque requête SQL dans le terminal
export const q = {
  all<T>(sql: string, params: unknown[] = []): T[] {
    _sqlCount++;
    console.log('  SQL:', sql.replace(/\s+/g, ' ').trim());
    return db.prepare(sql).all(...params) as T[];
  },
  get<T>(sql: string, params: unknown[] = []): T | undefined {
    _sqlCount++;
    console.log('  SQL:', sql.replace(/\s+/g, ' ').trim());
    return db.prepare(sql).get(...params) as T | undefined;
  },
};
