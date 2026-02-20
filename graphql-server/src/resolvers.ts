import DataLoader from 'dataloader';
import type Database from 'better-sqlite3';
import { logQuery } from '../../shared/db';
import type { Book, Author, Review } from '../../shared/types';

// === Création des DataLoaders pour le batching ===

/** DataLoader pour charger des auteurs par leurs IDs (batch) */
function createAuthorLoader(db: Database.Database) {
  return new DataLoader<number, Author>(async (ids) => {
    const placeholders = ids.map(() => '?').join(',');
    logQuery(`SELECT * FROM authors WHERE id IN (${ids.join(',')})`);
    const authors = db.prepare(`SELECT * FROM authors WHERE id IN (${placeholders})`).all(...ids) as Author[];
    // Réordonner les résultats pour correspondre à l'ordre des IDs demandés
    const map = new Map(authors.map((a) => [a.id, a]));
    return ids.map((id) => map.get(id)!);
  });
}

/** DataLoader pour charger les reviews par book_id (batch) */
function createReviewsByBookLoader(db: Database.Database) {
  return new DataLoader<number, Review[]>(async (bookIds) => {
    const placeholders = bookIds.map(() => '?').join(',');
    logQuery(`SELECT * FROM reviews WHERE book_id IN (${bookIds.join(',')})`);
    const reviews = db.prepare(`SELECT * FROM reviews WHERE book_id IN (${placeholders})`).all(...bookIds) as Review[];
    // Grouper par book_id
    const map = new Map<number, Review[]>();
    for (const r of reviews) {
      if (!map.has(r.book_id)) map.set(r.book_id, []);
      map.get(r.book_id)!.push(r);
    }
    return bookIds.map((id) => map.get(id) || []);
  });
}

/** DataLoader pour charger les livres par author_id (batch) */
function createBooksByAuthorLoader(db: Database.Database) {
  return new DataLoader<number, Book[]>(async (authorIds) => {
    const placeholders = authorIds.map(() => '?').join(',');
    logQuery(`SELECT * FROM books WHERE author_id IN (${authorIds.join(',')})`);
    const books = db.prepare(`SELECT * FROM books WHERE author_id IN (${placeholders})`).all(...authorIds) as Book[];
    const map = new Map<number, Book[]>();
    for (const b of books) {
      if (!map.has(b.author_id)) map.set(b.author_id, []);
      map.get(b.author_id)!.push(b);
    }
    return authorIds.map((id) => map.get(id) || []);
  });
}

/** Contexte GraphQL — contient la DB et les loaders optionnels */
export interface GraphQLContext {
  db: Database.Database;
  useDataLoader: boolean;
  authorLoader: DataLoader<number, Author>;
  reviewsByBookLoader: DataLoader<number, Review[]>;
  booksByAuthorLoader: DataLoader<number, Book[]>;
}

/** Crée un nouveau contexte avec des DataLoaders frais (un par requête) */
export function createContext(db: Database.Database, useDataLoader: boolean): GraphQLContext {
  return {
    db,
    useDataLoader,
    authorLoader: createAuthorLoader(db),
    reviewsByBookLoader: createReviewsByBookLoader(db),
    booksByAuthorLoader: createBooksByAuthorLoader(db),
  };
}

// === Resolvers ===

export const resolvers = {
  Query: {
    /** Récupérer un livre par ID */
    book: (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      logQuery(`SELECT * FROM books WHERE id = ${id}`);
      return ctx.db.prepare('SELECT * FROM books WHERE id = ?').get(parseInt(id)) as Book | undefined;
    },

    /** Liste paginée de livres */
    books: (_: unknown, { limit, offset }: { limit: number; offset: number }, ctx: GraphQLContext) => {
      logQuery(`SELECT * FROM books LIMIT ${limit} OFFSET ${offset}`);
      return ctx.db.prepare('SELECT * FROM books LIMIT ? OFFSET ?').all(limit, offset) as Book[];
    },

    /** Récupérer un auteur par ID */
    author: (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      logQuery(`SELECT * FROM authors WHERE id = ${id}`);
      return ctx.db.prepare('SELECT * FROM authors WHERE id = ?').get(parseInt(id)) as Author | undefined;
    },
  },

  Mutation: {
    /** Ajouter une review */
    addReview: (
      _: unknown,
      args: { bookId: string; reviewer: string; text: string; rating: number },
      ctx: GraphQLContext
    ) => {
      logQuery(`INSERT INTO reviews (book_id, reviewer, text, rating)`);
      const result = ctx.db
        .prepare('INSERT INTO reviews (book_id, reviewer, text, rating) VALUES (?, ?, ?, ?)')
        .run(parseInt(args.bookId), args.reviewer, args.text, args.rating);
      return {
        id: result.lastInsertRowid as number,
        book_id: parseInt(args.bookId),
        reviewer: args.reviewer,
        text: args.text,
        rating: args.rating,
      };
    },
  },

  Book: {
    /** Résolution de l'auteur — mode naïf vs DataLoader */
    author: (book: Book, _: unknown, ctx: GraphQLContext) => {
      if (ctx.useDataLoader) {
        // Mode DataLoader : la requête sera batchée avec les autres
        return ctx.authorLoader.load(book.author_id);
      }
      // Mode naïf : une requête SQL par livre (problème N+1 !)
      logQuery(`SELECT * FROM authors WHERE id = ${book.author_id}`);
      return ctx.db.prepare('SELECT * FROM authors WHERE id = ?').get(book.author_id) as Author;
    },

    /** Résolution des reviews — mode naïf vs DataLoader */
    reviews: (book: Book, _: unknown, ctx: GraphQLContext) => {
      if (ctx.useDataLoader) {
        return ctx.reviewsByBookLoader.load(book.id);
      }
      // Mode naïf : une requête SQL par livre
      logQuery(`SELECT * FROM reviews WHERE book_id = ${book.id}`);
      return ctx.db.prepare('SELECT * FROM reviews WHERE book_id = ?').all(book.id) as Review[];
    },

    /** Calcul de la note moyenne */
    averageRating: async (book: Book, _: unknown, ctx: GraphQLContext) => {
      let reviews: Review[];
      if (ctx.useDataLoader) {
        reviews = await ctx.reviewsByBookLoader.load(book.id);
      } else {
        logQuery(`SELECT * FROM reviews WHERE book_id = ${book.id} (pour moyenne)`);
        reviews = ctx.db.prepare('SELECT * FROM reviews WHERE book_id = ?').all(book.id) as Review[];
      }
      if (reviews.length === 0) return null;
      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      return Math.round((sum / reviews.length) * 10) / 10;
    },
  },

  Author: {
    /** Résolution des livres d'un auteur */
    books: (author: Author, _: unknown, ctx: GraphQLContext) => {
      if (ctx.useDataLoader) {
        return ctx.booksByAuthorLoader.load(author.id);
      }
      logQuery(`SELECT * FROM books WHERE author_id = ${author.id}`);
      return ctx.db.prepare('SELECT * FROM books WHERE author_id = ?').all(author.id) as Book[];
    },
  },
};
