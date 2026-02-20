import express from 'express';
import getDb, { logQuery, resetSqlCounter, getSqlCount } from '../../shared/db';
import type { Book, Author, Review } from '../../shared/types';

const app = express();
app.use(express.json());

const PORT = 3001;
const db = getDb();

// === Middleware : headers communs et logging ===
app.use((_req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// === Endpoint pour récupérer/reset le compteur SQL (utilisé par le benchmark) ===
app.post('/admin/reset-sql-counter', (_req, res) => {
  resetSqlCounter();
  res.json({ ok: true });
});

app.get('/admin/sql-count', (_req, res) => {
  res.json({ count: getSqlCount() });
});

// =================================================================
// GET /books — Liste paginée de livres
// =================================================================
app.get('/books', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  logQuery(`SELECT * FROM books LIMIT ${limit} OFFSET ${offset}`);
  const books = db.prepare('SELECT * FROM books LIMIT ? OFFSET ?').all(limit, offset) as Book[];

  logQuery('SELECT COUNT(*) FROM books');
  const { total } = db.prepare('SELECT COUNT(*) as total FROM books').get() as { total: number };

  // Cache-Control : les listes sont cachables 60 secondes
  res.setHeader('Cache-Control', 'public, max-age=60');

  res.json({
    data: books.map((b) => ({
      ...b,
      // Liens HATEOAS niveau 3
      _links: {
        self: { href: `/books/${b.id}` },
        author: { href: `/authors/${b.author_id}` },
        reviews: { href: `/books/${b.id}/reviews` },
      },
    })),
    _links: {
      self: { href: `/books?limit=${limit}&offset=${offset}` },
      ...(offset + limit < total
        ? { next: { href: `/books?limit=${limit}&offset=${offset + limit}` } }
        : {}),
      ...(offset > 0
        ? { prev: { href: `/books?limit=${limit}&offset=${Math.max(0, offset - limit)}` } }
        : {}),
    },
    total,
  });
});

// =================================================================
// GET /books/:id — Un livre avec liens HATEOAS
// =================================================================
app.get('/books/:id', (req, res) => {
  const id = parseInt(req.params.id);

  logQuery(`SELECT * FROM books WHERE id = ${id}`);
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as Book | undefined;

  if (!book) {
    res.status(404).json({ error: 'Livre non trouvé' });
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=120');

  res.json({
    ...book,
    _links: {
      self: { href: `/books/${book.id}` },
      author: { href: `/authors/${book.author_id}` },
      reviews: { href: `/books/${book.id}/reviews` },
      collection: { href: '/books' },
    },
  });
});

// =================================================================
// GET /books/:id/reviews — Reviews d'un livre
// =================================================================
app.get('/books/:id/reviews', (req, res) => {
  const bookId = parseInt(req.params.id);

  // Vérifier que le livre existe
  logQuery(`SELECT id FROM books WHERE id = ${bookId}`);
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
  if (!book) {
    res.status(404).json({ error: 'Livre non trouvé' });
    return;
  }

  logQuery(`SELECT * FROM reviews WHERE book_id = ${bookId}`);
  const reviews = db.prepare('SELECT * FROM reviews WHERE book_id = ?').all(bookId) as Review[];

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({
    data: reviews,
    _links: {
      book: { href: `/books/${bookId}` },
    },
  });
});

// =================================================================
// GET /authors/:id — Un auteur
// =================================================================
app.get('/authors/:id', (req, res) => {
  const id = parseInt(req.params.id);

  logQuery(`SELECT * FROM authors WHERE id = ${id}`);
  const author = db.prepare('SELECT * FROM authors WHERE id = ?').get(id) as Author | undefined;

  if (!author) {
    res.status(404).json({ error: 'Auteur non trouvé' });
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=120');

  res.json({
    ...author,
    _links: {
      self: { href: `/authors/${author.id}` },
      books: { href: `/authors/${author.id}/books` },
    },
  });
});

// =================================================================
// GET /authors/:id/books — Livres d'un auteur
// =================================================================
app.get('/authors/:id/books', (req, res) => {
  const authorId = parseInt(req.params.id);

  logQuery(`SELECT * FROM authors WHERE id = ${authorId}`);
  const author = db.prepare('SELECT * FROM authors WHERE id = ?').get(authorId);
  if (!author) {
    res.status(404).json({ error: 'Auteur non trouvé' });
    return;
  }

  logQuery(`SELECT * FROM books WHERE author_id = ${authorId}`);
  const books = db.prepare('SELECT * FROM books WHERE author_id = ?').all(authorId) as Book[];

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({
    data: books.map((b) => ({
      ...b,
      _links: {
        self: { href: `/books/${b.id}` },
        author: { href: `/authors/${authorId}` },
        reviews: { href: `/books/${b.id}/reviews` },
      },
    })),
    _links: {
      author: { href: `/authors/${authorId}` },
    },
  });
});

// =================================================================
// POST /books/:id/reviews — Créer une review
// =================================================================
app.post('/books/:id/reviews', (req, res) => {
  const bookId = parseInt(req.params.id);
  const { reviewer, text, rating } = req.body;

  // Validation
  if (!reviewer || !text || rating == null) {
    res.status(400).json({ error: 'Champs requis : reviewer, text, rating' });
    return;
  }
  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Le rating doit être entre 1 et 5' });
    return;
  }

  // Vérifier que le livre existe
  logQuery(`SELECT id FROM books WHERE id = ${bookId}`);
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
  if (!book) {
    res.status(404).json({ error: 'Livre non trouvé' });
    return;
  }

  logQuery(`INSERT INTO reviews (book_id, reviewer, text, rating)`);
  const result = db.prepare(
    'INSERT INTO reviews (book_id, reviewer, text, rating) VALUES (?, ?, ?, ?)'
  ).run(bookId, reviewer, text, rating);

  const review: Review = {
    id: result.lastInsertRowid as number,
    book_id: bookId,
    reviewer,
    text,
    rating,
  };

  res.status(201).json({
    ...review,
    _links: {
      book: { href: `/books/${bookId}` },
      reviews: { href: `/books/${bookId}/reviews` },
    },
  });
});

// === Lancement du serveur ===
app.listen(PORT, () => {
  console.log(`🔵 REST server démarré sur http://localhost:${PORT}`);
});

export default app;
