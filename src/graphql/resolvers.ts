import DataLoader from 'dataloader';
import { q, type Author, type Book, type Review } from '../db.js';

export interface GqlContext {
  useDataLoader: boolean;
  authorLoader: DataLoader<string, Author | null>;
}

export function createContext(useDataLoader: boolean): GqlContext {
  const authorLoader = new DataLoader<string, Author | null>(async (ids) => {
    const placeholders = ids.map(() => '?').join(',');
    const authors = q.all<Author>(`SELECT * FROM authors WHERE id IN (${placeholders})`, [...ids]);
    return ids.map(id => authors.find(a => String(a.id) === String(id)) ?? null);
  });
  return { useDataLoader, authorLoader };
}

export const resolvers = {
  Query: {
    book(_: unknown, { id }: { id: string }) {
      return q.get<Book>('SELECT * FROM books WHERE id = ?', [id]);
    },
    books(_: unknown, { limit = 10, offset = 0 }: { limit?: number; offset?: number }) {
      return q.all<Book>('SELECT * FROM books LIMIT ? OFFSET ?', [limit, offset]);
    },
  },

  Book: {
    author(book: Book, _: unknown, ctx: GqlContext) {
      if (ctx.useDataLoader) 
        return ctx.authorLoader.load(String(book.author_id));
      else 
        return q.get<Author>('SELECT * FROM authors WHERE id = ?', [book.author_id]);
    },
    reviews(book: Book) {
      return q.all<Review>('SELECT * FROM reviews WHERE book_id = ?', [book.id]);
    },
  },
};
