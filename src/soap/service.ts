import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';
import type { Application } from 'express';

const require = createRequire(import.meta.url);
const soap = require('soap') as typeof import('soap');
import { q, type Author, type Book, type Review } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wsdl = readFileSync(path.join(__dirname, 'BookCatalog.wsdl'), 'utf-8');

const soapService = {
  BookCatalogService: {
    BookCatalogPort: {

      GetBook({ BookId }: { BookId: string }) {
        const book = q.get<Book>('SELECT * FROM books WHERE id = ?', [BookId]);
        if (!book) throw { Fault: { faultcode: 'Client', faultstring: 'Book not found' } };

        const author  = q.get<Author>('SELECT * FROM authors WHERE id = ?', [book.author_id]);
        const reviews = q.all<Review>('SELECT * FROM reviews WHERE book_id = ?', [book.id]);

        return {
          Book: {
            Id: book.id, Title: book.title, Year: book.year, Genre: book.genre, AuthorId: book.author_id,
            Author:  author  ? { Id: author.id, Name: author.name, Bio: author.bio, Nationality: author.nationality } : undefined,
            Reviews: { Review: reviews.map(r => ({ Id: r.id, Reviewer: r.reviewer, Rating: r.rating, Comment: r.comment })) },
          },
        };
      },

      GetBooks({ Limit = 10, Offset = 0 }: { Limit?: number; Offset?: number }) {
        const books     = q.all<Book>('SELECT * FROM books LIMIT ? OFFSET ?', [Limit, Offset]);
        const authorIds = [...new Set(books.map(b => b.author_id))];
        const authors   = authorIds.length > 0
          ? q.all<Author>(`SELECT * FROM authors WHERE id IN (${authorIds.map(() => '?').join(',')})`, authorIds)
          : [];
        const authorMap = new Map(authors.map(a => [a.id, a]));

        return {
          Books: {
            Book: books.map(b => {
              const a = authorMap.get(b.author_id);
              return {
                Id: b.id, Title: b.title, Year: b.year, Genre: b.genre, AuthorId: b.author_id,
                Author: a ? { Id: a.id, Name: a.name, Bio: a.bio, Nationality: a.nationality } : undefined,
              };
            }),
          },
        };
      },

      GetAuthor({ AuthorId }: { AuthorId: string }) {
        const author = q.get<Author>('SELECT * FROM authors WHERE id = ?', [AuthorId]);
        if (!author) throw { Fault: { faultcode: 'Client', faultstring: 'Author not found' } };
        return { Author: { Id: author.id, Name: author.name, Bio: author.bio, Nationality: author.nationality } };
      },

      GetBookReviews({ BookId }: { BookId: string }) {
        const reviews = q.all<Review>('SELECT * FROM reviews WHERE book_id = ?', [BookId]);
        return { Reviews: { Review: reviews.map(r => ({ Id: r.id, Reviewer: r.reviewer, Rating: r.rating, Comment: r.comment })) } };
      },
    },
  },
};

export function registerSoap(app: Application) {
  soap.listen(app, '/soap', soapService, wsdl);
}
