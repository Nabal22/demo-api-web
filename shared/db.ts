import Database from 'better-sqlite3';
import path from 'path';

// === Chemin vers la base SQLite partagée par tous les serveurs ===
const DB_PATH = path.join(__dirname, '..', 'data.sqlite');

/** Compteur de requêtes SQL — utilisé par le benchmark pour mesurer le N+1 */
let sqlQueryCount = 0;

/** Remet le compteur SQL à zéro */
export function resetSqlCounter(): void {
  sqlQueryCount = 0;
}

/** Retourne le nombre de requêtes SQL exécutées depuis le dernier reset */
export function getSqlCount(): number {
  return sqlQueryCount;
}

/** Incrémente le compteur et affiche la requête dans la console */
export function logQuery(label: string): void {
  sqlQueryCount++;
  console.log(`  [SQL #${sqlQueryCount}] ${label}`);
}

/** Ouvre (ou crée) la base de données SQLite */
export function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// ============================================================
// Seed : exécuté directement avec `tsx shared/db.ts`
// ============================================================
if (require.main === module) {
  console.log('🌱 Initialisation de la base de données...');
  const db = getDb();

  // --- Création des tables ---
  db.exec(`
    DROP TABLE IF EXISTS reviews;
    DROP TABLE IF EXISTS books;
    DROP TABLE IF EXISTS authors;

    CREATE TABLE authors (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      bio TEXT NOT NULL,
      nationality TEXT NOT NULL
    );

    CREATE TABLE books (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      year INTEGER NOT NULL,
      genre TEXT NOT NULL,
      author_id INTEGER NOT NULL REFERENCES authors(id)
    );

    CREATE TABLE reviews (
      id INTEGER PRIMARY KEY,
      book_id INTEGER NOT NULL REFERENCES books(id),
      reviewer TEXT NOT NULL,
      text TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5)
    );
  `);

  // --- 10 auteurs de science-fiction classique ---
  const authors = [
    [1, 'Isaac Asimov', 'Auteur prolifique, père de la robotique en SF et créateur de la saga Fondation.', 'Américain'],
    [2, 'Frank Herbert', 'Créateur de l\'univers Dune, mêlant écologie, politique et religion.', 'Américain'],
    [3, 'Philip K. Dick', 'Maître de la SF paranoïaque, questionnant la réalité et l\'identité.', 'Américain'],
    [4, 'Arthur C. Clarke', 'Visionnaire de l\'ère spatiale, co-créateur de 2001 l\'Odyssée de l\'espace.', 'Britannique'],
    [5, 'Ursula K. Le Guin', 'Pionnière de la SF sociale et anthropologique.', 'Américaine'],
    [6, 'Ray Bradbury', 'Poète de la SF, auteur de Fahrenheit 451 et des Chroniques martiennes.', 'Américain'],
    [7, 'Stanislas Lem', 'Philosophe et satiriste polonais, auteur de Solaris.', 'Polonais'],
    [8, 'H.G. Wells', 'Père fondateur de la science-fiction moderne.', 'Britannique'],
    [9, 'Jules Verne', 'Pionnier du roman d\'anticipation scientifique.', 'Français'],
    [10, 'Aldous Huxley', 'Auteur du Meilleur des mondes, dystopie fondatrice.', 'Britannique'],
  ];

  const insertAuthor = db.prepare('INSERT INTO authors (id, name, bio, nationality) VALUES (?, ?, ?, ?)');
  for (const a of authors) insertAuthor.run(...a);

  // --- 30 livres de SF classiques ---
  const books = [
    // Asimov (1)
    [1, 'Fondation', 1951, 'Science-fiction', 1],
    [2, 'Fondation et Empire', 1952, 'Science-fiction', 1],
    [3, 'Seconde Fondation', 1953, 'Science-fiction', 1],
    [4, 'Les Robots', 1950, 'Science-fiction', 1],
    // Herbert (2)
    [5, 'Dune', 1965, 'Science-fiction', 2],
    [6, 'Le Messie de Dune', 1969, 'Science-fiction', 2],
    [7, 'Les Enfants de Dune', 1976, 'Science-fiction', 2],
    // Dick (3)
    [8, 'Ubik', 1969, 'Science-fiction', 3],
    [9, 'Le Maître du Haut Château', 1962, 'Uchronie', 3],
    [10, 'Les androïdes rêvent-ils de moutons électriques ?', 1968, 'Science-fiction', 3],
    // Clarke (4)
    [11, '2001 : l\'Odyssée de l\'espace', 1968, 'Science-fiction', 4],
    [12, 'Rendez-vous avec Rama', 1973, 'Science-fiction', 4],
    [13, 'Les Fontaines du paradis', 1979, 'Science-fiction', 4],
    // Le Guin (5)
    [14, 'La Main gauche de la nuit', 1969, 'Science-fiction', 5],
    [15, 'Les Dépossédés', 1974, 'Science-fiction', 5],
    [16, 'Le Nom du monde est forêt', 1972, 'Science-fiction', 5],
    // Bradbury (6)
    [17, 'Fahrenheit 451', 1953, 'Dystopie', 6],
    [18, 'Chroniques martiennes', 1950, 'Science-fiction', 6],
    [19, 'L\'Homme illustré', 1951, 'Nouvelles SF', 6],
    // Lem (7)
    [20, 'Solaris', 1961, 'Science-fiction', 7],
    [21, 'Le Congrès de futurologie', 1971, 'Science-fiction', 7],
    [22, 'Récits de Pirx le pilote', 1968, 'Science-fiction', 7],
    // Wells (8)
    [23, 'La Machine à explorer le temps', 1895, 'Science-fiction', 8],
    [24, 'La Guerre des mondes', 1898, 'Science-fiction', 8],
    [25, 'L\'Île du docteur Moreau', 1896, 'Science-fiction', 8],
    // Verne (9)
    [26, 'Vingt mille lieues sous les mers', 1870, 'Aventure SF', 9],
    [27, 'De la Terre à la Lune', 1865, 'Aventure SF', 9],
    [28, 'Voyage au centre de la Terre', 1864, 'Aventure SF', 9],
    // Huxley (10)
    [29, 'Le Meilleur des mondes', 1932, 'Dystopie', 10],
    [30, 'Île', 1962, 'Utopie', 10],
  ];

  const insertBook = db.prepare('INSERT INTO books (id, title, year, genre, author_id) VALUES (?, ?, ?, ?, ?)');
  for (const b of books) insertBook.run(...b);

  // --- ~100 reviews réalistes ---
  const reviewers = [
    'Alice Martin', 'Bob Dupont', 'Claire Lefèvre', 'David Moreau',
    'Emma Bernard', 'François Petit', 'Gabrielle Roux', 'Hugo Lambert',
    'Inès Fontaine', 'Julien Mercier',
  ];

  const reviewTexts: Record<number, string[]> = {
    5: ['Chef-d\'œuvre absolu.', 'Incontournable !', 'Un peu long par moments.', 'Fascinant.'],
    4: ['Très bon, quelques longueurs.', 'Excellent, à relire.', 'Captivant du début à la fin.', 'Solide.'],
    3: ['Correct sans plus.', 'Intéressant mais daté.', 'Moyen, pas le meilleur de l\'auteur.', 'Passable.'],
    2: ['Décevant.', 'Difficile à finir.', 'Pas convaincu.'],
    1: ['Ennuyeux.', 'Pas du tout mon style.'],
  };

  const insertReview = db.prepare(
    'INSERT INTO reviews (id, book_id, reviewer, text, rating) VALUES (?, ?, ?, ?, ?)'
  );

  let reviewId = 1;
  // Distribuer environ 100 reviews sur les 30 livres (3-4 reviews par livre)
  for (let bookId = 1; bookId <= 30; bookId++) {
    // Chaque livre reçoit entre 3 et 4 reviews
    const count = bookId <= 10 ? 4 : 3;
    for (let r = 0; r < count; r++) {
      const rating = Math.max(1, Math.min(5, 3 + Math.floor(Math.random() * 3) - (bookId % 3 === 0 ? 1 : 0)));
      const texts = reviewTexts[rating] || reviewTexts[3]!;
      const text = texts[r % texts.length]!;
      const reviewer = reviewers[(bookId + r) % reviewers.length]!;
      insertReview.run(reviewId++, bookId, reviewer, text, rating);
    }
  }

  db.close();
  console.log(`✅ Base de données créée : ${DB_PATH}`);
  console.log(`   ${authors.length} auteurs, ${books.length} livres, ${reviewId - 1} reviews`);
}

export default getDb;
