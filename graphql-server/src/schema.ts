// === Schéma GraphQL SDL pour le catalogue de livres ===

export const typeDefs = `#graphql
  """Un livre du catalogue"""
  type Book {
    id: ID!
    title: String!
    year: Int!
    genre: String!
    author: Author!
    reviews: [Review!]!
    averageRating: Float
  }

  """Un auteur"""
  type Author {
    id: ID!
    name: String!
    bio: String!
    nationality: String!
    books: [Book!]!
  }

  """Une critique de livre"""
  type Review {
    id: ID!
    book_id: ID!
    reviewer: String!
    text: String!
    rating: Int!
  }

  type Query {
    """Récupérer un livre par son ID"""
    book(id: ID!): Book

    """Liste paginée de livres"""
    books(limit: Int = 10, offset: Int = 0): [Book!]!

    """Récupérer un auteur par son ID"""
    author(id: ID!): Author
  }

  type Mutation {
    """Ajouter une review à un livre"""
    addReview(bookId: ID!, reviewer: String!, text: String!, rating: Int!): Review!
  }
`;
