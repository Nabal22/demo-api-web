import { Router } from 'express';
import { q, type Author, type Book, type Review } from '../db.js';

const router = Router();
const BASE = 'http://localhost:3000';

function bookLinks(id: number) {
  return {
    self:    { href: `${BASE}/rest/books/${id}` },
    author:  { href: `${BASE}/rest/books/${id}/author` },
    reviews: { href: `${BASE}/rest/books/${id}/reviews` },
  };
}

router.get('/books', (req, res) => {
  const limit  = Math.min(parseInt(req.query['limit']  as string) || 10, 50);
  const offset = parseInt(req.query['offset'] as string) || 0;

  const books = q.all<Book>('SELECT * FROM books LIMIT ? OFFSET ?', [limit, offset]);
  const total = q.get<{ count: number }>('SELECT COUNT(*) as count FROM books')!.count;

  res.json({
    data: books.map(b => ({ ...b, _links: bookLinks(b.id) })),
    pagination: { limit, offset, total },
    _links: {
      self: { href: `${BASE}/rest/books?limit=${limit}&offset=${offset}` },
      next: offset + limit < total
        ? { href: `${BASE}/rest/books?limit=${limit}&offset=${offset + limit}` }
        : undefined,
    },
  });
});

router.get('/books/:id', (req, res) => {
  const book = q.get<Book>('SELECT * FROM books WHERE id = ?', [req.params['id']]);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json({ ...book, _links: bookLinks(book.id) });
});

router.get('/books/:id/author', (req, res) => {
  const book = q.get<Book>('SELECT * FROM books WHERE id = ?', [req.params['id']]);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const author = q.get<Author>('SELECT * FROM authors WHERE id = ?', [book.author_id]);
  if (!author) return res.status(404).json({ error: 'Author not found' });

  res.json({
    ...author,
    _links: {
      self:  { href: `${BASE}/rest/authors/${author.id}` },
      books: { href: `${BASE}/rest/books?author_id=${author.id}` },
    },
  });
});

router.get('/books/:id/reviews', (req, res) => {
  const reviews = q.all<Review>('SELECT * FROM reviews WHERE book_id = ?', [req.params['id']]);
  res.json({
    data: reviews,
    _links: {
      self: { href: `${BASE}/rest/books/${req.params['id']}/reviews` },
      book: { href: `${BASE}/rest/books/${req.params['id']}` },
    },
  });
});

router.get('/authors/:id', (req, res) => {
  const author = q.get<Author>('SELECT * FROM authors WHERE id = ?', [req.params['id']]);
  if (!author) return res.status(404).json({ error: 'Author not found' });

  res.json({
    ...author,
    _links: {
      self:  { href: `${BASE}/rest/authors/${author.id}` },
      books: { href: `${BASE}/rest/books?author_id=${author.id}` },
    },
  });
});

export default router;
